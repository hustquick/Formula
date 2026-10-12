#!/usr/bin/env python3
"""Local PDF/page OCR and DOCX text/OMML extraction; results go to a JSON file."""
import argparse
import io
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile


def progress(message, completed=0, total=0):
    print('FORMULA_DOCUMENT_PROGRESS=' + json.dumps({'message': message, 'completed': completed, 'total': total}, ensure_ascii=False), flush=True)


def build_engine(warmup=False):
    from pix2text import TextFormulaOCR
    from pix2text.consts import MODEL_VERSION, AVAILABLE_MODELS
    from pix2text.utils import data_dir, prepare_model_files2
    if warmup:
        for name in ('mfr-1.5', 'mfd-1.5'):
            info = AVAILABLE_MODELS.get_info(name, 'onnx')
            progress('正在准备公式识别/检测模型：' + name)
            prepare_model_files2(Path(data_dir()) / MODEL_VERSION / info['local_model_id'], info['hf_model_id'], file_or_dir='dir')
    progress('正在加载中英文文字与公式识别模型…')
    return TextFormulaOCR.from_config(enable_spell_checker=False, device='cpu')


def recognize_page(engine, image, number, source):
    items = []
    for item in engine.recognize(image, return_text=False):
        text = str(item.get('text', '')).strip()
        if not text:
            continue
        kind = item.get('type', 'text')
        entry = {'type': kind, 'text': text, 'source': source}
        score = item.get('score')
        if score is not None:
            entry['score'] = float(score)
        items.append(entry)
    return {'number': number, 'source': source, 'items': items,
            'markdown': '\n\n'.join(('$$\n' + x['text'] + '\n$$') if x['type'] in ('isolated', 'embedding') else x['text'] for x in items)}


