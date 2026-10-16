"""Strict native WPS math import. No OCR, image or flattened-text fallback."""
import base64
import io
import json
from pathlib import Path
import sys
import unicodedata
import xml.etree.ElementTree as E
import zipfile

M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
E.register_namespace('m',M)
E.register_namespace('a',A)
E.register_namespace('w',W)
def mt(n): return '{'+M+'}'+n
def attr(n, key, default=''): return n.get(mt(key), n.get(key, default)) if n is not None else default

def parse_xml(data):
    if len(data)>8*1024*1024 or b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('公式 XML 超出限制或含不支持的实体声明')
    return E.fromstring(data)

def extract(package, kind):
    if len(package)>1024*1024: raise ValueError('公式剪贴板载荷过大')
    with zipfile.ZipFile(io.BytesIO(package)) as z:
        infos=z.infolist()
        if len(infos)>1000 or sum(i.file_size for i in infos)>32*1024*1024: raise ValueError('公式包展开后过大')
        if len(set(z.namelist()))!=len(infos): raise ValueError('公式包包含重复部件')
        part='word/document.xml' if kind=='writer' else 'clipboard/drawings/drawing1.xml'
        doc=parse_xml(z.read(part))
    maths=doc.findall('.//'+mt('oMath'))
    if not maths:return None
    if len(maths)!=1: raise ValueError('请只复制一个原生公式对象，当前找到 '+str(len(maths))+' 个公式')
    return maths[0]

FUNCTIONS={'sin','cos','tan','cot','sec','csc','arcsin','arccos','arctan','sinh','cosh','tanh','log','ln','exp','lim','min','max','sup','inf','det','gcd'}
SYMBOLS={'∫':r'\int ','∬':r'\iint ','∭':r'\iiint ','∮':r'\oint ','∑':r'\sum ','∏':r'\prod ','∞':r'\infty ','−':'-','≤':r'\le ','≥':r'\ge ','≠':r'\ne ','→':r'\to ','×':r'\times ','·':r'\cdot ','±':r'\pm ','∂':r'\partial ','∇':r'\nabla ','α':r'\alpha ','β':r'\beta ','γ':r'\gamma ','δ':r'\delta ','ε':r'\epsilon ','θ':r'\theta ','λ':r'\lambda ','μ':r'\mu ','π':r'\pi ','ρ':r'\rho ','σ':r'\sigma ','φ':r'\phi ','ω':r'\omega ','Γ':r'\Gamma ','Δ':r'\Delta ','Θ':r'\Theta ','Λ':r'\Lambda ','Π':r'\Pi ','Σ':r'\Sigma ','Φ':r'\Phi ','Ω':r'\Omega ','\u2009':r'\,','\u2004':r'\;','\u2001':r'\quad ','\u2002':r'\enspace ','\u2061':'','\u2062':''}

def escape(text):
    return ''.join(SYMBOLS.get(c, {'{':r'\{','}':r'\}','&':r'\&','%':r'\%','#':r'\#','_':r'\_','\\':r'\backslash '}.get(c,c)) for c in text)

