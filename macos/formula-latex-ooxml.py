#!/usr/bin/env python3
"""Source-based LaTeX to native OOXML conversion with explicit failures.
Run with Formula's existing venv-document Python: INPUT.tex NEW_OUTPUT_DIRECTORY.
Preserves source and raw output; never invokes TeX or changes the clipboard.
"""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('m', M)
ET.register_namespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
ET.register_namespace('w', W)

def tag(name):
    return '{' + M + '}' + name


def check_known_fidelity_limits(source):
    # Scan TeX control sequences, respecting comments and escaped backslashes.
    # Known lossy cases fail before any clipboard commit instead of silently
    # using texmath's approximated spacing or incorrect bold-italic style.
    i = 0
    while i < len(source):
        if source[i] == '%':
            end = source.find('\n', i)
            i = len(source) if end < 0 else end + 1
            continue
        if source[i] != chr(92):
            i += 1
            continue
        i += 1
        start = i
        if i < len(source) and source[i].isalpha():
            while i < len(source) and source[i].isalpha():
                i += 1
        else:
            i += 1
        command = source[start:i]
        if command == '!':
            raise ValueError('当前转换器不能保真表达负间距命令 '+chr(92)+'!；原生公式复制已停止，原剪贴板保留。')
        if command == 'mathbf':
            raise ValueError('当前转换器将 '+chr(92)+'mathbf 错误输出为粗斜体；原生公式复制已停止，原源码和剪贴板保留。')


def convert(source, output, preserved_omml=None):
    import pypandoc
    if not source.strip() or len(source) > 100000:
        raise ValueError('Expected one nonempty LaTeX formula, up to 100000 characters')
    if preserved_omml is None: check_known_fidelity_limits(source)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    (output / 'source.tex').write_text(source, encoding='utf-8')
    binary = pypandoc.get_pandoc_path()
    version = subprocess.run([binary, '--version'], check=True, capture_output=True, text=True, timeout=10).stdout.splitlines()[0]
    # A Math AST node prevents source from being interpreted as document commands.
    conversion_source=source.replace(r'\genfrac{}{}{0pt}{}',r'\genfrac{.}{.}{0pt}{0}')
    ast = {'pandoc-api-version': [1, 23, 1], 'meta': {}, 'blocks': [
        {'t': 'Para', 'c': [{'t': 'Math', 'c': [{'t': 'DisplayMath'}, conversion_source]}]}]}
    with tempfile.TemporaryDirectory(prefix='formula-source-math-') as temporary:
        path = Path(temporary)
        (path / 'input.json').write_text(json.dumps(ast), encoding='utf-8')
        result = subprocess.run([binary, '--sandbox', '--fail-if-warnings', '-f', 'json', '-t', 'docx',
                                 str(path / 'input.json'), '-o', str(path / 'output.docx')],
                                capture_output=True, text=True, timeout=20)
        if result.returncode or result.stderr.strip():
            raise ValueError('LaTeX conversion rejected: ' + result.stderr[-4000:])
        original = (path / 'output.docx').read_bytes()
    (output / 'pandoc-original.docx').write_bytes(original)
    with zipfile.ZipFile(output / 'pandoc-original.docx') as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
    maths = document.findall('.//' + tag('oMath'))
    if len(maths) != 1 or not list(maths[0]):
        raise ValueError('Converter did not produce exactly one native math object')
    math = maths[0] if preserved_omml is None else ET.fromstring(preserved_omml)
    if math.tag != tag('oMath'): raise ValueError('Invalid preserved native math')
    (output / 'original.omml').write_bytes(ET.tostring(math, encoding='utf-8'))
    changes = []
    # TeX's dot delimiter denotes an absent delimiter, including genfrac's
    # empty delimiters normalized above for texmath's parser.
    for delimiter in math.iter():
        if delimiter.tag in {tag('begChr'),tag('endChr')} and delimiter.get(tag('val'))=='.':
            delimiter.set(tag('val'),'')
            changes.append({'nullDelimiter': True})
    for run in math.iter(tag('r')):
        text = ''.join(t.text or '' for t in run.findall(tag('t')))
        props = run.find(tag('rPr'))
        style = props.find(tag('sty')) if props is not None else None
        if style is not None and style.get(tag('val')) == 'p' and text and not any(unicodedata.category(c).startswith('L') for c in text):
            props.remove(style)
            if not list(props):
                run.remove(props)
            changes.append({'removeRedundantPlainStyle': text})
    # Only recognized function runs are grouped; structure is retained as one arg.
    functions = {'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp'}
    for parent in list(math.iter()):
        children = list(parent)
        # Process right-to-left: sin(cos(x)) must be grouped inside out.
        for run in reversed(children):
            if run.tag != tag('r') or run not in list(parent):
                continue
            text = ''.join(t.text or '' for t in run.findall(tag('t')))
            style = run.find(tag('rPr') + '/' + tag('sty'))
            current = list(parent)
            position = current.index(run)
            if text not in functions or style is None or style.get(tag('val')) != 'p' or position + 1 >= len(current):
                continue
            argument = current[position + 1]
            # Do not guess an argument across an operator or a spacing node.
            if argument.tag == tag('r'):
                argtext = ''.join(t.text or '' for t in argument.findall(tag('t')))
                if not argtext or not all(unicodedata.category(c)[0] in 'LN' for c in argtext):
                    continue
            elif argument.tag not in {tag(x) for x in ('f', 'rad', 'sSup', 'sSub', 'sSubSup', 'd', 'func')}:
                continue
            position = list(parent).index(run)
            parent.remove(run)
            parent.remove(argument)
            func = ET.Element(tag('func'))
            ET.SubElement(func, tag('fName')).append(run)
            ET.SubElement(func, tag('e')).append(argument)
            parent.insert(position, func)
            changes.append({'function': text})
    if preserved_omml is not None:
        math = ET.fromstring(preserved_omml)
        changes = [{'preservedNativeMath': True}]
    omml = ET.tostring(math, encoding='utf-8')
    (output / 'candidate.omml').write_bytes(omml)
    types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    doc = ET.Element('{' + W + '}document')
    paragraph = ET.SubElement(ET.SubElement(doc, '{' + W + '}body'), '{' + W + '}p')
    paragraph.append(math)
    with zipfile.ZipFile(output / 'candidate.docx', 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', types)
        archive.writestr('_rels/.rels', rels)
        archive.writestr('word/document.xml', ET.tostring(doc, encoding='utf-8', xml_declaration=True))
    spec = importlib.util.spec_from_file_location('formula_wps_clipboard', Path(__file__).with_name('formula-wps-clipboard.py'))
    exporter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(exporter)
    gvml = exporter.encode_gvml(omml)
    (output / 'candidate.gvml').write_bytes(gvml)
    package = (output / 'candidate.docx').read_bytes()
    manifest = {'stable': True, 'sourceSHA256': hashlib.sha256(source.encode()).hexdigest(),
                'converter': version, 'normalizations': changes, 'experimental': True,
                'carbonRepresentations': [{'item': 0, 'type': 'com.trolltech.anymime.Kingsoft WPS 9.0 Format',
                                          'file': 'candidate.docx', 'bytes': len(package), 'sha256': hashlib.sha256(package).hexdigest()}]}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest

if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        raise SystemExit('Usage: latex-ooxml-probe.py INPUT.tex NEW_OUTPUT_DIRECTORY')
    print(json.dumps(convert(Path(sys.argv[1]).read_text(encoding='utf-8'), sys.argv[2], Path(sys.argv[3]).read_text(encoding='utf-8') if len(sys.argv)==4 else None), ensure_ascii=False, indent=2))
