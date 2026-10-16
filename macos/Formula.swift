import Cocoa
import WebKit
import PDFKit
import Darwin
import CryptoKit
import CoreServices

// BEGIN EQUATION CLIPBOARD ADAPTER
struct EquationClipboard {
    // Registered clipboard names are converted to UTIs on macOS; the names
    // "MathML Presentation" and MIME strings are not themselves valid UTIs.
    static func registeredType(_ name:String)->NSPasteboard.PasteboardType {
        let uti=UTTypeCreatePreferredIdentifierForTag(kUTTagClassNSPboardType,name as CFString,nil)!.takeRetainedValue() as String
        return NSPasteboard.PasteboardType(uti)
    }
    static let wpsType = NSPasteboard.PasteboardType("com.trolltech.anymime.Kingsoft WPS 9.0 Format")
    // Self-contained OOXML package, generated without captured user documents.
    static func officePackage(_ omml:String)->Data {
        let files:[(String,String)] = [
            ("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"),
            ("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"),
            ("word/document.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p>"+omml+"</w:p></w:body></w:document>")
        ]
        // ZIP STORE: no external process, model, runtime or network dependency.
        func bytes(_ value:UInt32,_ count:Int)->Data {Data((0..<count).map{UInt8(truncatingIfNeeded:value >> ($0*8))})}
        func crc(_ data:Data)->UInt32 {var c:UInt32=0xffffffff;for b in data {c ^= UInt32(b);for _ in 0..<8 {c = (c >> 1) ^ ((c & 1) == 1 ? 0xedb88320 : 0)}};return c ^ 0xffffffff}
        var output=Data(),central=Data()
        for (name,text) in files {
            let n=Data(name.utf8),d=Data(text.utf8),sum=crc(d),size=UInt32(d.count),offset=UInt32(output.count)
            output += bytes(0x04034b50,4)
            output += bytes(20,2)
            output += bytes(0,2)
            output += bytes(0,2)
            output += bytes(0,2)
            output += bytes(33,2)
            output += bytes(sum,4)
            output += bytes(size,4)
            output += bytes(size,4)
            output += bytes(UInt32(n.count),2)
            output += bytes(0,2)
            output += n
            output += d
            central += bytes(0x02014b50,4)
            central += bytes(20,2)
            central += bytes(20,2)
            central += bytes(0,2)
            central += bytes(0,2)
            central += bytes(0,2)
            central += bytes(33,2)
            central += bytes(sum,4)
            central += bytes(size,4)
            central += bytes(size,4)
            central += bytes(UInt32(n.count),2)
            central += bytes(0,2)
            central += bytes(0,2)
            central += bytes(0,2)
            central += bytes(0,2)
            central += bytes(0,4)
            central += bytes(offset,4)
            central += n
        }
        let offset=UInt32(output.count);output += central
        output += bytes(0x06054b50,4)
        output += bytes(0,2)
        output += bytes(0,2)
        output += bytes(UInt32(files.count),2)
        output += bytes(UInt32(files.count),2)
        output += bytes(UInt32(central.count),4)
        output += bytes(offset,4)
        output += bytes(0,2)
        return output
    }
    static func representations(_ payload:[String:Any])->[(NSPasteboard.PasteboardType,Data)] {
        guard let math=payload["mathml"] as? String,math.hasPrefix("<math"),let html=payload["html"] as? String,let text=payload["text"] as? String else{return []}
        var values:[(NSPasteboard.PasteboardType,Data)]=[]
        for name in ["MathML","MathML Presentation"] {values.append((registeredType(name),math.data(using:.utf16LittleEndian)!))}
        values.append((NSPasteboard.PasteboardType("org.w3.mathml"),math.data(using:.utf8)!))
        values.append((NSPasteboard.PasteboardType("public.mathml"),math.data(using:.utf8)!))
        values.append((.html,html.data(using:.utf8)!))
        if let latex=payload["latex"] as? String {values.append((NSPasteboard.PasteboardType("org.mathforge.latex"),latex.data(using:.utf8)!))}
        values.append((.string,text.data(using:.utf8)!))
        if let equation=payload["equation"] as? String {values.append((NSPasteboard.PasteboardType("org.mathforge.equation"),equation.data(using:.utf8)!))}
        for (key,type) in [("svg",NSPasteboard.PasteboardType("public.svg-image")),("pdf",.pdf),("png",.png)] {if let encoded=payload[key] as? String,let bytes=Data(base64Encoded:encoded){values.append((type,bytes))}}
        if let typst=payload["typst"] as? String {values.append((NSPasteboard.PasteboardType("org.mathforge.typst"),Data(typst.utf8)))}
        if let omml=payload["omml"] as? String,omml.hasPrefix("<m:oMath ") {
            values.insert((wpsType,officePackage(omml)),at:0)
            values.insert((NSPasteboard.PasteboardType("org.mathforge.omml"),Data(omml.utf8)),at:1)
        }
        if let encoded=payload["gvml"] as? String,let bytes=Data(base64Encoded:encoded),!bytes.isEmpty {
            values.insert((NSPasteboard.PasteboardType("com.trolltech.anymime.Art::GVML ClipFormat"),bytes),at:min(1,values.count))
        }
        return values
    }
    static func write(_ payload:[String:Any],to board:NSPasteboard = .general)->Bool {
        let values=representations(payload);guard !values.isEmpty else{return false}
        // Carbon preserves legacy Qt/WPS flavor names containing spaces.
        // All representations belong to the same item, including the native package.
        var carbon:Pasteboard?
        guard PasteboardCreate(board.name.rawValue as CFString,&carbon)==noErr,let carbon=carbon else{return false}
        guard PasteboardClear(carbon)==noErr else{return false}
        let item=UnsafeMutableRawPointer(bitPattern:1)!
        for (type,data) in values {
            if PasteboardPutItemFlavor(carbon,item,type.rawValue as CFString,data as CFData,PasteboardFlavorFlags(rawValue:0)) != noErr {return false}
        }
        return true
    }
}
// END EQUATION CLIPBOARD ADAPTER

