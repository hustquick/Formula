import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('document_runner',Path(__file__).resolve().parents[1]/'macos/formula-document-runner.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class Engine:
    def __init__(self):self.calls=0
    def recognize(self,image,return_text=False):
        self.calls+=1
        return [{'type':'isolated','text':'a+b=c','score':0.9}]

class DocumentTests(unittest.TestCase):
    def test_word_omml_text_tables_and_embedded_images(self):
        import pypandoc
        from PIL import Image
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);image=root/'formula.png';Image.new('RGB',(80,40),'white').save(image)
            doc=root/'native.docx'
            pypandoc.convert_text(f'# Test document\n\nInline $x^2$ and price $5.\n\n$$\\frac{{a}}{{b}}$$\n\n| Item | Value |\n|---|---|\n| Revenue | 12 |\n\n![Formula]({image})','docx',format='markdown',outputfile=str(doc))
            engine=Engine();pages,warnings,total=runner.recognize_docx(doc,engine)
            self.assertEqual(engine.calls,1)
            self.assertEqual(warnings,[])
            self.assertIsNone(total)
            formulas=[x['text'] for x in pages[0]['items'] if x['type'] in ('embedding','isolated')]
            self.assertIn('x^{2}',formulas)
            self.assertIn('\\frac{a}{b}',formulas)
            self.assertIn('a+b=c',formulas)
            for text in ['Test document','price \\$5','Revenue','12']:self.assertIn(text,pages[0]['markdown'])
    def test_pdf_range_and_page_sources(self):
        import pymupdf
        with tempfile.TemporaryDirectory() as temp:
            file=Path(temp)/'three.pdf';pdf=pymupdf.open()
            for _ in range(3):pdf.new_page()
            pdf.save(file);pdf.close()
            engine=Engine();pages,warnings,total=runner.recognize_pdf(file,engine,2,3)
            self.assertEqual([x['number'] for x in pages],[2,3])
            self.assertEqual(engine.calls,2);self.assertEqual(total,3)
            self.assertEqual(pages[0]['items'][0]['source'],'第 2 页')
            with self.assertRaises(ValueError):runner.recognize_pdf(file,engine,4,0)
            with self.assertRaises(ValueError):runner.recognize_pdf(file,engine,1,4)
    def test_encrypted_pdf_reports_password(self):
        import pymupdf
        with tempfile.TemporaryDirectory() as temp:
            file=Path(temp)/'locked.pdf';pdf=pymupdf.open();pdf.new_page()
            pdf.save(file,encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='secret');pdf.close()
            with self.assertRaisesRegex(ValueError,'已加密'):runner.recognize_pdf(file,Engine(),1,0)

if __name__=='__main__':unittest.main()
