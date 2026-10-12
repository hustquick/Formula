#!/usr/bin/env python3
"""Compile the current native installer/runner, install real dependencies, and infer.

Requires macOS and Python 3.10–3.12. Downloads model weights on first run.
All app data is isolated under --work-dir; never modifies the user's app state.
"""
from pathlib import Path
import argparse
import subprocess
import tempfile
parser=argparse.ArgumentParser(description="Slow macOS integration: real native installers and both model engines")
parser.add_argument('--work-dir', type=Path, help='retain isolated installation and logs here')
parser.add_argument('--model-cache', type=Path, help='reuse an existing UniMERNet models directory')
args=parser.parse_args()
r=Path(__file__).resolve().parents[1]
work=(args.work_dir or Path(tempfile.mkdtemp(prefix='formula-integration-'))).resolve()
work.mkdir(parents=True,exist_ok=True)
out=work/'native-integration.app'; resources=out/'Contents/Resources'; exe=out/'Contents/MacOS'; resources.mkdir(parents=True,exist_ok=True); exe.mkdir(parents=True,exist_ok=True)
import shutil
for name in ['formula-ocr-runner.py','ocr-requirements.txt','unimernet-requirements.txt']:
    shutil.copy(r/'macos'/name,resources/name)
native=(r/'macos/Formula.swift').read_text(); ocr=(r/'macos/FormulaOCR.swift').read_text()
run=native[native.index('    func run('):native.index('    func discover(')]
props=ocr[ocr.index('    private var ocrRoot:'):ocr.index('    func loadOCRUI(')]
installed=ocr[ocr.index('    private func ocrReadyURL'):ocr.index('    func handleOCRStatus(')]
methods=ocr[ocr.index('    private func discoverPython3('):ocr.rindex('\n}')]
program='''import Cocoa
import WebKit
import Darwin
struct ToolFailure:Error {let message:String}
class AppDelegate {
 let support:URL
 var documentCancelled=false
 var ocrInstallCancelled=false
 var ocrInstallProcess:Process?
 var ocrBasicInstalling=false
 var logEvents=0
 var testedConcurrent=false
 let concurrent=DispatchGroup()
 var failure:String?
 init(_ root:URL){support=root}
 func json(_ v:Any)->String {let d=try! JSONSerialization.data(withJSONObject:v,options:[.fragmentsAllowed]);return String(data:d,encoding:.utf8)!}
 func js(_ s:String){
  if s.contains("FormulaOCRInstallLog") {logEvents+=1}
  if s.contains("准备 UniMERNet 独立环境") && !testedConcurrent {
   testedConcurrent=true
   concurrent.enter()
   DispatchQueue.global().async {
    let r=self.recognizeFormula(URL(fileURLWithPath:CommandLine.arguments[2]),engine:"pix2text",page:false)
    if r["latex"] == nil {self.failure="Concurrent Basic failed: \\(r)"}
    else {print("Concurrent Basic recognition while Pro installs: \\(r[\"latex\"]!)")}
    self.concurrent.leave()
   }
  }
 }
'''+run+props+installed+methods+'''
 func verify() throws {
  var result=installOCR("pix2text")
  guard result["installed"] as? Bool == true else {throw ToolFailure(message:"Basic install failed: \\(result)")}
  print("Native Basic installer succeeded")
  precondition(ocrInstalled("pix2text"))
  let before=ocrVenv.resolvingSymlinksInPath()
  result=installOCR("unimernet")
  guard result["installed"] as? Bool == true else {throw ToolFailure(message:"Pro install failed: \\(result)")}
  precondition(ocrVenv.resolvingSymlinksInPath()==before)
  precondition(ocrInstalled("unimernet"))
  print("Native Pro installer succeeded; Basic environment unchanged")
  for engine in ["pix2text","unimernet"] {
   let single=recognizeFormula(URL(fileURLWithPath:CommandLine.arguments[2]),engine:engine,page:false)
   guard let latex=single["latex"] as? String,!latex.isEmpty else {throw ToolFailure(message:"Native single inference failed: \\(single)")}
   precondition(latex.contains("x") && latex.contains("y") && latex.contains("2") && latex.contains("+") && latex.contains("="))
   let page=recognizeFormula(URL(fileURLWithPath:CommandLine.arguments[3]),engine:engine,page:true)
   guard let formulas=page["formulas"] as? [[String:Any]],formulas.count==2 else {throw ToolFailure(message:"Native page inference failed: \\(page)")}
   print("Native \\(engine) JPG: \\(latex); page: \\(formulas)")
  }
  precondition(concurrent.wait(timeout:.now()+120) == .success)
  let events=DispatchQueue.main.sync {self.logEvents}
  let tested=DispatchQueue.main.sync {self.testedConcurrent}
  precondition(events>0 && tested)
  if let error=failure {throw ToolFailure(message:error)}
  let files=try FileManager.default.contentsOfDirectory(atPath:ocrRoot.path)
  precondition(files.filter{$0.hasPrefix("image-") || $0.hasPrefix("page-") || $0.hasPrefix("backup-") || $0.hasPrefix("process-")}.isEmpty)
  print("Native installer/inference integration passed, \\(events) live log updates, no transient files")
 }
}
setbuf(stdout,nil)
let app=AppDelegate(URL(fileURLWithPath:CommandLine.arguments[1]))
DispatchQueue.global().async {do{try app.verify();exit(0)}catch{print(error);exit(1)}}
dispatchMain()
'''
source=work/'integration.swift'
source.write_text(program)
subprocess.run(['xcrun','swiftc','-swift-version','5','-framework','Cocoa','-framework','WebKit',str(source),'-o',str(exe/'verify')],check=True)
root=work/'native-install-root'
(root/'OCR').mkdir(parents=True,exist_ok=True)
if args.model_cache and not (root/'OCR/models').exists():
    (root/'OCR/models').symlink_to(args.model_cache.resolve(), target_is_directory=True)
log=work/'native-integration.log'
print(f'Real installation/inference log: {log}',flush=True)
with log.open('w') as output:
    result=subprocess.run([str(exe/'verify'),str(root),str(r/'tests/fixtures/ocr-single.jpg'),str(r/'tests/fixtures/ocr-page.png')],stdout=output,stderr=subprocess.STDOUT)
print(log.read_text())
raise SystemExit(result.returncode)
