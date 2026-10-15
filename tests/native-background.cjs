const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');const s=fs.readFileSync('macos/Formula.swift','utf8'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-background-'));try{const helper=s.slice(s.indexOf('func formulaBackgroundPDF'),s.indexOf('final class MathWebView'));const test=String.raw`
let url=URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent("sample.pdf")
var bounds=CGRect(x:0,y:0,width:100,height:60)
let context=CGContext(url as CFURL,mediaBox:&bounds,nil)!
context.beginPDFPage(nil);context.setFillColor(NSColor.black.cgColor);context.fill(CGRect(x:20,y:20,width:20,height:20));context.endPDFPage();context.closePDF()
try formulaBackgroundPDF(url,hex:"#2563eb")
let pdf=CGPDFDocument(url as CFURL)!,page=pdf.page(at:1)!
precondition(page.getBoxRect(.mediaBox)==bounds)
let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:100,pixelsHigh:60,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
let graphic=NSGraphicsContext(bitmapImageRep:bitmap)!.cgContext;graphic.drawPDFPage(page)
let corner=bitmap.colorAt(x:2,y:2)!.usingColorSpace(.deviceRGB)!
precondition(abs(corner.redComponent-37.0/255)<0.02 && abs(corner.greenComponent-99.0/255)<0.02 && abs(corner.blueComponent-235.0/255)<0.02)
let ink=bitmap.colorAt(x:25,y:30)!.usingColorSpace(.deviceRGB)!
precondition(ink.redComponent<0.02 && ink.greenComponent<0.02 && ink.blueComponent<0.02)
print("PASS native PDF background color, retained content and unchanged media bounds")
`;const file=path.join(dir,'main.swift');fs.writeFileSync(file,'import Cocoa\nimport PDFKit\nstruct ToolFailure:Error{let message:String}\n'+helper+test);console.log(execFileSync('swift',[file,dir],{encoding:'utf8'}));}finally{fs.rmSync(dir,{recursive:true,force:true});}
