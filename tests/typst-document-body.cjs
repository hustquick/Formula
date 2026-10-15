const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync('macos/Formula.swift','utf8'),start=source.indexOf('func typstSourceBody('),end=source.indexOf('// Flatten a chosen',start),dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-typst-body-'));
try{const swift='import Foundation\n'+source.slice(start,end)+String.raw`
precondition(typstSourceBody("x^2",display:true)=="$ x^2 $")
precondition(typstSourceBody("x^2",display:false)=="$x^2$")
let document="#set text(size: 16pt)\n$x^2 + y^2$"
precondition(typstSourceBody(document,display:true)==document)
precondition(typstSourceBody("#show math.equation: it => it\n$x$",display:false).hasPrefix("#show"))
precondition(typstSourceBody("x + #sym.alpha",display:true)=="$ x + #sym.alpha $")
print("PASS native Typst markup/math wrapping, multiline content and inline mode")
`;const file=path.join(dir,'main.swift');fs.writeFileSync(file,swift);console.log(execFileSync('swift',[file],{encoding:'utf8'}).trim());}finally{fs.rmSync(dir,{recursive:true,force:true});}
