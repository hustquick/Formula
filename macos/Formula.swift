import Cocoa
import WebKit
import PDFKit
import Darwin

struct ToolFailure: Error { let message: String }

final class MathWebView: WKWebView {
    var lastMouseEvent: NSEvent?
    override func mouseDown(with event: NSEvent) { lastMouseEvent = event; super.mouseDown(with: event) }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSDraggingSource {
    var window: NSWindow!
    var web: MathWebView!
    var toolPaths: [String:String] = UserDefaults.standard.dictionary(forKey: "toolPaths") as? [String:String] ?? [:]
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MathForge")
    let worker = DispatchQueue(label: "Formula.compiler")
    var queuedImports: [URL] = []
    var ready = false
    let ocrWorker = DispatchQueue(label: "Formula.ocr")
    var ocrBusy = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "mathforge")
        if let data = try? Data(contentsOf: support.appendingPathComponent("state.json")), let json = String(data:data,encoding:.utf8) {
            config.userContentController.addUserScript(WKUserScript(source:"window.FormulaSavedState = \(json);",injectionTime:.atDocumentStart,forMainFrameOnly:true))
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
    @objc func about() { let alert=NSAlert();alert.messageText="Formula 1.0.11";alert.informativeText="本地公式工坊\nMathLive 可视化编辑 · LaTeX / Typst\n内置与系统排版引擎 · 矢量导出\n\n第三方许可见应用资源 THIRD-PARTY-NOTICES.txt。";alert.runModal() }
    @objc func showTools() {js("document.getElementById('system-tools').click();")}
    @objc func copySource() {js("window.FormulaAction('copy');")}
    @objc func menuAction(_ item:NSMenuItem) {let actions=["import","svg","pdf","png","project"];js("window.FormulaAction('\(actions[item.tag])');")}

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,let data=message.body as? [String:Any],let action=data["action"] as? String else{return}
        switch action {
        case "state":
            if let state=data["state"],let bytes=try? JSONSerialization.data(withJSONObject:state) {try? bytes.write(to:support.appendingPathComponent("state.json"),options:.atomic)}
        case "copy":
            guard let text=data["text"] as? String else{return};let p=NSPasteboard.general;p.clearContents();p.setString(text,forType:.string)
            if data["format"] as? String == "svg",let bytes=text.data(using:.utf8) {p.setData(bytes,forType:NSPasteboard.PasteboardType("public.svg-image"))}
        case "copyImage":
            let p=NSPasteboard.general;p.clearContents()
            for (key,type) in [("png",NSPasteboard.PasteboardType.png),("pdf",.pdf),("svg",NSPasteboard.PasteboardType("public.svg-image"))] {if let encoded=data[key] as? String,let bytes=Data(base64Encoded:encoded){p.setData(bytes,forType:type)}}
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
        case "ocrRecognize":handleOCRRecognize(data)
        case "drag":dragFile(data)
        default:break
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
            let text=try String(contentsOf:url,encoding:.utf8)
            js("window.FormulaImport(\(json(text)),\(json(url.pathExtension.lowercased())));")
        } catch let e as ToolFailure {report(e.message,true)} catch {report(error.localizedDescription,true)}
    }

