const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const native=fs.readFileSync('macos/Formula.swift','utf8');
const ocr=fs.readFileSync('macos/FormulaOCR.swift','utf8');
const extract=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const processMethods=extract(native,'    func run(','    func discover(');
const selection=extract(ocr,'    private func discoverPython3(','    // Build replacements');
const rootProperty=ocr.split('\n').find(x=>x.includes('private var ocrRoot:'));
const activation=extract(ocr,'    private func activateOCREnvironment(','    private func reportOCRPhase(');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-install-test-'));
try{
const program=`import Foundation
import Darwin
struct ToolFailure:Error {let message:String}
class Harness {
 let support:URL
${rootProperty}
 var ocrInstallCancelled=false
 var ocrInstallProcess:Process?
 func js(_ s:String) {}
 func json(_ s:String)->String {s}
 init(_ root:URL){support=root}
${processMethods}
${selection}
${activation}
 func verify() throws {
  let fm=FileManager.default
  try fm.createDirectory(at:ocrRoot,withIntermediateDirectories:true)
  let python=discoverPython3()!
  precondition(compatibleOCRPython(python))
  let invalid=ocrRoot.appendingPathComponent("old-python")
  try "#!/bin/sh\\necho 0\\n".write(to:invalid,atomically:true,encoding:.utf8)
  try fm.setAttributes([.posixPermissions:0o755],ofItemAtPath:invalid.path)
  precondition(!compatibleOCRPython(invalid.path))
  let target=ocrRoot.appendingPathComponent("venv")
  let marker=ocrRoot.appendingPathComponent("ready.txt")
  try fm.createDirectory(at:target,withIntermediateDirectories:true)
  try "old".write(to:target.appendingPathComponent("sentinel"),atomically:true,encoding:.utf8)
  try "old-ready".write(to:marker,atomically:true,encoding:.utf8)
  let stage=ocrRoot.appendingPathComponent("environment-new")
  let created=try run(python,["-m","venv",stage.path],cwd:ocrRoot,timeout:60)
  precondition(created.0==0)
  try activateOCREnvironment(stage,target,markers:[marker])
  precondition(target.resolvingSymlinksInPath()==stage)
  // The original absolute pip shebang still works after activation.
  let pip=try run(target.appendingPathComponent("bin/pip").path,["--version"],cwd:ocrRoot,timeout:10)
  precondition(pip.0==0 && pip.1.contains("environment-new"))
  let replacement=ocrRoot.appendingPathComponent("environment-failed")
  try fm.createDirectory(at:replacement,withIntermediateDirectories:true)
  let badMarker=ocrRoot.appendingPathComponent("missing/ready")
  do {try activateOCREnvironment(replacement,target,markers:[marker,badMarker]);fatalError("Expected rollback")}
  catch {precondition(target.resolvingSymlinksInPath()==stage);let restored=try String(contentsOf:marker,encoding:.utf8);precondition(restored=="ready")}
  DispatchQueue.main.sync {self.ocrInstallCancelled=true}
  do {try activateOCREnvironment(replacement,target,markers:[marker]);fatalError("Expected cancelled activation")}
  catch {precondition(target.resolvingSymlinksInPath()==stage)}
  DispatchQueue.main.sync {self.ocrInstallCancelled=false}
  // Cancel a running installation, retaining partial output and ending promptly.
  let started=Date()
  DispatchQueue.main.asyncAfter(deadline:.now()+0.4){self.ocrInstallCancelled=true}
  do {_ = try run("/bin/sh",["-c","printf 'download started'; sleep 30 & wait"],cwd:ocrRoot,timeout:40,ocrInstall:true);fatalError("Expected cancellation")}
  catch let e as ToolFailure {precondition(e.message.contains("取消") && e.message.contains("download started"))}
  precondition(Date().timeIntervalSince(started)<3)
  let remaining=try fm.contentsOfDirectory(atPath:ocrRoot.path);precondition(remaining.filter{$0.hasPrefix("process-")}.isEmpty)
  print("Native Python selection, stable venv activation, rollback, immediate cancellation and log cleanup OK")
 }
}
let harness=Harness(URL(fileURLWithPath:CommandLine.arguments[1]+"/unused/.."))
DispatchQueue.global().async {
 do {try harness.verify();exit(0)} catch {print(error);exit(1)}
}
dispatchMain()
`;
const file=path.join(dir,'main.swift');fs.writeFileSync(file,program);
execFileSync('xcrun',['swift',file,dir],{stdio:'inherit',timeout:120000});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
