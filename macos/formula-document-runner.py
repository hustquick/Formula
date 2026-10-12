#!/usr/bin/env python3
"""Extract native DOCX math and embedded images, without running document macros."""
import argparse
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile
import xml.etree.ElementTree as ET


def extract_docx(path, output_dir):
    import pypandoc
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        if len(infos) > 5000 or sum(x.file_size for x in infos) > 100 * 1024 * 1024:
            raise ValueError('Word 文件展开后过大，请拆分文档后重试。')
        if 'word/document.xml' not in archive.namelist():
            raise ValueError('不是有效的 .docx 文档。旧版 .doc 请先另存为 .docx。')
        result = subprocess.run([pypandoc.get_pandoc_path(), '--sandbox', '--from=docx', '--to=json', str(path)],
                                capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise ValueError('Word 原生公式解析失败：' + result.stderr[-2000:])
        ast = json.loads(result.stdout)
        entries, warnings = [], []
        for info in infos:
            if info.filename.startswith('word/') and info.filename.endswith('.rels'):
                for relation in ET.fromstring(archive.read(info)):
                    if relation.get('TargetMode') == 'External' and relation.get('Type', '').endswith('/image'):
                        warnings.append('Word 含外部图片链接，未下载这些图片；请嵌入图片后重试。')
        paragraph = 0
        images = 0
        def visit(node):
            nonlocal paragraph, images
            if isinstance(node, list):
                for child in node:
                    visit(child)
            elif isinstance(node, dict):
                tag, content = node.get('t'), node.get('c')
                if tag in ('Para', 'Plain', 'Header'):
                    paragraph += 1
                source = f'Word 段落 {max(1, paragraph)}'
                if tag == 'Math':
                    latex = str(content[1]).strip()
                    if latex:
                        entries.append({'latex': latex, 'type': 'native', 'source': source})
                elif tag == 'Image':
                    images += 1
                    if images > 100:
                        raise ValueError('Word 图片超过 100 张，请拆分文档后重试。')
                    target = content[2][0]
                    # Pandoc points embedded images to media/<name>; never read external paths.
                    member = 'word/' + target
                    if not target.startswith('media/') or '..' in PurePosixPath(target).parts or member not in archive.namelist():
                        warnings.append(f'{source} 的外部图片无法读取，已跳过。')
                        return
                    info = archive.getinfo(member)
                    if info.file_size > 30 * 1024 * 1024:
                        warnings.append(f'{source} 的图片超过 30 MB，已跳过。')
                        return
                    destination = output_dir / (f'image-{images}' + PurePosixPath(target).suffix)
                    destination.write_bytes(archive.read(member))
                    entries.append({'image': destination.name, 'source': source + f' · 图片 {images}'})
                else:
                    visit(content)
                if len(entries) > 1000:
                    raise ValueError('文档公式和图片超过 1000 项，请拆分文档后重试。')
        visit(ast['blocks'])
    if result.stderr.strip():
        warnings.append('Word 解析提示：' + result.stderr[-2000:].strip())
    return {'entries': entries, 'warnings': warnings}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('document', nargs='?')
    parser.add_argument('--output-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        import pypandoc
        subprocess.run([pypandoc.get_pandoc_path(), '--version'], check=True, capture_output=True, timeout=20)
        print('FORMULA_DOCUMENT_READY=1', flush=True)
        return
    if not args.document or not args.output_dir:
        parser.error('document and --output-dir are required')
    output = Path(args.output_dir)
    data = extract_docx(Path(args.document), output)
    (output / 'document.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print('FORMULA_DOCUMENT_READY=1', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import sys
        print(f'FORMULA_OCR_ERROR={type(exc).__name__}: {exc}', file=sys.stderr, flush=True)
        sys.exit(1)
