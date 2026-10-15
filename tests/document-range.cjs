const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');const source=fs.readFileSync('macos/FormulaDocument.swift','utf8'),start=source.indexOf('func documentPageRange'),end=source.indexOf('extension AppDelegate',start),dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-range-'));try{const file=path.join(dir,'main.swift');fs.writeFileSync(file,'import Foundation\nstruct ToolFailure:Error {let message:String}\n'+source.slice(start,end)+`
precondition(try documentPageRange(total:50,first:1,last:0)==1...20)
precondition(try documentPageRange(total:3,first:1,last:0)==1...3)
precondition(try documentPageRange(total:3,first:0,last:0)==1...3)
precondition(try documentPageRange(total:50,first:10,last:0)==10...29)
precondition(try documentPageRange(total:50,first:2,last:3)==2...3)
for args in [(0,1,0),(3,4,0),(50,1,21),(50,-1,0),(3,1,4)] {do{_ = try documentPageRange(total:args.0,first:args.1,last:args.2);fatalError("invalid range accepted")}catch{}}
print("PASS native PDF 1/0 default, <=20-page cap, short PDFs, 0/0 compatibility and invalid ranges")
`.replaceAll('precondition(try documentPageRange','precondition(try! documentPageRange'));console.log(execFileSync('swift',[file],{encoding:'utf8'}));}finally{fs.rmSync(dir,{recursive:true,force:true});}
