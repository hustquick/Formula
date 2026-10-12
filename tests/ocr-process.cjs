const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('macos/Formula.swift','utf8');
const method=source.slice(source.indexOf('    func run('),source.indexOf('    func discover('));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-process-test-'));
try {
 const program=`import Foundation\nimport Darwin\nstruct ToolFailure: Error { let message: String }\n${method}\n
let cwd=URL(fileURLWithPath:CommandLine.arguments[1])
let result=try run("/bin/sh",["-c","printf 'FORMULA_OCR_ERROR=broken model'; exit 3"],cwd:cwd,timeout:2)
precondition(result.0 == 3 && result.1.contains("broken model"))
do {
 _ = try run("/bin/sh",["-c","printf 'model initialization started'; exec sleep 5"],cwd:cwd,timeout:0.2)
 fatalError("Expected timeout")
} catch let failure as ToolFailure {
 precondition(failure.message.contains("超时") && failure.message.contains("model initialization started"))
}
let remaining=try FileManager.default.contentsOfDirectory(atPath:cwd.path)
precondition(remaining.filter{$0.hasPrefix("process-")}.isEmpty)
print("Native process exit, timeout logs and temporary log cleanup OK")
`;
 const file=path.join(dir,'main.swift');fs.writeFileSync(file,program);
 execFileSync('xcrun',['swift',file,dir],{stdio:'inherit'});
} finally {fs.rmSync(dir,{recursive:true,force:true});}
