const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('macos/FormulaOCR.swift','utf8');
const take=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
// Harness-only root: never mutate the user's shared models.
const properties=take('    private var ocrRoot:','    func loadOCRUI(').replace(/private var ocrRoot: URL \{[^\n]+/, 'private var ocrRoot: URL { support.appendingPathComponent("OCR") }');
const readiness=take('    private func ocrReadyURL(','    func handleOCRStatus(');
const errorMethod=take('    private func ocrFailure(', '    private func decodeOCRPayload(');
const installer=take('    private func discoverPython3(','    func ocrImageData(');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-transaction-test-'));
try {
 const program=`import Foundation
import Darwin
struct ToolFailure:Error {let message:String}
class Harness {
 let support:URL
 var documentCancelled=false
 var ocrInstallCancelled=false
 var ocrBasicInstalling=false
 var failWarmup=false
 var cancelPip=false
 init(_ root:URL){support=root}
 func js(_ s:String) {}
 func json(_ s:String)->String {s}
 // Simulate model/pip steps; directory activation and cleanup are the actual app code.
 func run(_ executable:String,_ args:[String],cwd:URL,timeout:TimeInterval=35,ocrInstall:Bool=false)throws->(Int32,String){
  if ocrInstall && DispatchQueue.main.sync(execute:{self.ocrInstallCancelled}) {throw ToolFailure(message:"用户已取消 OCR 安装。")}
  if args.count>=3 && args[0]=="-m" && args[1]=="venv" {
   let bin=URL(fileURLWithPath:args[2]).appendingPathComponent("bin")
   try FileManager.default.createDirectory(at:bin,withIntermediateDirectories:true)
   try FileManager.default.createSymbolicLink(at:bin.appendingPathComponent("python3"),withDestinationURL:URL(fileURLWithPath:"/usr/bin/python3"))
  }
  if args.contains("install") && cancelPip {DispatchQueue.main.sync{self.ocrInstallCancelled=true};throw ToolFailure(message:"用户已取消 OCR 安装。")}
  if args.contains("--warmup") {
   if failWarmup {return (1,"FORMULA_OCR_ERROR=simulated model failure")}
   let engine=args.contains("unimernet") ? "unimernet" : "pix2text"
   return (0,"FORMULA_MFD_READY=1\\nFORMULA_OCR_READY="+engine)
  }
  if args.first=="-c" {return (0,"1")}
  return (0,"")
 }
${properties}
${readiness}
${installer}
${errorMethod}
 func verify()throws {
  let fm=FileManager.default
  var result=installOCR("pix2text")
  precondition(result["installed"] as? Bool==true && ocrInstalled("pix2text"))
  let baseline=try fm.destinationOfSymbolicLink(atPath:ocrVenv.path)
  precondition(fm.fileExists(atPath:baseline))
  result=installOCR("unimernet")
  precondition(result["installed"] as? Bool==true && ocrInstalled("unimernet"))
  let current=try fm.destinationOfSymbolicLink(atPath:ocrVenv.path)
  precondition(current==baseline)
  let active=try fm.contentsOfDirectory(atPath:ocrRoot.path).filter{$0.hasPrefix("environment-")}
  precondition(active.count==2)
  failWarmup=true
  result=installOCR("pix2text")
  precondition(result["error"] != nil && ocrInstalled("pix2text"))
  let afterFailure=try fm.contentsOfDirectory(atPath:ocrRoot.path).filter{$0.hasPrefix("environment-")}
  precondition(Set(afterFailure)==Set(active))
  failWarmup=false;cancelPip=true
  let models=ocrRoot.appendingPathComponent("models")
  try fm.createDirectory(at:models,withIntermediateDirectories:true)
  try Data([1]).write(to:models.appendingPathComponent("partial.incomplete"))
  try Data([2]).write(to:models.appendingPathComponent("complete.bin"))
  result=installOCR("pix2text")
  precondition(result["cancelled"] as? Bool==true && ocrInstalled("pix2text"))
  let afterCancel=try fm.contentsOfDirectory(atPath:ocrRoot.path).filter{$0.hasPrefix("environment-")}
  precondition(Set(afterCancel)==Set(active))
  precondition(!fm.fileExists(atPath:models.appendingPathComponent("partial.incomplete").path))
  precondition(fm.fileExists(atPath:models.appendingPathComponent("complete.bin").path))
  print("Native install transactions: committed environments retained, failed/cancelled staging removed, baseline preserved, partial model cleaned")
 }
}
let harness=Harness(URL(fileURLWithPath:CommandLine.arguments[1]+"/unused/.."))
DispatchQueue.global().async {do{try harness.verify();exit(0)}catch{print(error);exit(1)}}
dispatchMain()
`;
 const file=path.join(dir,'main.swift');fs.writeFileSync(file,program);
 execFileSync('xcrun',['swift',file,dir],{stdio:'inherit',timeout:30000});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