    // Arguments are passed directly to Process; formula content never becomes a shell command.
    func run(_ executable:String,_ arguments:[String],cwd:URL,timeout:TimeInterval=35) throws -> (Int32,String) {
        guard FileManager.default.isExecutableFile(atPath:executable) else{throw ToolFailure(message:"工具不可执行：\(executable)")}
        let log=cwd.appendingPathComponent("process-\(UUID().uuidString).log")
        FileManager.default.createFile(atPath:log.path,contents:nil)
        let handle=try FileHandle(forWritingTo:log);defer{try? handle.close();try? FileManager.default.removeItem(at:log)}
        let process=Process();process.executableURL=URL(fileURLWithPath:executable);process.arguments=arguments;process.currentDirectoryURL=cwd
        var env=ProcessInfo.processInfo.environment
        env["PATH"]=[URL(fileURLWithPath:executable).deletingLastPathComponent().path,"/Library/TeX/texbin","/opt/homebrew/bin","/usr/local/bin","/usr/bin","/bin",env["PATH"] ?? ""].joined(separator:":")
        process.environment=env;process.standardOutput=handle;process.standardError=handle
        try process.run();let end=Date().addingTimeInterval(timeout)
        while process.isRunning && Date()<end {Thread.sleep(forTimeInterval:0.05)}
        if process.isRunning {process.terminate();Thread.sleep(forTimeInterval:0.2);if process.isRunning{kill(process.processIdentifier,SIGKILL)};process.waitUntilExit();let detail=(try? String(contentsOf:log,encoding:.utf8)) ?? "";throw ToolFailure(message:"工具执行超时（\(Int(timeout)) 秒）\n"+String(detail.suffix(12000)))}
        process.waitUntilExit();let text=(try? String(contentsOf:log,encoding:.utf8)) ?? ""
        return (process.terminationStatus,String(text.suffix(20000)))
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
            let scale=max(1,min(4,(o["scale"] as? NSNumber)?.doubleValue ?? 3))
            let color=o["color"] as? String ?? "#18232f"
            guard color.range(of:"^#[0-9A-Fa-f]{6}$",options:.regularExpression) != nil else{throw ToolFailure(message:"颜色设置无效")}
            let transparent=o["transparent"] as? Bool ?? true
            let pdfURL=dir.appendingPathComponent("equation.pdf")
            let svgURL=dir.appendingPathComponent("equation.svg")
            if engine=="typst" {
                let fill=transparent ? "none" : "white"
                let preamble=o["typstPreamble"] as? String ?? ""
                let display=o["displayMode"] as? String != "inline"
                let document="""
                #set page(width: auto, height: auto, margin: \(padding)pt, fill: \(fill))
                #set text(size: \(size)pt, fill: rgb("\(color)"))
                \(preamble)
                \(display ? "$ ":"$")\(source)\(display ? " $":"$")
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
            let png=bitmap.representation(using:.png,properties:[:])!
            let tiff=bitmap.representation(using:.tiff,properties:[:])!
            // JPEG has no alpha; composite the same PDF on white.
            let white=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
            let whiteContext=NSGraphicsContext(bitmapImageRep:white)!
            NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=whiteContext;let wc=whiteContext.cgContext;wc.setFillColor(NSColor.white.cgColor);wc.fill(CGRect(x:0,y:0,width:CGFloat(width),height:CGFloat(height)));wc.scaleBy(x:pixels,y:pixels);page.draw(with:.mediaBox,to:wc);NSGraphicsContext.restoreGraphicsState()
            let jpeg=white.representation(using:.jpeg,properties:[.compressionFactor:0.96])!
            let saved:[String:Any]=["format":"mathforge-equation","version":1,"state":["rawSource":source,"mode":engine=="typst" ? "typst":"latex","engine":engine,"size":size,"padding":padding/0.75,"color":color,"transparent":transparent,"scale":scale,"preamble":o["preamble"] ?? "","typstPreamble":o["typstPreamble"] ?? "","displayMode":o["displayMode"] ?? "display"]]
            var attrs=doc.documentAttributes ?? [:];attrs[PDFDocumentAttribute.subjectAttribute]="MathForge:"+json(saved);attrs[PDFDocumentAttribute.titleAttribute]="Formula equation";doc.documentAttributes=attrs
            let pdf=doc.dataRepresentation()!
            var result:[String:Any]=["engine":URL(fileURLWithPath:path).lastPathComponent,"pdf":pdf.base64EncodedString(),"png":png.base64EncodedString(),"tiff":tiff.base64EncodedString(),"jpeg":jpeg.base64EncodedString(),"width":width,"height":height]
            if var svg=try? String(contentsOf:svgURL,encoding:.utf8),let range=svg.range(of:"<svg"),let close=svg[range.lowerBound...].firstIndex(of:">") {
                let metadata=json(saved).replacingOccurrences(of:"&",with:"&amp;").replacingOccurrences(of:"<",with:"&lt;").replacingOccurrences(of:">",with:"&gt;")
                svg.insert(contentsOf:"<metadata>\(metadata)</metadata>",at:svg.index(after:close))
                if !transparent,let vbr=svg.range(of:"viewBox=\"[^\"]+\"",options:.regularExpression){let text=String(svg[vbr]).replacingOccurrences(of:"viewBox=\"",with:"").replacingOccurrences(of:"\"",with:"");let parts=text.split(separator:" ");if parts.count==4{let rect="<rect x=\"\(parts[0])\" y=\"\(parts[1])\" width=\"\(parts[2])\" height=\"\(parts[3])\" fill=\"white\"/>";if let r=svg.range(of:"<metadata>"){svg.insert(contentsOf:rect,at:r.lowerBound)}}}
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
