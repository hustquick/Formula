const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
if(process.platform!=='darwin')process.exit(0);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-universal-'));
try{const adapter=fs.readFileSync('macos/Formula.swift','utf8').split('// BEGIN EQUATION CLIPBOARD ADAPTER')[1].split('// END EQUATION CLIPBOARD ADAPTER')[0];
const script=`import AppKit\nimport CoreServices\n${adapter}\nlet board=NSPasteboard.withUniqueName();defer{board.releaseGlobally()}\nlet omml="<m:oMath xmlns:m=\\"http://schemas.openxmlformats.org/officeDocument/2006/math\\"><m:r><m:t>x</m:t></m:r></m:oMath>"\nlet payload:[String:Any]=["mathml":"<math><mi>x</mi></math>","html":"<html>x</html>","text":"x","latex":"x","typst":"x","gvml":"UEsDBA==","omml":omml,"png":"AQ==","svg":"Ag=="]\nassert(EquationClipboard.write(payload,to:board))\nvar pb:Pasteboard?;assert(PasteboardCreate(board.name.rawValue as CFString,&pb)==noErr)\nvar count=0;assert(PasteboardGetItemCount(pb!,&count)==noErr);assert(count==1)\nvar id:PasteboardItemID?;assert(PasteboardGetItemIdentifier(pb!,1,&id)==noErr)\nfor(type,expected) in EquationClipboard.representations(payload){var data:CFData?;assert(PasteboardCopyItemFlavorData(pb!,id!,type.rawValue as CFString,&data)==noErr);assert(data! as Data==expected)}\ntry EquationClipboard.officePackage(omml).write(to:URL(fileURLWithPath:CommandLine.arguments[1]))\nprint("PASS same-item WPS legacy flavor, OMML, MathML, Typst, graphics and plain text exact byte roundtrip")\n`;
const file=path.join(dir,'main.swift'),zip=path.join(dir,'equation.docx');fs.writeFileSync(file,script);let r=spawnSync('swift',[file,zip],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log(r.stdout.trim());r=spawnSync('python3',['-c',`import zipfile,sys,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert len(z.namelist())==3
 for n in z.namelist(): E.fromstring(z.read(n))
 assert len(E.fromstring(z.read('word/document.xml')).findall('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath'))==1
print('PASS self-contained OOXML package CRC, required parts and mathematical XML')`,zip],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log(r.stdout.trim())}finally{fs.rmSync(dir,{recursive:true,force:true})}