struct ToolFailure: Error { let message: String }

// Document directives are markup; never put them inside a math delimiter.
func typstSourceBody(_ source:String,display:Bool) -> String {
    let markup=source.range(of:"(?m)^\\s*#(?:set|show|let|import|include|context)\\b",options:.regularExpression) != nil
    return markup ? source : (display ? "$ ":"$")+source+(display ? " $":"$")
}

// Flatten a chosen solid background into the PDF while retaining vector drawing commands.
func formulaBackgroundPDF(_ url:URL,hex:String) throws {
    guard let document=CGPDFDocument(url as CFURL),let page=document.page(at:1),let rgb=UInt32(hex.dropFirst(),radix:16) else {throw ToolFailure(message:"背景颜色或PDF无效")}
    var bounds=page.getBoxRect(.mediaBox)
    let data=NSMutableData()
    guard let consumer=CGDataConsumer(data:data as CFMutableData),let context=CGContext(consumer:consumer,mediaBox:&bounds,nil) else {throw ToolFailure(message:"不能生成背景颜色")}
    context.beginPDFPage(nil)
    context.setFillColor(red:CGFloat((rgb>>16)&255)/255,green:CGFloat((rgb>>8)&255)/255,blue:CGFloat(rgb&255)/255,alpha:1)
    context.fill(bounds);context.drawPDFPage(page);context.endPDFPage();context.closePDF()
    try (data as Data).write(to:url,options:.atomic)
}

