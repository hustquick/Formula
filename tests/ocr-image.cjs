const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('macos/FormulaOCR.swift','utf8');
const method=source.slice(source.indexOf('    func ocrImageData('),source.indexOf('    private func ocrFailure('));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-image-test-'));
try {
 const program=`import Cocoa
import ImageIO
import UniformTypeIdentifiers
struct ToolFailure: Error { let message: String }
${method}
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:32,pixelsHigh:16,bitsPerSample:8,samplesPerPixel:3,hasAlpha:false,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
memset(bitmap.bitmapData!,255,bitmap.bytesPerRow*bitmap.pixelsHigh)
let jpg=root.appendingPathComponent("formula.jpg")
try bitmap.representation(using:.jpeg,properties:[:])!.write(to:jpg)
let heic=root.appendingPathComponent("formula.heic")
let destination=CGImageDestinationCreateWithURL(heic as CFURL,UTType.heic.identifier as CFString,1,nil)!
CGImageDestinationAddImage(destination,bitmap.cgImage!,nil)
precondition(CGImageDestinationFinalize(destination))
for image in [jpg,heic] {
 let bytes=try ocrImageData(image)
 precondition(bytes.prefix(8)==Data([137,80,78,71,13,10,26,10]))
 let decoded=NSBitmapImageRep(data:bytes)!
 precondition(decoded.pixelsWide==32 && decoded.pixelsHigh==16)
}
let invalid=root.appendingPathComponent("broken.jpg")
try Data("not an image".utf8).write(to:invalid)
do { _ = try ocrImageData(invalid); fatalError("Expected decode failure") }
catch let error as ToolFailure { precondition(error.message.contains("无法读取")) }
print("Native JPEG/HEIC to PNG normalization and corrupt-image reporting OK")
`;
 const file=path.join(dir,'main.swift');fs.writeFileSync(file,program);
 execFileSync('xcrun',['swift',file,dir],{stdio:'inherit'});
} finally {fs.rmSync(dir,{recursive:true,force:true});}