def recognize_pdf(path, engine, first, last):
    import pymupdf
    from PIL import Image
    pages, warnings = [], []
    with pymupdf.open(path) as pdf:
        if pdf.needs_pass:
            raise ValueError('PDF 已加密，请先解除密码保护。')
        total = len(pdf)
        if first < 1 or first > total:
            raise ValueError(f'起始页应在 1–{total} 页之间。')
        end = min(total, first + 19) if last == 0 else last
        if end < first or end > total or end - first + 1 > 20:
            raise ValueError('请指定有效页码；每次最多识别 20 页。')
        if last == 0 and end < total:
            warnings.append(f'本次识别第 {first}–{end} 页，共 {total} 页。可修改页码继续识别。')
        for index in range(first - 1, end):
            progress(f'正在识别 PDF 第 {index + 1} 页（{index - first + 2}/{end - first + 1}）…', index - first + 1, end - first + 1)
            page = pdf[index]
            scale = min(2.0, 2200 / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            pages.append(recognize_page(engine, image, index + 1, f'第 {index + 1} 页'))
            progress(f'第 {index + 1} 页已完成', index - first + 2, end - first + 1)
    return pages, warnings, total


def recognize_docx(path, engine):
    import pypandoc
    from PIL import Image
    progress('正在提取 Word 正文和原生公式…')
    command = [pypandoc.get_pandoc_path(), '--sandbox', '--from=docx', '--to=json', str(path)]
    converted = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if converted.returncode:
        raise ValueError('Word 解析失败：' + converted.stderr[-3000:])
    ast = json.loads(converted.stdout)
    items, paragraphs, warnings = [], [], []
    image_count = 0
    with zipfile.ZipFile(path) as archive:
        media = {Path(name).name: name for name in archive.namelist() if name.startswith('word/media/')}
        def inline(node, source):
            nonlocal image_count
            if isinstance(node, list):
                return ''.join(inline(x, source) for x in node)
            if not isinstance(node, dict):
                return ''
            tag, content = node.get('t'), node.get('c')
            if tag == 'Str':
                return str(content)
            if tag in ('Space', 'SoftBreak', 'LineBreak'):
                return ' '
            if tag == 'Math':
                latex = content[1].strip()
                kind = 'isolated' if content[0]['t'] == 'DisplayMath' else 'embedding'
                items.append({'type': kind, 'text': latex, 'source': source})
                return ('$$' if kind == 'isolated' else '$') + latex + ('$$' if kind == 'isolated' else '$')
            if tag == 'Image':
                image_count += 1
                name = Path(content[2][0]).name
                member = media.get(name)
                if member is None:
                    warnings.append(f'图片 {image_count} 未嵌入 Word，无法在本地读取。')
                    node.update(t='Str',c='[外部图片]')
                    return '[外部图片]'
                info = archive.getinfo(member)
                if info.file_size > 50 * 1024 * 1024:
                    warnings.append(f'图片 {image_count} 过大，未识别。')
                    node.update(t='Str',c='[图片过大]')
                    return '[图片过大]'
                progress(f'正在识别 Word 图片 {image_count}…')
                try:
                    with Image.open(io.BytesIO(archive.read(member))) as opened:
                        if opened.width * opened.height > 50000000:
                            raise ValueError('图片尺寸过大')
                        result = recognize_page(engine, opened.convert('RGB'), None, f'Word 图片 {image_count}')
                    items.extend(result['items'])
                    content=[]
                    for detected in result['items']:
                        if content:content.append({'t':'SoftBreak'})
                        content.append({'t':'Math','c':[{'t':'DisplayMath'},detected['text']]} if detected['type'] in ('isolated','embedding') else {'t':'Str','c':detected['text']})
                    node.update(t='Span',c=[['',[],[]],content])
                    return '\n\n' + result['markdown'] + '\n\n'
                except Exception as exc:
                    warnings.append(f'图片 {image_count} 未识别：{type(exc).__name__}: {exc}')
                    node.update(t='Str',c='[图片未识别]')
                    return '[图片未识别]'
            return inline(content, source)
        def blocks(node):
            if isinstance(node, list):
                for child in node:
                    blocks(child)
            elif isinstance(node, dict):
                tag, content = node.get('t'), node.get('c')
                if tag in ('Para', 'Plain', 'Header'):
                    source = f'Word 段落 {len(paragraphs) + 1}'
                    value = inline(content if tag != 'Header' else content[2], source).strip()
                    if value:
                        paragraphs.append(('#' * content[0] + ' ' if tag == 'Header' else '') + value)
                        items.append({'type': 'text', 'text': value, 'source': source})
                else:
                    blocks(content)
        blocks(ast['blocks'])
    markdown=pypandoc.convert_text(json.dumps(ast),'markdown',format='json',extra_args=['--wrap=none'])
    return [{'number': None, 'source': 'Word 文档', 'items': items, 'markdown': markdown.strip()}], warnings, None


def recognize_document(path, engine, first=1, last=0):
    suffix = path.suffix.lower()
    if suffix == '.pdf':
        pages, warnings, total = recognize_pdf(path, engine, first, last)
    elif suffix == '.docx':
        pages, warnings, total = recognize_docx(path, engine)
    else:
        from PIL import Image
        progress('正在识别整页图片…', 0, 1)
        with Image.open(path) as image:
            if image.width * image.height > 50000000:
                raise ValueError('图片尺寸过大，请缩小后重试。')
            pages = [recognize_page(engine, image.convert('RGB'), 1, '整页图片')]
        warnings, total = [], 1
    count = sum(x['type'] in ('isolated', 'embedding') for page in pages for x in page['items'])
    return {'sourceName': path.name, 'pages': pages, 'pageCount': total, 'formulaCount': count,
            'warnings': warnings, 'markdown': '\n\n'.join('## ' + page['source'] + '\n\n' + page['markdown'] for page in pages)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('document', nargs='?')
    parser.add_argument('--warmup', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output')
    parser.add_argument('--first', type=int, default=1)
    parser.add_argument('--last', type=int, default=0)
    args = parser.parse_args()
    if args.check:
        from pix2text import TextFormulaOCR
        import pypandoc
        import pymupdf
        print('FORMULA_DOCUMENT_DEPENDENCIES_READY=1')
        return
    if args.warmup:
        build_engine(warmup=True)
        import pypandoc
        subprocess.run([pypandoc.get_pandoc_path(), '--version'], check=True, capture_output=True)
        print('FORMULA_DOCUMENT_READY=1', flush=True)
        return
    if not args.document or not args.output:
        parser.error('document and --output are required')
    path = Path(args.document)
    if not path.is_file():
        raise ValueError('所选文档不存在。')
    if args.first < 1 or args.last < 0:
        raise ValueError('页码必须为正整数。')
    result = recognize_document(path, build_engine(), args.first, args.last)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    print('FORMULA_DOCUMENT_RESULT=1', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import sys
        print(f'FORMULA_OCR_ERROR={type(exc).__name__}: {exc}', file=sys.stderr, flush=True)
        raise
