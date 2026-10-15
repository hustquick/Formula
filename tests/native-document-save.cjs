// Exercise the actual native save method and disk I/O without an app bundle or GUI.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-native-save-'));
try{
 const source=fs.readFileSync('macos/Formula.swift','utf8');
 const methods=source.slice(source.indexOf('    func loadDocumentSession('),source.indexOf('    func saveFile('));
 const file=path.join(root,'main.swift');
 fs.writeFileSync(file,`import Foundation
import CryptoKit
import PDFKit
struct ToolFailure:Error {let message:String}
enum Response { case OK, cancel }
final class Window { var representedURL:URL?; var isDocumentEdited=false; var title="" }
final class NSSavePanel {
 static var completion:((Response)->Void)?
 static var selected:URL?
 var url:URL? { Self.selected }
 var nameFieldStringValue=""
 var allowedFileTypes:[String]=[]
 var canCreateDirectories=false
 func beginSheetModal(for:Window,completionHandler:@escaping(Response)->Void){Self.completion=completionHandler}
}
final class Probe {
 var currentProjectURL:URL?
 var currentDocumentID="doc"
 var currentProjectDigest:String?
 var support=URL(fileURLWithPath:CommandLine.arguments[1])
 var currentDocumentDraft:[String:Any]?
 var currentDocumentStatus:[String:Any]?
 var pendingProjectURLs:[String:(url:URL,digest:String)]=[:]
 var window=Window()
 var replies:[[String:Any]]=[]
 func reply(_ id:String,_ result:[String:Any]){replies.append(result)}
 func report(_ message:String,_ error:Bool=false){replies.append(["error":message])}
 func json(_ value:Any)->String {String(data:try! JSONSerialization.data(withJSONObject:value,options:.fragmentsAllowed),encoding:.utf8)!}
 func js(_ code:String){}
${methods}
${source.slice(source.indexOf('    func importFile('),source.indexOf('    // Arguments are passed'))}
}
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let probe=Probe(),target=root.appendingPathComponent("sample.mathforge")
if CommandLine.arguments.count>2 {
    let restored=probe.loadDocumentSession()!
    precondition(probe.currentDocumentID=="process-doc" && probe.currentProjectURL==target)
    precondition((restored["draft"] as? [String:Any])?["rawSource"] as? String == "process-x")
    let request:[String:Any]=["id":"restart-save","documentID":"process-doc","saveAs":false,"base64":Data("after restart".utf8).base64EncodedString(),"signature":"restart-signature"]
    probe.saveProject(request);precondition(probe.replies.last?["saved"] as? Bool == true)
    let written=try String(contentsOf:target,encoding:.utf8);precondition(written=="after restart")
    print("PASS separate native process reloads authorized file identity and saves in place")
    exit(0)
}
try Data("original".utf8).write(to:target)
let request:[String:Any]=["id":"save","documentID":"doc","saveAs":true,"name":"sample.mathforge","base64":Data("saved".utf8).base64EncodedString(),"signature":"saved-signature"]
probe.saveProject(request)
// A delayed Save As belongs to its original document, even after New/Open.
probe.currentDocumentID="new-doc"
NSSavePanel.selected=target;NSSavePanel.completion!(.OK)
let remaining=try String(contentsOf:target,encoding:.utf8)
precondition(remaining=="original", "stale Save As overwrote a file after changing documents")
precondition(probe.replies.last?["error"] != nil)
print("PASS stale native Save As preserves destination and current identity")
probe.currentDocumentID="doc"
let draft:[String:Any]=["rawSource":"x", "editorMode":"latex"]
let status:[String:Any]=["id":"doc","name":"sample.mathforge","savedSignature":NSNull(),"dirty":true]
try probe.persistDocumentSession(draft,status)
probe.saveProject(request);NSSavePanel.completion!(.cancel)
precondition(probe.currentProjectURL==nil)
probe.saveProject(request);NSSavePanel.completion!(.OK)
precondition(probe.replies.last?["saved"] as? Bool == true)
let reopened=Probe();let session=reopened.loadDocumentSession()!
precondition(reopened.currentProjectURL==target)
precondition(reopened.currentDocumentID=="doc")
precondition(session["savedSignature"] as? String == "saved-signature")
precondition((session["draft"] as? [String:Any])?["rawSource"] as? String == "x")
var inplace=request;inplace["saveAs"]=false;inplace["base64"]=Data("updated".utf8).base64EncodedString()
reopened.saveProject(inplace)
precondition(reopened.replies.last?["saved"] as? Bool == true)
let updated=try String(contentsOf:target,encoding:.utf8);precondition(updated=="updated")
// Preserve external modifications/deletions; failure must keep the current path.
try Data("external".utf8).write(to:target)
reopened.saveProject(inplace);precondition(reopened.replies.last?["error"] != nil)
let external=try String(contentsOf:target,encoding:.utf8);precondition(external=="external")
try FileManager.default.removeItem(at:target)
reopened.saveProject(inplace);precondition(reopened.replies.last?["error"] != nil)
precondition(!FileManager.default.fileExists(atPath:target.path))
precondition(reopened.currentProjectURL==target)
// Failed save destinations do not replace the existing authorized URL.
reopened.saveProject(request);NSSavePanel.selected=root.appendingPathComponent("missing/subdir/math.mathforge");NSSavePanel.completion!(.OK)
precondition(reopened.replies.last?["error"] != nil && reopened.currentProjectURL==target)
// File binding uses the exact bytes read, never a later digest at the JS callback.
let project=root.appendingPathComponent("open.mathforge")
try Data(probe.json(["format":"mathforge-equation","state":draft]).utf8).write(to:project)
reopened.importFile(project);let token=reopened.pendingProjectURLs.keys.first!
let readDigest=reopened.pendingProjectURLs[token]!.digest
try Data("changed during import".utf8).write(to:project)
reopened.bindOpenedProject(token,documentID:reopened.currentDocumentID)
precondition(reopened.currentProjectDigest==readDigest)
reopened.saveProject(inplace);precondition(reopened.replies.last?["error"] != nil)
precondition(reopened.pendingProjectURLs.isEmpty)
// New identity clears file ownership, including after a process restart.
try reopened.persistDocumentSession(["rawSource":"new"],["id":"new-doc","name":"未命名公式","dirty":true])
let fresh=Probe();_ = fresh.loadDocumentSession()
precondition(fresh.currentProjectURL==nil && fresh.currentDocumentID=="new-doc")
// Old split records must not silently bind an unrelated recovered draft to a path.
try JSONSerialization.data(withJSONObject:["id":"legacy","path":target.path,"digest":"old"]).write(to:root.appendingPathComponent("document-session.json"))
let legacy=Probe();precondition(legacy.loadDocumentSession()==nil && legacy.currentProjectURL==nil)
try probe.persistDocumentSession(["rawSource":"process-x"],["id":"process-doc","name":"sample.mathforge","dirty":true])
var processSave=request;processSave["documentID"]="process-doc"
probe.saveProject(processSave);NSSavePanel.selected=target;NSSavePanel.completion!(.OK)
precondition(probe.replies.last?["saved"] as? Bool == true)
print("PASS actual native Save/Save As, cancel/error, atomic session restart, in-place Save, external conflicts, import-byte binding and new/legacy identity isolation")
`);
 const result=execFileSync('swift',[file,root],{encoding:'utf8',stdio:['ignore','pipe','pipe']});console.log(result);console.log(execFileSync('swift',[file,root,'--restart'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
