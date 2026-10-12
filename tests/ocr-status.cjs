const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('macos/FormulaOCR.swift','utf8');
const root=source.split('\n').find(x=>x.includes('private var ocrRoot:'));
const status=source.slice(source.indexOf('    func handleOCRStatus('),source.indexOf('    func handleOCRInstall('));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-status-test-'));
try{
 const program=`import Foundation
import Darwin
let mainKey=DispatchSpecificKey<Bool>()
DispatchQueue.main.setSpecific(key:mainKey,value:true)
class Harness {
 let support:URL
${root}
 var ocrPython:URL {ocrRoot.appendingPathComponent("venv/bin/python3")}
 var ocrMFDReady:URL {ocrRoot.appendingPathComponent("ready-mfd-v2.txt")}
 var ocrBusy=false,ocrInstallBusy=true,ocrBasicInstalling=false,ocrSizeCalculating=false
 var ocrInstallingEngine="unimernet"
 var ocrCachedBytes:Int64=0
 var ocrSizeUpdated=Date.distantPast
 var heartbeat=false
 init(_ support:URL){self.support=support}
 func discoverPython3()->String? {precondition(DispatchQueue.getSpecific(key:mainKey) != true);Thread.sleep(forTimeInterval:0.15);return "/test-python3.11"}
 func ocrInstalled(_ engine:String)->Bool {precondition(DispatchQueue.getSpecific(key:mainKey) != true);Thread.sleep(forTimeInterval:0.1);return engine=="pix2text"}
 func reply(_ id:String,_ result:[String:Any]) {
  precondition(DispatchQueue.getSpecific(key:mainKey)==true && heartbeat && id=="status-test")
  precondition(result["installed"] as? Bool==true && result["installing"] as? Bool==true)
  precondition(result["installingEngine"] as? String=="unimernet")
  precondition(result["bytesCalculating"] as? Bool==true || (result["bytes"] as? Int64 ?? 0) > 0)
  let engines=result["engines"] as! [String:[String:Any]]
  precondition(engines["pix2text"]?["installed"] as? Bool==true)
  precondition(engines["unimernet"]?["installed"] as? Bool==false)
  print("Native status checks run off the UI thread; main-queue heartbeat and cached size reporting passed")
  exit(0)
 }
${status}
 func prepare()throws {
  try FileManager.default.createDirectory(at:ocrRoot,withIntermediateDirectories:true)
  for n in 0..<100 {try Data(repeating:1,count:20).write(to:ocrRoot.appendingPathComponent("file-"+String(n)))}
 }
}
let h=Harness(URL(fileURLWithPath:CommandLine.arguments[1]))
try h.prepare()
DispatchQueue.main.async {h.handleOCRStatus(["id":"status-test"])}
DispatchQueue.main.asyncAfter(deadline:.now()+0.03){h.heartbeat=true}
DispatchQueue.main.asyncAfter(deadline:.now()+5){fatalError("Missing asynchronous status reply")}
dispatchMain()
`;
const file=path.join(dir,'main.swift');fs.writeFileSync(file,program);
execFileSync('xcrun',['swift',file,dir],{stdio:'inherit',timeout:30000});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
