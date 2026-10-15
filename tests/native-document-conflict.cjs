const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-file-conflict-'));try{const source=fs.readFileSync('macos/Formula.swift','utf8');const method=source.slice(source.indexOf('    func projectDigest('),source.indexOf('    func saveProject('));const file=path.join(root,'main.swift');fs.writeFileSync(file,'import Foundation\nimport CryptoKit\nclass Probe{\n'+method+'}\n'+String.raw`
let url=URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent("sample.mathforge")
let probe=Probe();try Data("original".utf8).write(to:url,options:.atomic)
let baseline=probe.projectDigest(url)!;precondition(probe.projectDigest(url)==baseline)
try Data("external edit".utf8).write(to:url,options:.atomic);precondition(probe.projectDigest(url) != baseline)
try FileManager.default.removeItem(at:url);precondition(probe.projectDigest(url)==nil)
print("PASS native SHA256 detects external edit and deletion")
`);console.log(execFileSync('swift',[file,root],{encoding:'utf8'}));}finally{fs.rmSync(root,{recursive:true,force:true});}