def latex_from_math(math):
    # Property blocks and source bytes are preserved in the unified object.
    # Reject unsupported semantic structures rather than concatenating children.
    def children(n): return [c for c in n if c.tag.startswith('{'+M+'}') and not c.tag.endswith('Pr')]
    def body(n): return ''.join(node(c) for c in children(n)) if n is not None else ''
    def part(n,t,required=True):
        c=n.find(mt(t))
        if required and c is None: raise ValueError('缺少数学结构 '+t)
        return body(c)
    def run(n):
        if any(c.tag not in {mt('rPr'),mt('t'),'{'+A+'}rPr','{'+W+'}rPr'} for c in n): raise ValueError('不支持的数学字符结构')
        text=''.join(c.text or '' for c in n.findall(mt('t')))
        if '\u200b' in text: raise ValueError('零宽间距无法可靠转换')
        props=n.find(mt('rPr'));style=attr(props.find(mt('sty')) if props is not None else None,'val')
        script=attr(props.find(mt('scr')) if props is not None else None,'val')
        normal=props is not None and props.find(mt('nor')) is not None and attr(props.find(mt('nor')),'val','1') not in {'0','false','off'}
        # DrawingML math uses mathematical-alphabet Unicode in native fixtures.
        mapped=[];unicode_styles=set()
        for c in text:
            name=unicodedata.name(c,'')
            if name.startswith('MATHEMATICAL '):
                raw=unicodedata.normalize('NFKD',c)
                if len(raw)!=1:raise ValueError('不支持的数学字形')
                mapped.append(raw)
                if 'BOLD' in name and 'ITALIC' in name:unicode_styles.add('bi')
                elif 'BOLD' in name:unicode_styles.add('b')
                elif 'ITALIC' in name:unicode_styles.add('i')
                elif 'DOUBLE-STRUCK' in name:script='double-struck'
                elif 'SCRIPT' in name:script='script'
                elif 'FRAKTUR' in name:script='fraktur'
                elif 'SANS-SERIF' in name:script='sans-serif'
                elif 'MONOSPACE' in name:script='monospace'
            else:mapped.append(c)
        if len(unicode_styles)>1:raise ValueError('一个字符段中含混合数学字形')
        text=''.join(mapped);style=style or next(iter(unicode_styles),'')
        wordprops=n.find('{'+W+'}rPr')
        if normal and text and all(c.isalnum() or c in '+-=<>.,' for c in text):
            italic=wordprops.find('{'+W+'}i') if wordprops is not None else None
            bold=wordprops.find('{'+W+'}b') if wordprops is not None else None
            is_italic=italic is not None and italic.get('{'+W+'}val','1') not in {'0','false','off'}
            is_bold=bold is not None and bold.get('{'+W+'}val','1') not in {'0','false','off'}
            style='bi' if is_italic and is_bold else 'b' if is_bold else 'i' if is_italic else 'p'
            normal=False
        value=escape(text)
        if normal:return r'\text{'+value+'}'
        if text in FUNCTIONS and style not in {'b','bi'}:return '\\'+text+' '
        if script:
            command={'double-struck':'mathbb','script':'mathcal','fraktur':'mathfrak','sans-serif':'mathsf','monospace':'mathtt','roman':None}.get(script)
            if script not in {'double-struck','script','fraktur','sans-serif','monospace','roman'}:raise ValueError('不支持的数学字体 '+script)
            if command:value='\\'+command+'{'+value+'}'
        if style=='p' and any(c.isalpha() for c in text) and not script:value=r'\mathrm{'+value+'}'
        elif style=='b':value=r'\mathbf{'+value+'}'
        elif style=='bi':value=r'\boldsymbol{'+value+'}'
        elif style not in {'','i','p'}:raise ValueError('不支持的数学样式 '+style)
        return value
    def node(n):
        t=n.tag.removeprefix('{'+M+'}')
        if t=='r':return run(n)
        if t in {'oMath','oMathPara','e','num','den','sub','sup','deg','lim','fName'}:return body(n)
        if t=='f':
            typ=attr(n.find(mt('fPr')+'/'+mt('type')),'val','bar')
            # WPS may serialize the standard noBar enum as lowercase nobar.
            # A stack has no implicit delimiters; d supplies any outer brackets.
            if typ not in {'bar','noBar','nobar'}:raise ValueError('不支持的分式布局 '+typ)
            command=r'\genfrac{}{}{0pt}{}' if typ in {'noBar','nobar'} else r'\frac'
            return command+'{'+part(n,'num')+'}{'+part(n,'den')+'}'
        if t in {'sSup','sSub','sSubSup'}:
            return '{'+part(n,'e')+'}'+('_{'+part(n,'sub')+'}' if t!='sSup' else '')+('^{'+part(n,'sup')+'}' if t!='sSub' else '')
        if t=='rad':
            deg=part(n,'deg',False)
            return r'\sqrt'+('['+deg+']' if deg else '')+'{'+part(n,'e')+'}'
        if t=='func':return part(n,'fName')+'{'+part(n,'e')+'}'
        if t in {'limLow','limUpp'}:return '{'+part(n,'e')+'}'+('_{' if t=='limLow' else '^{')+part(n,'lim')+'}'
        if t=='nary':
            prop=n.find(mt('naryPr'));char=attr(prop.find(mt('chr')) if prop is not None else None,'val','∫')
            if char not in {'∫','∬','∭','∮','∑','∏'}:raise ValueError('不支持的大运算符 '+char)
            return SYMBOLS[char]+('_{'+part(n,'sub')+'}' if part(n,'sub',False) else '')+('^{'+part(n,'sup')+'}' if part(n,'sup',False) else '')+'{'+part(n,'e')+'}'
        if t=='d':
            props=n.find(mt('dPr'));a=attr(props.find(mt('begChr')) if props is not None else None,'val','(');b=attr(props.find(mt('endChr')) if props is not None else None,'val',')');sep=attr(props.find(mt('sepChr')) if props is not None else None,'val','|')
            entries=n.findall(mt('e'))
            if a=='(' and b==')' and len(entries)==1:
                terms=children(entries[0])
                if len(terms)==1 and terms[0].tag==mt('f') and attr(terms[0].find(mt('fPr')+'/'+mt('type')),'val') in {'noBar','nobar'}:
                    return r'\binom'+'{'+part(terms[0],'num')+'}{'+part(terms[0],'den')+'}'
            delimiters={'{':r'\{','}':r'\}','':'.','⟨':r'\langle ','⟩':r'\rangle ','‖':r'\Vert '}
            return r'\left'+delimiters.get(a,a)+' '+escape(sep).join(body(c) for c in n.findall(mt('e')))+r'\right'+delimiters.get(b,b)+' '
        if t=='m':
            rows=n.findall(mt('mr'))
            if not rows or len({len(r.findall(mt('e'))) for r in rows})!=1:raise ValueError('无效数学矩阵')
            return r'\begin{matrix}'+r'\\'.join('&'.join(body(c) for c in r.findall(mt('e'))) for r in rows)+r'\end{matrix}'
        if t=='eqArr':
            return r'\begin{aligned}'+r'\\'.join(''.join('&' if c.tag==mt('r') and ''.join(c.itertext())=='&' else node(c) for c in children(row)) for row in n.findall(mt('e')))+r'\end{aligned}'
        if t=='acc':
            c=attr(n.find(mt('accPr')+'/'+mt('chr')),'val','̂');commands={'̂':'hat','^':'hat','̃':'tilde','~':'tilde','̄':'bar','¯':'bar','⃗':'vec','→':'vec','̇':'dot','̈':'ddot'}
            if c not in commands:raise ValueError('不支持的重音 '+c)
            return '\\'+commands[c]+'{'+part(n,'e')+'}'
        if t=='bar':return ('\\underline' if attr(n.find(mt('barPr')+'/'+mt('pos')),'val')=='bot' else '\\overline')+'{'+part(n,'e')+'}'
        raise ValueError('原生公式结构暂不支持：'+t)
    return node(math)

def convert(package,kind):
    math=extract(package,kind)
    if math is None:return {'handled':False}
    latex=latex_from_math(math)
    if not latex.strip():raise ValueError('公式为空')
    return {'latex':latex,'omml':E.tostring(math,encoding='unicode'),'kind':kind,
            'package':base64.b64encode(package).decode(),'format':'wps-native-math','version':1}

if __name__=='__main__':
    try:
        result=convert(Path(sys.argv[1]).read_bytes(),sys.argv[2])
        Path(sys.argv[3]).write_text(json.dumps(result,ensure_ascii=False),encoding='utf8')
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