final class MathWebView: WKWebView {
    var lastMouseEvent: NSEvent?
    override func mouseDown(with event: NSEvent) { lastMouseEvent = event; super.mouseDown(with: event) }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSDraggingSource, NSMenuItemValidation {
    var window: NSWindow!
    var web: MathWebView!
    var toolPaths: [String:String] = UserDefaults.standard.dictionary(forKey: "toolPaths") as? [String:String] ?? [:]
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MathForge")
    let worker = DispatchQueue(label: "Formula.compiler")
    var queuedImports: [URL] = []
    var commandStates: [String:Bool] = [:]
    var pendingProjectURLs:[String:(url:URL,digest:String)]=[:]
    var currentProjectURL:URL?
    var currentDocumentID=""
    var currentProjectDigest:String?
    var currentDocumentDraft:[String:Any]?
    var currentDocumentStatus:[String:Any]?
    var ready = false
    let ocrWorker = DispatchQueue(label: "Formula.ocr")
    var ocrBusy = false
    var documentCancelled = false
    var ocrInstallBusy = false
    var ocrInstallingEngine = ""
    var ocrBasicInstalling = false
    var ocrCachedBytes:Int64 = 0
    var ocrSizeUpdated = Date.distantPast
    var ocrSizeCalculating = false
    var ocrInstallCancelled = false
    var ocrInstallProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "mathforge")
        config.userContentController.addUserScript(WKUserScript(source:"window.FormulaSourceEquationSupported=true;",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        // Restore one atomic host-owned record: draft and file identity cannot be mixed.
        let session=loadDocumentSession()
        let draft=session?["draft"] as? [String:Any] ?? ((try? Data(contentsOf:support.appendingPathComponent("state.json"))).flatMap{(try? JSONSerialization.jsonObject(with:$0)) as? [String:Any]})
        if let draft=draft {
            config.userContentController.addUserScript(WKUserScript(source:"window.FormulaSavedState = \(json(draft));",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        }
        if let session=session {
            let identity:[String:Any]=["id":session["id"]!,"name":session["name"] ?? "未命名公式","savedSignature":session["savedSignature"] ?? NSNull()]
            config.userContentController.addUserScript(WKUserScript(source:"window.FormulaSavedLifecycle = \(json(identity));",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        }
        web = MathWebView(frame:.zero,configuration:config)
        web.navigationDelegate = self
        window = NSWindow(contentRect:NSRect(x:0,y:0,width:1120,height:860),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "Formula · 公式工坊"
        window.minSize = NSSize(width:760,height:650)
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("MainWindow")
        makeMenu()
        let root = Bundle.main.resourceURL!.appendingPathComponent("web")
        web.loadFileURL(root.appendingPathComponent("index.html"),allowingReadAccessTo:root)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps:true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        for path in filenames { let url=URL(fileURLWithPath:path);if ready { importFile(url) } else { queuedImports.append(url) } }
        sender.reply(toOpenOrPrint:.success)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        ready=true;loadOCRUI();for url in queuedImports {importFile(url)};queuedImports=[]
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }
    func json(_ value:Any) -> String { guard let d=try? JSONSerialization.data(withJSONObject:value,options:[.fragmentsAllowed]),let s=String(data:d,encoding:.utf8) else{return "null"};return s }
    func js(_ code:String) { web.evaluateJavaScript(code,completionHandler:nil) }
    func report(_ message:String,_ error:Bool=false) { js("window.FormulaNativeResult(\(json(message)),\(error ? "true":"false"));") }
    func reply(_ id:String,_ result:[String:Any]) { js("window.FormulaNativeReply(\(json(id)),\(json(result)));") }

    func makeMenu() {
        let bar=NSMenu();let appItem=NSMenuItem();bar.addItem(appItem)
        let appMenu=NSMenu();appItem.submenu=appMenu
        appMenu.addItem(withTitle:"关于 Formula",action:#selector(about),keyEquivalent:"").target=self
        appMenu.addItem(.separator());appMenu.addItem(withTitle:"退出 Formula",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        let fileItem=NSMenuItem();bar.addItem(fileItem);let file=NSMenu(title:"文件");fileItem.submenu=file
        for (title,key,tag) in [("导入公式…","o",0),("导出 SVG…","e",1),("导出 PDF…","",2),("导出 PNG…","",3),("保存可恢复公式…","s",4)] {
            let item=NSMenuItem(title:title,action:#selector(menuAction(_:)),keyEquivalent:key);item.target=self;item.tag=tag;file.addItem(item)
        }
        let editItem=NSMenuItem();bar.addItem(editItem);let edit=NSMenu(title:"编辑");editItem.submenu=edit
        for (title,selector,key) in [("撤销",Selector(("undo:")),"z"),("剪切",#selector(NSText.cut(_:)),"x"),("复制",#selector(NSText.copy(_:)),"c"),("粘贴",#selector(NSText.paste(_:)),"v"),("全选",#selector(NSText.selectAll(_:)),"a")] {edit.addItem(withTitle:title,action:selector,keyEquivalent:key)}
        let source=NSMenuItem(title:"复制当前语言源码",action:#selector(copySource),keyEquivalent:"C");source.target=self;source.keyEquivalentModifierMask=[.command,.shift];edit.addItem(source)
        let settings=NSMenuItem(title:"系统排版工具…",action:#selector(showTools),keyEquivalent:",");settings.target=self;appMenu.insertItem(settings,at:1)
        NSApp.mainMenu=bar
    }
    func registerCommandMenus(_ commands:[[String:Any]]) {
        guard let bar=NSApp.mainMenu else{return}
        while bar.items.count>1{bar.removeItem(at:1)}
        let categories=[("文件","文件"),("编辑","编辑"),("视图","视图"),("公式","公式")]
        for (title,category) in categories {
            let parent=NSMenuItem();parent.submenu=NSMenu(title:title);bar.addItem(parent)
            for command in commands where command["category"] as? String == category {
                guard let id=command["id"] as? String,let label=command["title"] as? String else{continue}
                if ["insertStructure","matrixEdit"].contains(id){continue}
                let shortcut=(command["shortcut"] as? String ?? "").split(separator:"+").map(String.init)
                let item=NSMenuItem(title:label,action:#selector(registeredCommand(_:)),keyEquivalent:shortcut.last ?? "")
                item.target=self;item.representedObject=id;var modifiers:NSEvent.ModifierFlags=[]
                if shortcut.contains("meta"){modifiers.insert(.command)}
                if shortcut.contains("shift"){modifiers.insert(.shift)}
                if shortcut.contains("alt"){modifiers.insert(.option)}
                item.keyEquivalentModifierMask=modifiers;parent.submenu?.addItem(item)
            }
            if category=="编辑" {
                let copyMenu=NSMenuItem(title:"复制",action:nil,keyEquivalent:"");copyMenu.submenu=NSMenu(title:"复制");parent.submenu?.addItem(copyMenu)
                for command in commands where command["category"] as? String == "复制" {
                    guard let id=command["id"] as? String,let title=command["title"] as? String else{continue}
                    let item=NSMenuItem(title:title,action:#selector(registeredCommand(_:)),keyEquivalent:"");item.target=self;item.representedObject=id;copyMenu.submenu?.addItem(item)
                }
            }
            if category=="公式" {
                let insert=NSMenuItem();insert.submenu=NSMenu(title:"插入结构");parent.submenu?.addItem(insert)
                for command in commands where command["category"] as? String == "结构" {
                    guard let id=command["id"] as? String,let title=command["title"] as? String else{continue}
                    let item=NSMenuItem(title:title,action:#selector(registeredCommand(_:)),keyEquivalent:"");item.target=self;item.representedObject=id;insert.submenu?.addItem(item)
                }
            }
            if category=="文件"{let close=NSMenuItem(title:"关闭窗口",action:#selector(NSWindow.performClose(_:)),keyEquivalent:"w");parent.submenu?.addItem(close)}
        }
        let windowItem=NSMenuItem();let windowMenu=NSMenu(title:"窗口");windowItem.submenu=windowMenu;bar.addItem(windowItem)
        windowMenu.addItem(withTitle:"最小化",action:#selector(NSWindow.performMiniaturize(_:)),keyEquivalent:"m");NSApp.windowsMenu=windowMenu
        let help=NSMenuItem();help.submenu=NSMenu(title:"帮助");bar.addItem(help)
        let palette=NSMenuItem(title:"命令面板",action:#selector(registeredCommand(_:)),keyEquivalent:"");palette.target=self;palette.representedObject="commandPalette";help.submenu?.addItem(palette)
        if let appMenu=bar.items.first?.submenu,appMenu.items.count>1 {let settings=appMenu.items[1];settings.action=#selector(registeredCommand(_:));settings.target=self;settings.representedObject="settings"}
    }
    @objc func registeredCommand(_ item:NSMenuItem){guard let id=item.representedObject as? String else{return};js("window.FormulaCommands?.execute(\(json(id)));")}
    func validateMenuItem(_ item:NSMenuItem)->Bool{guard let id=item.representedObject as? String else{return true};return commandStates[id] ?? true}
    @objc func about() { let alert=NSAlert();alert.messageText="Formula "+(Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "");alert.informativeText="本地公式工坊\nMathLive 可视化编辑 · LaTeX / Typst\n内置与系统排版引擎 · 矢量导出\n\n第三方许可见应用资源 THIRD-PARTY-NOTICES.txt。";alert.runModal() }
    @objc func showTools() {js("window.FormulaCommands?.execute('settings');")}
    @objc func copySource() {js("window.FormulaAction('copy');")}
    @objc func menuAction(_ item:NSMenuItem) {let actions=["import","svg","pdf","png","project"];js("window.FormulaAction('\(actions[item.tag])');")}

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,let data=message.body as? [String:Any],let action=data["action"] as? String else{return}
        switch action {
        case "registerCommands":registerCommandMenus(data["commands"] as? [[String:Any]] ?? [])
        case "commandStates":commandStates=data["states"] as? [String:Bool] ?? [:]
        case "nativeEdit":
            let allowed=["cut":"cut:","copy":"copy:","paste":"paste:","selectAll":"selectAll:","undo":"undo:","redo":"redo:"]
            if let name=data["edit"] as? String,let selector=allowed[name]{NSApp.sendAction(Selector(selector),to:nil,from:self)}
        case "state":
            if let state=data["state"] as? [String:Any] {
                do {
                    if let document=data["document"] as? [String:Any] {try persistDocumentSession(state,document)}
                    let bytes=try JSONSerialization.data(withJSONObject:state)
                    try bytes.write(to:support.appendingPathComponent("state.json"),options:.atomic)
                } catch {report("草稿保存失败："+error.localizedDescription,true)}
            }
        case "copy":
            guard let text=data["text"] as? String else{return};let p=NSPasteboard.general;p.clearContents();p.setString(text,forType:.string)
            if data["format"] as? String == "svg",let bytes=text.data(using:.utf8) {p.setData(bytes,forType:NSPasteboard.PasteboardType("public.svg-image"))}
        case "prepareEquation":prepareSourceEquation(data)
        case "copyEquation":
            if !EquationClipboard.write(data){report("无法写入数学剪贴板，原公式已保留。",true)}
        case "copyImage":
            let p=NSPasteboard.general;p.clearContents()
            for (key,type) in [("png",NSPasteboard.PasteboardType.png),("pdf",.pdf),("svg",NSPasteboard.PasteboardType("public.svg-image")),("jpeg",NSPasteboard.PasteboardType("public.jpeg")),("tiff",.tiff),("eps",NSPasteboard.PasteboardType("com.adobe.encapsulated-postscript"))] {if let encoded=data[key] as? String,let bytes=Data(base64Encoded:encoded){p.setData(bytes,forType:type)}}
        if let equation=data["equation"] as? String,let bytes=equation.data(using:.utf8){p.setData(bytes,forType:NSPasteboard.PasteboardType("org.mathforge.equation"))}
        case "documentStatus":updateDocumentStatus(data)
        case "documentOpened":
            if let token=data["token"] as? String {bindOpenedProject(token,documentID:data["documentID"] as? String)}
        case "saveProject":saveProject(data)
        case "save":saveFile(data)
        case "import":
            let panel=NSOpenPanel();panel.allowedFileTypes=["tex","typ","txt","svg","pdf","mathforge","json"];panel.canChooseDirectories=false
            panel.beginSheetModal(for:window){response in if response == .OK,let url=panel.url{self.importFile(url)}}
        case "scanTools":scanTools()
        case "chooseTool":if let tool=data["tool"] as? String {chooseTool(tool)}
        case "render":
            let paths=toolPaths
            worker.async {let result=self.render(data,paths:paths);DispatchQueue.main.async {self.reply(data["id"] as? String ?? "",result)}}
        case "ocrStatus":handleOCRStatus(data)
        case "ocrInstall":handleOCRInstall(data)
        case "ocrCancelInstall":handleOCRCancelInstall(data)
        case "ocrRecognize":handleOCRRecognize(data)
        case "ocrDocument":handleDocumentRecognize(data)
        case "ocrDocumentInstall":handleDocumentInstall(data)
        case "ocrDocumentCancel":documentCancelled=true;reply(data["id"] as? String ?? "",["cancelled":true])
        case "drag":dragFile(data)
        default:break
        }
    }
    func loadDocumentSession()->[String:Any]? {
        guard let bytes=try? Data(contentsOf:support.appendingPathComponent("document-session.json")),
              let session=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any],
              session["version"] as? Int == 1,let draft=session["draft"] as? [String:Any],
              let id=session["id"] as? String,!id.isEmpty else{return nil}
        currentDocumentID=id;currentDocumentDraft=draft;currentDocumentStatus=session
        if let path=session["path"] as? String,let digest=session["digest"] as? String {
            currentProjectURL=URL(fileURLWithPath:path);currentProjectDigest=digest
        }
        return session
    }
    func updateDocumentStatus(_ data:[String:Any]) {
        guard let id=data["id"] as? String,!id.isEmpty else{return}
        if id != currentDocumentID {currentProjectURL=nil;currentProjectDigest=nil;currentDocumentID=id}
        currentDocumentStatus=data
        window.isDocumentEdited=data["dirty"] as? Bool ?? false
        window.title=(data["name"] as? String ?? "Formula")+" · Formula"
        window.representedURL=currentProjectURL
    }
    func persistDocumentSession(_ draft:[String:Any],_ status:[String:Any]) throws {
        guard let id=status["id"] as? String,!id.isEmpty else {throw ToolFailure(message:"公式文档身份无效")}
        updateDocumentStatus(status);currentDocumentDraft=draft
        var session:[String:Any]=["version":1,"id":id,"name":status["name"] ?? "未命名公式","savedSignature":status["savedSignature"] ?? NSNull(),"draft":draft]
        if let url=currentProjectURL,let digest=currentProjectDigest {session["path"]=url.path;session["digest"]=digest}
        try JSONSerialization.data(withJSONObject:session).write(to:support.appendingPathComponent("document-session.json"),options:.atomic)
    }
    func bindOpenedProject(_ token:String,documentID:String?) {
        guard let selected=pendingProjectURLs.removeValue(forKey:token),documentID==currentDocumentID else{return}
        currentProjectURL=selected.url;currentProjectDigest=selected.digest;window.representedURL=selected.url
        if let draft=currentDocumentDraft,let status=currentDocumentStatus {
            do {try persistDocumentSession(draft,status)} catch {report("草稿保存失败："+error.localizedDescription,true)}
        }
    }
    func projectDigest(_ url:URL)->String? {
        guard let bytes=try? Data(contentsOf:url) else{return nil}
        return SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
    }
    func saveProject(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        guard let documentID=data["documentID"] as? String,documentID==currentDocumentID,
              let encoded=data["base64"] as? String,let bytes=Data(base64Encoded:encoded) else {reply(id,["error":"公式文档状态无效"]);return}
        let write:(URL)->Void = {url in
            guard self.currentDocumentID==documentID else {self.reply(id,["error":"当前公式已改变，旧保存操作已取消"]);return}
            do {
                try bytes.write(to:url,options:.atomic)
                self.currentProjectURL=url;self.currentProjectDigest=SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined();self.window.representedURL=url
                if let draft=self.currentDocumentDraft,var status=self.currentDocumentStatus,let signature=data["signature"] as? String {
                    status["name"]=url.lastPathComponent;status["savedSignature"]=signature
                    try self.persistDocumentSession(draft,status)
                }
                self.reply(id,["saved":true,"name":url.lastPathComponent])
            } catch {self.reply(id,["error":error.localizedDescription])}
        }
        if data["saveAs"] as? Bool != true,let url=currentProjectURL {
            guard let expected=currentProjectDigest,projectDigest(url)==expected else {
                reply(id,["error":"文件已被其他程序修改、移动或删除。当前编辑已保留，请使用“另存为”保存副本。"]);return
            }
            write(url);return
        }
        let panel=NSSavePanel();panel.nameFieldStringValue=((data["name"] as? String ?? "equation.mathforge") as NSString).deletingPathExtension
        panel.allowedFileTypes=["mathforge"];panel.canCreateDirectories=true
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else {self.reply(id,["cancelled":true]);return}
            write(url)
        }
    }
    func saveFile(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        guard let encoded=data["base64"] as? String,let bytes=Data(base64Encoded:encoded),let name=data["name"] as? String else{reply(id,["error":"导出数据无效"]);return}
        let panel=NSSavePanel();panel.nameFieldStringValue=name;panel.canCreateDirectories=true
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else{self.reply(id,["cancelled":true]);return}
            do{try bytes.write(to:url,options:.atomic);self.reply(id,["saved":true])}catch{self.reply(id,["error":error.localizedDescription])}
        }
    }
    func importFile(_ url:URL) {
        do {
            if url.pathExtension.lowercased()=="pdf" {
                guard let doc=PDFDocument(url:url),let subject=doc.documentAttributes?[PDFDocumentAttribute.subjectAttribute] as? String,subject.hasPrefix("MathForge:") else {throw ToolFailure(message:"该 PDF 不含 Formula 源码。请导入 .tex、.typ 或 .mathforge 文件。")}
                js("window.FormulaImport(\(json(String(subject.dropFirst(10)))), 'mathforge');");return
            }
            let bytes=try Data(contentsOf:url)
            guard let text=String(data:bytes,encoding:.utf8) else {throw ToolFailure(message:"公式文件不是有效的 UTF-8 文本")}
            let ext=url.pathExtension.lowercased()
            let project=(try? JSONSerialization.jsonObject(with:Data(text.utf8))) as? [String:Any]
            let isProject=["mathforge","json"].contains(ext) && project?["format"] as? String == "mathforge-equation"
            let token=UUID().uuidString
            if isProject {pendingProjectURLs[token]=(url,SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined())}
            js("window.FormulaImport(\(json(text)),\(json(ext)),\(isProject ? json(url.lastPathComponent):"undefined"),\(isProject ? json(token):"undefined"));")
        } catch let e as ToolFailure {report(e.message,true)} catch {report(error.localizedDescription,true)}
    }

    // Arguments are passed directly to Process; formula content never becomes a shell command.
    func run(_ executable:String,_ arguments:[String],cwd:URL,timeout:TimeInterval=35,ocrInstall:Bool=false,documentTask:Bool=false) throws -> (Int32,String) {
        guard FileManager.default.isExecutableFile(atPath:executable) else{throw ToolFailure(message:"工具不可执行：\(executable)")}
        let log=cwd.appendingPathComponent("process-\(UUID().uuidString).log")
        FileManager.default.createFile(atPath:log.path,contents:nil)
        let handle=try FileHandle(forWritingTo:log);defer{try? handle.close();try? FileManager.default.removeItem(at:log)}
        let process=Process();process.executableURL=URL(fileURLWithPath:executable);process.arguments=arguments;process.currentDirectoryURL=cwd
        var env=ProcessInfo.processInfo.environment
        env["PATH"]=[URL(fileURLWithPath:executable).deletingLastPathComponent().path,"/Library/TeX/texbin","/opt/homebrew/bin","/usr/local/bin","/usr/bin","/bin",env["PATH"] ?? ""].joined(separator:":")
        env["PYTHONUNBUFFERED"]="1";env["HF_HUB_DISABLE_XET"]="1";env["NO_ALBUMENTATIONS_UPDATE"]="1"
        process.environment=env;process.standardOutput=handle;process.standardError=handle
        if ocrInstall {
            let cancelled=DispatchQueue.main.sync { self.ocrInstallCancelled }
            if cancelled { throw ToolFailure(message:"用户已取消 OCR 安装。") }
        }
        try process.run()
        if ocrInstall { DispatchQueue.main.sync { self.ocrInstallProcess=process } }
        defer { if ocrInstall { DispatchQueue.main.sync { self.ocrInstallProcess=nil } } }
        let end=Date().addingTimeInterval(timeout)
        var lastProgress=Date.distantPast
        while process.isRunning && Date()<end {
            if (ocrInstall && DispatchQueue.main.sync(execute:{self.ocrInstallCancelled})) || (documentTask && DispatchQueue.main.sync(execute:{self.documentCancelled})) { break }
            if ocrInstall && Date().timeIntervalSince(lastProgress)>1 {
                lastProgress=Date()
                if let output=try? String(contentsOf:log,encoding:.utf8) {
                    let tail=String(output.suffix(20000))
                    DispatchQueue.main.async { self.js("window.FormulaOCRInstallLog?.(\(self.json(tail)));") }
                }
            }
            Thread.sleep(forTimeInterval:0.1)
        }
        if documentTask && DispatchQueue.main.sync(execute:{self.documentCancelled}) {
            stopProcessTree(process);process.waitUntilExit();throw ToolFailure(message:"已取消文档识别。")
        }
        if ocrInstall && DispatchQueue.main.sync(execute:{self.ocrInstallCancelled}) {
            stopProcessTree(process)
            process.waitUntilExit()
            let detail=(try? String(contentsOf:log,encoding:.utf8)) ?? ""
            throw ToolFailure(message:"用户已取消 OCR 安装。\n"+String(detail.suffix(12000)))
        }
        if process.isRunning {stopProcessTree(process);process.waitUntilExit();let detail=(try? String(contentsOf:log,encoding:.utf8)) ?? "";throw ToolFailure(message:"工具执行超时（\(Int(timeout)) 秒）\n"+String(detail.suffix(12000)))}
        process.waitUntilExit();let text=(try? String(contentsOf:log,encoding:.utf8)) ?? ""
        if ocrInstall && DispatchQueue.main.sync(execute:{self.ocrInstallCancelled}) { throw ToolFailure(message:"用户已取消 OCR 安装。") }
        return (process.terminationStatus,String(text.suffix(20000)))
    }
    // pip build helpers and page-detector subprocesses must end with their parent.
    func stopProcessTree(_ process:Process) {
        guard process.isRunning else { return }
        let scan=Process();scan.executableURL=URL(fileURLWithPath:"/bin/ps")
        scan.arguments=["-axo","pid=,ppid="]
        let pipe=Pipe();scan.standardOutput=pipe
        var descendants:[Int32]=[]
        if (try? scan.run()) != nil {
            let bytes=pipe.fileHandleForReading.readDataToEndOfFile();scan.waitUntilExit()
            let pairs=(String(data:bytes,encoding:.utf8) ?? "").split(separator:"\n").compactMap { line -> (Int32,Int32)? in
                let fields=line.split(whereSeparator:{$0.isWhitespace})
                guard fields.count==2,let pid=Int32(fields[0]),let parent=Int32(fields[1]) else { return nil }
                return (pid,parent)
            }
            var parents=[process.processIdentifier]
            while !parents.isEmpty {
                let next=pairs.filter { parents.contains($0.1) }.map {$0.0}
                descendants+=next;parents=next
            }
        }
        for pid in descendants.reversed() { kill(pid,SIGTERM) }
        process.terminate();Thread.sleep(forTimeInterval:0.2)
        for pid in descendants.reversed() { kill(pid,SIGKILL) }
        if process.isRunning { kill(process.processIdentifier,SIGKILL) }
    }
    func discover(_ key:String,_ current:String?,cwd:URL) -> [String:String] {
        let names=key=="latex" ? ["xelatex","pdflatex","lualatex"] : [key]
        var candidates:[String]=[];if let current=current {candidates.append(current)}
        for dir in ["/Library/TeX/texbin","/opt/homebrew/bin","/usr/local/bin","/usr/bin",NSHomeDirectory()+"/.local/bin",NSHomeDirectory()+"/.cargo/bin"] {for name in names{candidates.append(dir+"/"+name)}}
        // Fixed tool names only; there is no user input in this login-shell command.
        for name in names {if let result=try? run("/bin/zsh",["-lc","command -v \(name)"],cwd:cwd,timeout:8),result.0==0{candidates.append(result.1.trimmingCharacters(in:.whitespacesAndNewlines))}}
        for path in candidates where FileManager.default.isExecutableFile(atPath:path) {
            if let result=try? run(path,["--version"],cwd:cwd,timeout:8),result.0==0{return ["path":path,"version":String(result.1.split(separator:"\n").first ?? "")]}
        }
        return ["path":"","version":"未安装，或当前路径不可执行"]
    }
    func scanTools() {
        let current=toolPaths
        worker.async {
            let dir=FileManager.default.temporaryDirectory.appendingPathComponent("Formula-scan-\(UUID().uuidString)");try? FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:dir)}
            var result:[String:[String:String]]=[:]
            for key in ["latex","typst","dvisvgm","pdftops"] {result[key]=self.discover(key,current[key],cwd:dir)}
            let completed=result
            DispatchQueue.main.async {for (key,tool) in completed{self.toolPaths[key]=tool["path"]};UserDefaults.standard.set(self.toolPaths,forKey:"toolPaths");self.js("window.FormulaTools(\(self.json(completed)));")}
        }
    }
    func chooseTool(_ key:String) {
        guard ["latex","typst","dvisvgm","pdftops"].contains(key) else{return}
        let panel=NSOpenPanel();panel.title="选择 \(key) 可执行文件";panel.canChooseDirectories=false;panel.showsHiddenFiles=true;panel.directoryURL=URL(fileURLWithPath:"/opt/homebrew/bin")
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else{return}
            guard FileManager.default.isExecutableFile(atPath:url.path) else{self.report("请选择可执行文件，而不是安装目录。",true);return}
            if key=="latex" && ["latex","tex","xetex","luatex","pdftex"].contains(url.lastPathComponent) {self.report("请选择 xelatex、pdflatex 或 lualatex；latex 默认生成 DVI，不能直接作为 PDF 排版引擎。",true);return}
            self.toolPaths[key]=url.path;UserDefaults.standard.set(self.toolPaths,forKey:"toolPaths");self.scanTools()
        }
    }

    func render(_ request:[String:Any],paths:[String:String]) -> [String:Any] {
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent("Formula-render-\(UUID().uuidString)")
        var log=""
        do {
            try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:dir)}
            let engine=request["engine"] as? String ?? "latex"
            guard let path=paths[engine],!path.isEmpty else{throw ToolFailure(message:"未检测到 \(engine)。请打开系统工具安装或指定路径。")}
            if engine=="latex" && ["latex","tex","xetex","luatex","pdftex"].contains(URL(fileURLWithPath:path).lastPathComponent) {throw ToolFailure(message:"当前选中的不是 PDF LaTeX 引擎。请在系统工具中指定 xelatex、pdflatex 或 lualatex。")}
            let source=request["source"] as? String ?? ""
            let o=request["options"] as? [String:Any] ?? [:]
            let size=max(10,min(160,(o["size"] as? NSNumber)?.doubleValue ?? 32))
            let padding=max(0,min(80,(o["padding"] as? NSNumber)?.doubleValue ?? 12))*0.75
            let scale=max(0.75,min(12.5,(o["scale"] as? NSNumber)?.doubleValue ?? 3))
            let color=o["color"] as? String ?? "#18232f"
            guard color.range(of:"^#[0-9A-Fa-f]{6}$",options:.regularExpression) != nil else{throw ToolFailure(message:"颜色设置无效")}
            let backgroundColor=o["backgroundColor"] as? String ?? ((o["transparent"] as? Bool ?? true) ? "transparent":"#ffffff")
            let transparent=backgroundColor == "transparent"
            guard transparent || backgroundColor.range(of:"^#[0-9A-Fa-f]{6}$",options:.regularExpression) != nil else {throw ToolFailure(message:"背景颜色设置无效")}
            let pdfURL=dir.appendingPathComponent("equation.pdf")
            let svgURL=dir.appendingPathComponent("equation.svg")
            if engine=="typst" {
                let fill=transparent ? "none" : "rgb(\"\(backgroundColor)\")"
                let preamble=o["typstPreamble"] as? String ?? ""
                let display=o["displayMode"] as? String != "inline"
                let document="""
                #set page(width: auto, height: auto, margin: \(padding)pt, fill: \(fill))
                #set text(size: \(size)pt, fill: rgb("\(color)"))
                \(preamble)
                \(typstSourceBody(source,display:display))
                """
                try document.write(to:dir.appendingPathComponent("equation.typ"),atomically:true,encoding:.utf8)
                for format in ["pdf","svg"] {
                    let result=try run(path,["compile","--root",dir.path,"--format",format,"equation.typ","equation.\(format)"],cwd:dir)
                    log+=result.1+"\n";if result.0 != 0{throw ToolFailure(message:"Typst 编译失败，请查看编译日志。")}
                }
            } else {
                let preamble=o["preamble"] as? String ?? "\\usepackage{amsmath,amssymb}\n\\usepackage{xcolor}"
                let display=o["displayMode"] as? String != "inline"
                let environment=source.range(of:"\\\\begin\\{(align\\*?|gather\\*?|multline\\*?|equation\\*?|eqnarray\\*?)\\}",options:.regularExpression) != nil
                let body=environment ? source : "$\(display ? "\\displaystyle ":"")\(source)$"
                let document="""
                \\IfFileExists{fix-cm.sty}{\\RequirePackage{fix-cm}}{}
                \\documentclass[border=\(padding)pt\(environment ? ",varwidth=true":"")]{standalone}
                \\usepackage{amsmath,amssymb,xcolor}
                \(preamble)
                \\begin{document}
                \\definecolor{formula}{HTML}{\(String(color.dropFirst()))}
                \\color{formula}\\fontsize{\(size)}{\(size*1.2)}\\selectfont
                \(body)
                \\end{document}
                """
                try document.write(to:dir.appendingPathComponent("equation.tex"),atomically:true,encoding:.utf8)
                let result=try run(path,["-no-shell-escape","-interaction=nonstopmode","-halt-on-error","-file-line-error","-output-directory",dir.path,"equation.tex"],cwd:dir)
                log+="引擎：\(path)\n"+result.1
                var exitCode=result.0
                let missingStandalone=result.1.range(of:#"standalone\.cls[^\n]*(?:not found|cannot be found)"#,options:.regularExpression) != nil
                if exitCode != 0 && missingStandalone && !environment {
                    log+="\n未找到 standalone.cls，切换到 article 公式盒自动裁切模式。\n"
                    let fallback=latexFallback(source:source,size:size,padding:padding,color:color,preamble:preamble,display:display)
                    try fallback.write(to:dir.appendingPathComponent("equation.tex"),atomically:true,encoding:.utf8)
                    let retry=try run(path,["-no-shell-escape","-interaction=nonstopmode","-halt-on-error","-file-line-error","-output-directory",dir.path,"equation.tex"],cwd:dir)
                    log+=retry.1;exitCode=retry.0
                }
                if exitCode != 0 {throw ToolFailure(message:latexError(log))}
                if let dvisvgm=paths["dvisvgm"],!dvisvgm.isEmpty {
                    do{let result=try run(dvisvgm,["--pdf","--no-fonts","--output="+svgURL.path,pdfURL.path],cwd:dir);log+="\n"+result.1}catch{log+="\nSVG 转换：\(error)"}
                }
            }
            if !transparent {try formulaBackgroundPDF(pdfURL,hex:backgroundColor)}
            guard let doc=PDFDocument(url:pdfURL),doc.pageCount==1,let page=doc.page(at:0) else{throw ToolFailure(message:"请只输入单页数学公式，不要输入完整多页文档。")}
            let bounds=page.bounds(for:.mediaBox)
            let pixels=CGFloat(scale*4/3)
            let width=Int(ceil(bounds.width*pixels)),height=Int(ceil(bounds.height*pixels))
            guard width>0,height>0,width<=16000,height<=16000,width*height<=50000000 else{throw ToolFailure(message:"公式图片尺寸过大，请减小字号或清晰度。")}
            guard let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0),let context=NSGraphicsContext(bitmapImageRep:bitmap) else{throw ToolFailure(message:"不能创建公式图像。")}
            NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=context
            let cg=context.cgContext
            if !transparent {cg.setFillColor(NSColor.white.cgColor);cg.fill(CGRect(x:0,y:0,width:CGFloat(width),height:CGFloat(height)))}
            cg.scaleBy(x:pixels,y:pixels);page.draw(with:.mediaBox,to:cg);NSGraphicsContext.restoreGraphicsState()
            bitmap.size=NSSize(width:CGFloat(width)/pixels,height:CGFloat(height)/pixels)
            let png=bitmap.representation(using:.png,properties:[:])!
            let tiff=bitmap.representation(using:.tiff,properties:[:])!
            // JPEG has no alpha; composite the same PDF on white.
            let white=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
            let whiteContext=NSGraphicsContext(bitmapImageRep:white)!
            NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=whiteContext;let wc=whiteContext.cgContext;wc.setFillColor(NSColor.white.cgColor);wc.fill(CGRect(x:0,y:0,width:CGFloat(width),height:CGFloat(height)));wc.scaleBy(x:pixels,y:pixels);page.draw(with:.mediaBox,to:wc);NSGraphicsContext.restoreGraphicsState()
            let jpeg=white.representation(using:.jpeg,properties:[.compressionFactor:0.96])!
            let saved:[String:Any]=["format":"mathforge-equation","version":1,"state":request["document"] as? [String:Any] ?? ["rawSource":source,"editorMode":engine=="typst" ? "typst":"latex","size":size,"padding":padding/0.75,"color":color,"backgroundColor":backgroundColor,"transparent":transparent,"scale":scale,"preamble":o["preamble"] ?? "","typstPreamble":o["typstPreamble"] ?? "","displayMode":o["displayMode"] ?? "display"]]
            var attrs=doc.documentAttributes ?? [:];attrs[PDFDocumentAttribute.subjectAttribute]="MathForge:"+json(saved);attrs[PDFDocumentAttribute.titleAttribute]="Formula equation";doc.documentAttributes=attrs
            let pdf=doc.dataRepresentation()!
            var result:[String:Any]=["engine":URL(fileURLWithPath:path).lastPathComponent,"pdf":pdf.base64EncodedString(),"png":png.base64EncodedString(),"tiff":tiff.base64EncodedString(),"jpeg":jpeg.base64EncodedString(),"width":width,"height":height]
            if var svg=try? String(contentsOf:svgURL,encoding:.utf8),let range=svg.range(of:"<svg"),let close=svg[range.lowerBound...].firstIndex(of:">") {
                let metadata=json(saved).replacingOccurrences(of:"&",with:"&amp;").replacingOccurrences(of:"<",with:"&lt;").replacingOccurrences(of:">",with:"&gt;")
                svg.insert(contentsOf:"<metadata>\(metadata)</metadata>",at:svg.index(after:close))
                if !transparent,let vbr=svg.range(of:"viewBox=\"[^\"]+\"",options:.regularExpression){let text=String(svg[vbr]).replacingOccurrences(of:"viewBox=\"",with:"").replacingOccurrences(of:"\"",with:"");let parts=text.split(separator:" ");if parts.count==4{let rect="<rect x=\"\(parts[0])\" y=\"\(parts[1])\" width=\"\(parts[2])\" height=\"\(parts[3])\" fill=\"\(backgroundColor)\"/>";if let r=svg.range(of:"<metadata>"){svg.insert(contentsOf:rect,at:r.lowerBound)}}}
                result["svg"]=svg.data(using:.utf8)!.base64EncodedString()
            }
            if let pdftops=paths["pdftops"],!pdftops.isEmpty {do{let eps=dir.appendingPathComponent("equation.eps");let r=try run(pdftops,["-eps",pdfURL.path,eps.path],cwd:dir);log+="\n"+r.1;if r.0==0,let data=try? Data(contentsOf:eps){result["eps"]=data.base64EncodedString()}}catch{log+="\nEPS 转换：\(error)"}}
            result["log"]=log;return result
        } catch let e as ToolFailure {return ["error":e.message,"log":log+"\n"+e.message]} catch {return ["error":error.localizedDescription,"log":log+"\n"+error.localizedDescription]}
    }
    func latexError(_ log:String) -> String {
        let lines=log.components(separatedBy:.newlines)
        if let line=lines.last(where:{$0.contains("not found") && ($0.contains(".sty") || $0.contains(".cls"))}) {return "LaTeX 缺少宏包：\(line.trimmingCharacters(in:.whitespaces))。请通过 TeX 的包管理器补齐；完整信息见编译日志。"}
        if let line=lines.last(where:{$0.contains("Undefined control sequence") || $0.contains("LaTeX Error:") || $0.contains("Emergency stop") || $0.contains("I can't find") || $0.contains("Fatal error")}) {return "LaTeX 编译失败：\(line.trimmingCharacters(in:.whitespaces))"}
        return "LaTeX 编译失败，请打开完整编译日志查看具体原因。"
    }
    func latexFallback(source:String,size:Double,padding:Double,color:String,preamble:String,display:Bool) -> String {
        return """
        \\IfFileExists{fix-cm.sty}{\\RequirePackage{fix-cm}}{}
        \\documentclass{article}
        \\usepackage{amsmath,amssymb,xcolor}
        \(preamble)
        \\pagestyle{empty}
        \\begin{document}
        \\definecolor{formula}{HTML}{\(String(color.dropFirst()))}
        \\setbox0=\\hbox{\\color{formula}\\fontsize{\(size)}{\(size*1.2)}\\selectfont $\(display ? "\\displaystyle ":"")\(source)$}
        \\dimen0=\\wd0 \\advance\\dimen0 by \(padding*2)pt
        \\dimen2=\\ht0 \\advance\\dimen2 by \\dp0 \\advance\\dimen2 by \(padding*2)pt
        \\ifdefined\\pdfpagewidth
          \\pdfpagewidth=\\dimen0 \\pdfpageheight=\\dimen2
        \\else\\ifdefined\\pagewidth
          \\pagewidth=\\dimen0 \\pageheight=\\dimen2
        \\else
          \\special{papersize=\\the\\dimen0,\\the\\dimen2}
        \\fi\\fi
        \\hoffset=-1in \\voffset=-1in
        \\shipout\\vbox{\\offinterlineskip\\kern \(padding)pt\\hbox{\\kern \(padding)pt\\box0\\kern \(padding)pt}\\kern \(padding)pt}
        \\end{document}
        """
    }
    func dragFile(_ data:[String:Any]) {
        guard let encoded=data["base64"] as? String,let bytes=Data(base64Encoded:encoded),let name=data["name"] as? String,let event=web.lastMouseEvent else{return}
        let dir=support.appendingPathComponent("DragExports");try? FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
        let url=dir.appendingPathComponent(URL(fileURLWithPath:name).lastPathComponent);try? bytes.write(to:url,options:.atomic)
        let item=NSDraggingItem(pasteboardWriter:url as NSURL)
        let location=web.convert(event.locationInWindow,from:nil)
        item.setDraggingFrame(NSRect(x:location.x,y:location.y,width:64,height:64),contents:NSWorkspace.shared.icon(forFile:url.path))
        web.beginDraggingSession(with:[item],event:event,source:self)
    }
    func draggingSession(_ session:NSDraggingSession,sourceOperationMaskFor context:NSDraggingContext)->NSDragOperation {.copy}
}

let app=NSApplication.shared
app.setActivationPolicy(.regular)
let delegate=AppDelegate()
app.delegate=delegate
app.run()
