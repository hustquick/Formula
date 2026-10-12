from pathlib import Path
import importlib.util
import tempfile
import unittest
import zipfile
from document_fixture import make_docx
repo=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('document_runner',repo/'macos/formula-document-runner.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class Documents(unittest.TestCase):
    def test_math_and_image_order(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);doc=root/'中文公式.docx'
            make_docx(doc,repo/'tests/fixtures/ocr-page.png')
            result=runner.extract_docx(doc,root/'out')
            entries=result['entries']
            self.assertEqual(len(entries),3)
            self.assertIn('frac',entries[0]['latex'])
            self.assertTrue((root/'out'/entries[1]['image']).is_file())
            self.assertIn('x',entries[2]['latex'])
            self.assertEqual(entries[0]['source'],'Word 段落 1')
            self.assertNotIn('latex',entries[1])

    def test_external_image_is_not_fetched(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);original=root/'original.docx';doc=root/'external.docx'
            make_docx(original,repo/'tests/fixtures/ocr-page.png')
            with zipfile.ZipFile(original) as source,zipfile.ZipFile(doc,'w') as target:
                for name in source.namelist():
                    value=source.read(name)
                    if name=='word/_rels/document.xml.rels':
                        value=value.replace(b'Target="media/page.png"',b'Target="https://invalid.example/never-fetch.png" TargetMode="External"')
                    target.writestr(name,value)
            result=runner.extract_docx(doc,root/'out')
            self.assertEqual(len(result['entries']),2)
            self.assertTrue(result['warnings'])
            self.assertEqual(list((root/'out').iterdir()),[])

    def test_invalid_docx(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);doc=root/'invalid.docx'
            with zipfile.ZipFile(doc,'w') as z:z.writestr('not-word','invalid')
            with self.assertRaisesRegex(ValueError,'有效'):runner.extract_docx(doc,root/'out')

unittest.main()
