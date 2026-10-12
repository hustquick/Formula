#!/usr/bin/env python3
"""macOS real document bridge test; reuse OCR environments, install isolated Word support."""
import argparse
from pathlib import Path
import shutil
import subprocess
import zipfile
import html
parser=argparse.ArgumentParser()
parser.add_argument('--ocr-root',type=Path,required=True)
parser.add_argument('--work-dir',type=Path,required=True)
args=parser.parse_args()
repo=Path(__file__).resolve().parents[1]
work=args.work_dir.resolve();work.mkdir(parents=True,exist_ok=True)
root=work/'support';ocr=root/'OCR';ocr.mkdir(parents=True,exist_ok=True)
for name in ['venv','venv-unimernet','models']:
    p=ocr/name
    if not p.exists():p.symlink_to((args.ocr_root/name).resolve())
for name in ['ready-pix2text-v2.txt','ready-mfd-v2.txt','ready-unimernet-v2.txt']:
    shutil.copy(args.ocr_root/name,ocr/name)
config=(args.ocr_root/'unimernet-tiny.yaml').read_text().replace(str(args.ocr_root),str(ocr))
(ocr/'unimernet-tiny.yaml').write_text(config)
resources=work/'DocumentTest.app/Contents/Resources';exe=work/'DocumentTest.app/Contents/MacOS/verify'
resources.mkdir(parents=True,exist_ok=True);exe.parent.mkdir(parents=True,exist_ok=True)
for name in ['formula-ocr-runner.py','formula-document-runner.py','document-requirements.txt']:
    shutil.copy(repo/'macos'/name,resources/name)
# Minimal DOCX: native fraction, then an embedded scan, then a native superscript.
from document_fixture import make_docx
make_docx(work/'math.docx',repo/'tests/fixtures/ocr-page.png')
(work/'corrupt.docx').write_bytes(b'not a zip')
native=(repo/'macos/Formula.swift').read_text().split('let app=NSApplication.shared')[0]
start=native.index('    let support =');end=native.index('\n',start)
native=native[:start]+'    let support = URL(fileURLWithPath:CommandLine.arguments[1])'+native[end:]
start=native.index('    func js(');end=native.index('\n',start)
native=native[:start]+'    func js(_ code:String) { print(code) }'+native[end:]
program=native+(repo/'macos/FormulaOCR.swift').read_text()+(repo/'macos/FormulaDocument.swift').read_text()+r'''
setbuf(stdout,nil)
let delegate=AppDelegate()
DispatchQueue.global().async {
 do {
  let work=URL(fileURLWithPath:CommandLine.arguments[2])
  let fixture=URL(fileURLWithPath:CommandLine.arguments[3])
  let doc=PDFDocument()
  for _ in 0..<2 { doc.insert(PDFPage(image:NSImage(contentsOf:fixture)!)!,at:doc.pageCount) }
  precondition(doc.write(to:work.appendingPathComponent("scan.pdf")))
  let protected=work.appendingPathComponent("locked.pdf")
  precondition(doc.write(to:protected,withOptions:[PDFDocumentWriteOption.userPasswordOption:"secret",PDFDocumentWriteOption.ownerPasswordOption:"secret"]))
  DispatchQueue.main.sync {delegate.handleDocumentInstall(["id":"install-word"])}
  while DispatchQueue.main.sync(execute:{delegate.ocrInstallBusy}) {Thread.sleep(forTimeInterval:0.1)}
  precondition(FileManager.default.fileExists(atPath:delegate.support.appendingPathComponent("OCR/ready-document-v2.txt").path))
  for engine in ["pix2text","unimernet"] {
   let pdf=delegate.recognizeDocument(work.appendingPathComponent("scan.pdf"),engine:engine,first:2,last:2,id:"pdf")
   guard let formulas=pdf["formulas"] as? [[String:Any]],formulas.count==2 else {fatalError("PDF failure: \(pdf)")}
   precondition(formulas.allSatisfy{$0["source"] as? String == "第 2 页"})
   let word=delegate.recognizeDocument(work.appendingPathComponent("math.docx"),engine:engine,first:1,last:0,id:"word")
   guard let items=word["formulas"] as? [[String:Any]],items.count==4 else {fatalError("Word failure: \(word)")}
   precondition((items.first?["latex"] as? String ?? "").contains("frac"))
   precondition((items.last?["latex"] as? String ?? "").contains("x"))
   print("DOCUMENT_REAL_PASS \(engine): PDF 2 formulas, Word 4 formulas in source order")
  }
  for name in ["locked.pdf","corrupt.docx"] {
   let r=delegate.recognizeDocument(work.appendingPathComponent(name),engine:"pix2text",first:1,last:0,id:"invalid")
   precondition(r["error"] is String)
  }
  let invalid=delegate.recognizeDocument(work.appendingPathComponent("scan.pdf"),engine:"pix2text",first:3,last:0,id:"range")
  precondition(invalid["error"] is String)
  DispatchQueue.main.sync {delegate.documentCancelled=true}
  let cancelled=delegate.recognizeDocument(work.appendingPathComponent("scan.pdf"),engine:"pix2text",first:1,last:0,id:"cancel")
  precondition((cancelled["error"] as? String ?? "").contains("取消"))
  DispatchQueue.main.sync {delegate.documentCancelled=false}
  DispatchQueue.main.asyncAfter(deadline:.now()+1) {delegate.documentCancelled=true}
  let started=Date()
  let activeCancel=delegate.recognizeDocument(work.appendingPathComponent("scan.pdf"),engine:"pix2text",first:1,last:2,id:"active-cancel")
  precondition((activeCancel["error"] as? String ?? "").contains("取消"))
  precondition(Date().timeIntervalSince(started)<5)
  let leftovers=try FileManager.default.contentsOfDirectory(atPath:delegate.support.appendingPathComponent("OCR").path)
  precondition(!leftovers.contains{$0.hasPrefix("document-")||$0.hasPrefix("page-")||$0.hasPrefix("image-")||$0.hasPrefix("process-")})
  print("DOCUMENT_INTEGRATION_PASS: encrypted/corrupt/range/cancel errors, no temporary files")
  exit(0)
 }catch{print(error);exit(1)}
}
dispatchMain()
'''
source=work/'main.swift';source.write_text(program)
subprocess.run(['xcrun','swiftc','-swift-version','5','-framework','Cocoa','-framework','WebKit','-framework','PDFKit',str(source),'-o',str(exe)],check=True)
with (work/'result.log').open('w') as f:
    result=subprocess.run([str(exe),str(root),str(work),str(repo/'tests/fixtures/ocr-page.png')],stdout=f,stderr=subprocess.STDOUT)
print((work/'result.log').read_text()[-8000:])
raise SystemExit(result.returncode)
