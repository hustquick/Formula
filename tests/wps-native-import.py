import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as E
import zipfile
import io
ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'macos'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
im=load('wps_import','formula-wps-import.py');ex=load('wps_export','formula-latex-ooxml.py');M=im.M

class NativeImport(unittest.TestCase):
 def test_three_native_fixtures(self):
  for host,kind,needle in [('writer','writer','9.0 Format'),('presentation','gvml','GVML'),('spreadsheet','gvml','GVML')]:
   with self.subTest(host=host), tempfile.TemporaryDirectory() as d:
    p=ROOT/'tests/fixtures/WPS'/host/'fraction';j=json.loads((p/'manifest.json').read_text());entry=next(x for x in j['carbonRepresentations'] if needle in x['type']);data=(p/entry['file']).read_bytes();r=im.convert(data,kind)
    self.assertIn('\\frac',r['latex']);self.assertEqual(r['latex'].count('^{'),2);self.assertNotIn('\\text{x}',r['latex'])
    out=Path(d)/'out';ex.convert(r['latex'],out,r['omml']);self.assertEqual(E.tostring(E.fromstring(r['omml'])),E.tostring(E.fromstring((out/'candidate.omml').read_bytes())))
    self.assertEqual(__import__('base64').b64decode(r['package']),data)
 def test_required_structures_roundtrip(self):
  sources=[r'x^2',r'x_1',r'x_1^2',r'\frac{x}{y}',r'\sqrt{x^2+y^2}',r'\sum_{i=1}^n x_i',r'\int_0^\infty e^{-x^2}\,dx',r'\begin{pmatrix}a&b\\c&d\end{pmatrix}',r'f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}',r'\begin{aligned}a&=b+c\\&=d+e\end{aligned}',r'\frac{\alpha_1^2+\sqrt{y}}{\left(a+\beta\right)}',r'\int\frac{1}{1+x^2}\mathrm{d}x=\arctan x+C']
  with tempfile.TemporaryDirectory() as d:
   for index,source in enumerate(sources):
    for kind,name in [('writer','candidate.docx'),('gvml','candidate.gvml')]:
     with self.subTest(source=source,kind=kind):
      p=Path(d)/(str(index)+kind);ex.convert(source,p);r=im.convert((p/name).read_bytes(),kind);q=Path(d)/(str(index)+kind+'re');ex.convert(r['latex'],q,r['omml'])
      self.assertEqual(E.tostring(E.fromstring(r['omml'])),E.tostring(E.fromstring((q/'candidate.omml').read_bytes())))
 def test_writer_nobar_regression(self):
  folder=ROOT/'tests/fixtures/WPS/writer/nobar-failure';manifest=json.loads((folder/'manifest.json').read_text());entry=next(x for x in manifest['carbonRepresentations'] if '9.0 Format' in x['type']);record=im.convert((folder/entry['file']).read_bytes(),'writer')
  self.assertIn(r'\binom{n}{k}',record['latex']);self.assertNotIn('genfrac',record['latex'])
  self.assertEqual(record['latex'].count(r'\left('),1) # (x+a), not duplicated around binom
  with tempfile.TemporaryDirectory() as temp:
   output=Path(temp)/'preserved';ex.convert(record['latex'],output,record['omml']);self.assertEqual(E.tostring(E.fromstring(record['omml'])),E.tostring(E.fromstring((output/'candidate.omml').read_bytes())))
   output=Path(temp)/'regenerated';ex.convert(record['latex'],output);root=E.fromstring((output/'candidate.omml').read_bytes());self.assertTrue(any(n.get(im.mt('val'))=='noBar' for n in root.iter(im.mt('type'))))
   for i,value in enumerate(['noBar','nobar']):
    xml='<m:oMath xmlns:m="'+M+'"><m:f><m:fPr><m:type m:val="'+value+'"/></m:fPr><m:num><m:r><m:t>n</m:t></m:r></m:num><m:den><m:r><m:t>k</m:t></m:r></m:den></m:f></m:oMath>'
    source=im.latex_from_math(E.fromstring(xml));self.assertNotIn('binom',source)
    output=Path(temp)/str(i);ex.convert(source,output);root=E.fromstring((output/'candidate.omml').read_bytes());self.assertTrue(any(n.get(im.mt('val'))=='noBar' for n in root.iter(im.mt('type'))));self.assertTrue(all(n.get(im.mt('val'))=='' for n in root.iter() if n.tag in {im.mt('begChr'),im.mt('endChr')}))

 def test_explicit_rejection_and_plain(self):
  root=E.fromstring('<m:oMath xmlns:m="'+M+'"><m:phant/></m:oMath>')
  with self.assertRaisesRegex(ValueError,'暂不支持'):im.latex_from_math(root)
  with self.assertRaises(ValueError):im.parse_xml(b'<!DOCTYPE x><x/>')
  buf=io.BytesIO()
  with zipfile.ZipFile(buf,'w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+im.W+'"><w:body><w:p><w:r><w:t>text</w:t></w:r></w:p></w:body></w:document>')
  self.assertEqual(im.convert(buf.getvalue(),'writer'),{'handled':False})
if __name__=='__main__':unittest.main()
