"""Generate an independent GVML clipboard package from an OMML object.
Usage: python3 tools/wps-gvml-probe.py INPUT.omml NEW_DIRECTORY
No native fixture data is used. Does not modify the clipboard.
"""
from pathlib import Path
import sys,zipfile,json,hashlib
import xml.etree.ElementTree as E
omml=E.fromstring(Path(sys.argv[1]).read_bytes())
M='http://schemas.openxmlformats.org/officeDocument/2006/math'
assert omml.tag=='{'+M+'}oMath'
out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=False)
math=E.tostring(omml,encoding='unicode')
# Self-contained DrawingML shape and absolute colors/fonts: no theme references.
drawing=f'''<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas" xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" xmlns:m="{M}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas"><lc:lockedCanvas><a:nvGrpSpPr><a:cNvPr id="0" name=""/><a:cNvGrpSpPr/></a:nvGrpSpPr><a:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="1200000"/><a:chOff x="0" y="0"/><a:chExt cx="3000000" cy="1200000"/></a:xfrm></a:grpSpPr><a:sp><a:nvSpPr><a:cNvPr id="1" name="Formula Equation"/><a:cNvSpPr txBox="1"/></a:nvSpPr><a:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></a:spPr><a:txSp><a:txBody><a:bodyPr wrap="none"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:pPr><a:defRPr sz="2400"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Cambria Math"/></a:defRPr></a:pPr><a14:m><m:oMathPara>{math}</m:oMathPara></a14:m><a:endParaRPr lang="en-US" sz="2400"/></a:p></a:txBody><a:useSpRect/></a:txSp></a:sp></lc:lockedCanvas></a:graphicData></a:graphic>'''
E.fromstring(drawing)
with zipfile.ZipFile(out/'gvml.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/clipboard/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>')
 z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="clipboard/drawings/drawing1.xml"/></Relationships>')
 z.writestr('clipboard/drawings/drawing1.xml',drawing)
b=(out/'gvml.zip').read_bytes()
(out/'manifest.json').write_text(json.dumps({'stable':True,'experimental':True,'carbonRepresentations':[{'item':0,'type':'com.trolltech.anymime.Art::GVML ClipFormat','file':'gvml.zip','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}]},indent=2))
print('Generated self-contained GVML',len(b),'bytes')
