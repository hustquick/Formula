import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location('source_ooxml', Path(__file__).resolve().parents[1] / 'macos/formula-latex-ooxml.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
M = module.M
ns = {'m': M}
tagval = '{' + M + '}val'

class SourceOOXML(unittest.TestCase):
    def test_user_integral(self):
        source = r'\int\frac{1}{1+x^2}\mathrm{d}x=\arctan x+C'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'capture'
            result = module.convert(source, output)
            self.assertEqual((output / 'source.tex').read_text(), source)
            root = ET.fromstring((output / 'candidate.omml').read_bytes())
            self.assertEqual(len(root.findall('.//m:f', ns)), 1)
            self.assertEqual(len(root.findall('.//m:sSup', ns)), 1)
            self.assertEqual(len(root.findall('.//m:func', ns)), 1)
            for run in root.findall('.//m:r', ns):
                text = ''.join(run.itertext())
                sty = run.find('m:rPr/m:sty', ns)
                if text in ('d', 'arctan'):
                    self.assertIsNotNone(sty)
                    self.assertEqual(sty.get('{' + M + '}val'), 'p')
                else:
                    self.assertIsNone(sty)
            self.assertNotIn('\u2062', (output / 'candidate.omml').read_text())
            self.assertNotIn(' ', ''.join(root.itertext()))
            with zipfile.ZipFile(output / 'candidate.docx') as z:
                self.assertIsNone(z.testzip())
                self.assertEqual(len(z.namelist()), 3)
            self.assertTrue(result['experimental'])

    def test_structures_and_styles(self):
        fixtures = [
            (r'\sqrt[3]{x}+\frac{a}{b}', 'rad'),
            (r'\sum_{i=1}^n i', 'nary'),
            (r'\begin{pmatrix}a&b\\c&d\end{pmatrix}', 'm'),
            (r'\boldsymbol{A}+\mathit{b}+\mathrm{c}', 'r'),
        ]
        with tempfile.TemporaryDirectory() as temp:
            for i, (source, element) in enumerate(fixtures):
                output = Path(temp) / str(i)
                module.convert(source, output)
                root = ET.fromstring((output / 'candidate.omml').read_bytes())
                self.assertTrue(root.findall('.//m:' + element, ns), source)

    def test_complex_fidelity(self):
        fixtures = [
            (r'\sin\cos x', 'nested-functions'),
            (r'\sin x^2+\log\left(1+x\right)+\arctan\frac{x}{y}', 'functions'),
            (r'\int_0^\infty e^{-x}\,\mathrm{d}x=1', 'integral'),
            (r'\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}', 'cases'),
            (r'\begin{aligned}a&=b+c\\d&=e+f\end{aligned}', 'aligned'),
            (r'\mathbb{R}+\mathcal{F}+\mathsf{A}+\boldsymbol{x}', 'fonts'),
            (r'a\,b\;c\quad d', 'spacing'),
        ]
        with tempfile.TemporaryDirectory() as temp:
            for source, name in fixtures:
                with self.subTest(name=name):
                    output = Path(temp) / name
                    module.convert(source, output)
                    root = ET.fromstring((output / 'candidate.omml').read_bytes())
                    if name == 'nested-functions':
                        self.assertIsNotNone(root.find('m:func/m:e/m:func/m:e/m:r/m:t', ns))
                        self.assertEqual(''.join(root.itertext()), 'sincosx')
                    elif name == 'functions':
                        self.assertEqual(len(root.findall('.//m:func', ns)), 3)
                        self.assertIsNotNone(root.find('.//m:func/m:e/m:f', ns))
                    elif name == 'integral':
                        self.assertIsNotNone(root.find('.//m:nary/m:sub', ns))
                        self.assertIsNotNone(root.find('.//m:nary/m:sup', ns))
                        self.assertIn('\u2009', ''.join(root.itertext()))
                    elif name == 'cases':
                        self.assertEqual(len(root.findall('.//m:m/m:mr', ns)), 2)
                        self.assertTrue(all(len(row.findall('m:e', ns)) == 2 for row in root.findall('.//m:mr', ns)))
                        self.assertEqual(root.find('.//m:begChr', ns).get(tagval), '{')
                    elif name == 'aligned':
                        self.assertEqual(len(root.findall('m:eqArr/m:e', ns)), 2)
                        # OOXML equation-array ampersands ARE alignment points.
                        self.assertEqual(''.join(root.itertext()).count('&'), 2)
                    elif name == 'fonts':
                        self.assertEqual({n.get(tagval) for n in root.findall('.//m:scr', ns)}, {'double-struck', 'script', 'sans-serif'})
                        self.assertIn('bi', {n.get(tagval) for n in root.findall('.//m:sty', ns)})
                    elif name == 'spacing':
                        self.assertEqual(''.join(root.itertext()), 'a\u2009b\u2004c\u2001d')

    def test_known_losses_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            for i, source in enumerate((r'a\!b', r'\mathbf{A}')):
                output = Path(temp) / str(i)
                with self.assertRaisesRegex(ValueError, '当前转换器'):
                    module.convert(source, output)
                self.assertFalse(output.exists())
        # Control-sequence scanning must not reject commented commands.
        module.check_known_fidelity_limits('% '+chr(92)+'mathbf{A}'+chr(10)+'x')
        module.check_known_fidelity_limits(chr(92)+chr(92)+'mathbf')

    def test_required_wps_bundle_structures(self):
        fixtures = [
            (r'x^2', 'sSup'), (r'x_1', 'sSub'), (r'x_1^2', 'sSubSup'),
            (r'\frac{x}{y}', 'f'), (r'\sqrt{x^2+y^2}', 'rad'),
            (r'\sum_{i=1}^{n}x_i', 'nary'),
            (r'\int_0^\infty e^{-x^2}\,dx', 'nary'),
            (r'\begin{pmatrix}a&b\\c&d\end{pmatrix}', 'm'),
            (r'f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}', 'm'),
            (r'\begin{aligned}a&=b+c\\&=d+e\end{aligned}', 'eqArr'),
            (r'\frac{\alpha_1^2+\sqrt{y}}{\left(a+\beta\right)}', 'f'),
        ]
        with tempfile.TemporaryDirectory() as temp:
            for i, (source, structure) in enumerate(fixtures):
                with self.subTest(source=source):
                    output = Path(temp) / str(i)
                    module.convert(source, output)
                    with zipfile.ZipFile(output / 'candidate.gvml') as z:
                        self.assertIsNone(z.testzip())
                        self.assertEqual(len(z.namelist()), 3)
                        root = ET.fromstring(z.read('clipboard/drawings/drawing1.xml'))
                        self.assertEqual(len(root.findall('.//m:oMath', ns)), 1)
                        self.assertTrue(root.findall('.//m:' + structure, ns))
                        original = ET.fromstring((output / 'candidate.omml').read_bytes())
                        self.assertEqual(ET.tostring(root.find('.//m:oMath', ns)), ET.tostring(original))
                        self.assertFalse(any('media/' in n for n in z.namelist()))

    def test_unknown_command_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'unknown'
            with self.assertRaises(ValueError):
                module.convert(r'\FormulaUnsupportedCommand{x}', output)
            self.assertFalse((output / 'candidate.docx').exists())

if __name__ == '__main__':
    unittest.main()
