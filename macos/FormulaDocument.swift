import Cocoa
import WebKit
import PDFKit
import UniformTypeIdentifiers

extension AppDelegate {
    private var wordVenv:URL { ocrRoot.appendingPathComponent("venv-document",isDirectory:true) }
    private var wordPython:URL { wordVenv.appendingPathComponent("bin/python3") }
    private var wordReady:URL { ocrRoot.appendingPathComponent("ready-document-v2.txt") }
    private var documentRunner:URL { Bundle.main.resourceURL!.appendingPathComponent("formula-document-runner.py") }

    func handleDocumentInstall(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        guard !ocrBusy && !ocrInstallBusy else { reply(id,["error":"已有安装或识别任务正在运行。"]);return }
        ocrInstallBusy=true;ocrInstallingEngine="document";ocrBasicInstalling=false;ocrInstallCancelled=false
        DispatchQueue.global(qos:.utility).async {
            let stage=self.ocrRoot.appendingPathComponent("environment-"+UUID().uuidString,isDirectory:true)
            var log="";var result:[String:Any]
            do {
                defer { if self.ocrPath(stage) != self.ocrPath(self.wordVenv.resolvingSymlinksInPath()) { try? FileManager.default.removeItem(at:stage) } }
                self.reportOCRPhase("正在安装独立 Word 解析组件…")
                let python=try self.prepareOCREnvironment(stage,requirements:Bundle.main.resourceURL!.appendingPathComponent("document-requirements.txt"),log:&log)
                let r=try self.run(python.path,[self.documentRunner.path,"--check"],cwd:self.ocrRoot,timeout:60,ocrInstall:true);log+=r.1
                guard r.0 == 0 && r.1.contains("FORMULA_DOCUMENT_READY=1") else { throw self.ocrFailure("Word 组件验证失败。",log) }
                try self.activateOCREnvironment(stage,self.wordVenv,markers:[self.wordReady])
                result=["installed":true,"message":"Word 解析组件已就绪。","log":String(log.suffix(20000))]
            } catch let e as ToolFailure { result=["error":e.message,"log":String((log+"\n"+e.message).suffix(20000))] }
            catch { result=["error":error.localizedDescription,"log":String(log.suffix(20000))] }
            let completed=result
            DispatchQueue.main.async {self.ocrInstallBusy=false;self.ocrInstallingEngine="";self.ocrInstallProcess=nil;self.ocrSizeUpdated=Date.distantPast;self.reply(id,completed)}
        }
    }

    func documentProgress(_ id:String,_ message:String) {
        DispatchQueue.main.async { self.js("window.FormulaOCRProgress?.(\(self.json(id)),\(self.json(["message":message])));") }
    }
    func checkDocumentCancellation() throws {
        if DispatchQueue.main.sync(execute:{self.documentCancelled}) { throw ToolFailure(message:"已取消文档识别。") }
    }

    func handleDocumentRecognize(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let engine=validOCREngine(data["engine"])
        let first=data["first"] as? Int ?? 1,last=data["last"] as? Int ?? 0
        guard first>=1,last>=0,(last==0 || (last>=first && last-first<20)) else {reply(id,["error":"PDF 页码无效，每次最多识别 20 页。"]);return}
        guard !ocrBusy && !(ocrInstallBusy && (engine != "pix2text" || ocrBasicInstalling)) else {reply(id,["error":"所选识别组件正在忙，请稍后重试。"]);return}
        guard ocrInstalled(engine),FileManager.default.fileExists(atPath:ocrMFDReady.path) else {reply(id,["error":"请先安装基础识别与 MFD；专业识别需安装专业版。"]);return}
        ocrBusy=true;documentCancelled=false
        let panel=NSOpenPanel();panel.title="选择 PDF 或 Word 文档";panel.canChooseDirectories=false;panel.canChooseFiles=true;panel.allowsMultipleSelection=false
        panel.allowedContentTypes=[.pdf,UTType(filenameExtension:"docx")!]
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else {self.ocrBusy=false;self.reply(id,["cancelled":true]);return}
            self.ocrWorker.async {
                let result=self.recognizeDocument(url,engine:engine,first:first,last:last,id:id)
                DispatchQueue.main.async {self.ocrBusy=false;self.reply(id,result)}
            }
        }
    }

    func documentPagePNG(_ page:PDFPage) throws -> Data {
        let bounds=page.bounds(for:.cropBox)
        guard bounds.width.isFinite,bounds.height.isFinite,bounds.width>0,bounds.height>0 else {throw ToolFailure(message:"PDF 页面尺寸无效。")}
        let scale=min(3.0,2200/max(bounds.width,bounds.height))
        let width=max(1,Int(ceil(bounds.width*scale))),height=max(1,Int(ceil(bounds.height*scale)))
        guard let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {throw ToolFailure(message:"无法渲染 PDF 页面。")}
        context.setFillColor(NSColor.white.cgColor);context.fill(CGRect(x:0,y:0,width:width,height:height))
        context.scaleBy(x:scale,y:scale);context.translateBy(x:-bounds.minX,y:-bounds.minY)
        page.draw(with:.cropBox,to:context)
        guard let image=context.makeImage(),let png=NSBitmapImageRep(cgImage:image).representation(using:.png,properties:[:]) else {throw ToolFailure(message:"无法生成 PDF 页面图片。")}
        return png
    }

    func recognizeDocument(_ source:URL,engine:String,first:Int,last:Int,id:String) -> [String:Any] {
        let fm=FileManager.default
        let temp=ocrRoot.appendingPathComponent("document-"+UUID().uuidString,isDirectory:true)
        var formulas:[[String:Any]]=[],warnings:[String]=[],log=""
        do {
            guard let size=try source.resourceValues(forKeys:[.fileSizeKey]).fileSize,size<=100*1024*1024 else {throw ToolFailure(message:"文档超过 100 MB，请拆分后重试。")}
            try fm.createDirectory(at:temp,withIntermediateDirectories:true)
            defer {try? fm.removeItem(at:temp)}
            func recognizeImage(_ image:URL,_ location:String) throws {
                try checkDocumentCancellation()
                let result=recognizeFormula(image,engine:engine,page:true,documentTask:true)
                if let detail=result["log"] as? String {log=String((log+"\n"+detail).suffix(20000))}
                try checkDocumentCancellation()
                if let error=result["error"] as? String {throw ToolFailure(message:location+"："+error)}
                for var item in result["formulas"] as? [[String:Any]] ?? [] {item["source"]=location;formulas.append(item)}
                guard formulas.count<=1000 else {throw ToolFailure(message:"公式超过 1000 个，请拆分文档。")}
            }
            if source.pathExtension.lowercased()=="pdf" {
                guard let pdf=PDFDocument(url:source) else {throw ToolFailure(message:"无法打开 PDF，文件可能已损坏。")}
                guard !pdf.isLocked else {throw ToolFailure(message:"PDF 已加密，请先解除密码保护。")}
                let total=pdf.pageCount,end=last==0 ? min(total,first+19) : last
                guard first>=1,first<=total,end>=first,end<=total,end-first<20 else {throw ToolFailure(message:"PDF 页码超出范围，共 \(total) 页；每次最多识别 20 页。")}
                if end<total || first>1 {warnings.append("本次仅处理第 \(first)–\(end) 页，文档共 \(total) 页。")}
                for number in first...end {
                    try checkDocumentCancellation()
                    documentProgress(id,"正在识别 PDF 第 \(number) 页（\(number-first+1)/\(end-first+1)）…")
                    let image=temp.appendingPathComponent("page.png")
                    guard let page=pdf.page(at:number-1) else {throw ToolFailure(message:"无法读取 PDF 第 \(number) 页。")}
                    try autoreleasepool {try documentPagePNG(page).write(to:image,options:.atomic)}
                    try recognizeImage(image,"第 \(number) 页")
                }
            } else if source.pathExtension.lowercased()=="docx" {
                guard fm.isExecutableFile(atPath:wordPython.path),fm.fileExists(atPath:wordReady.path) else {throw ToolFailure(message:"请先安装 Word 解析组件。PDF 识别可直接使用基础版。")}
                documentProgress(id,"正在读取 Word 原生公式和嵌入图片…")
                let r=try run(wordPython.path,[documentRunner.path,source.path,"--output-dir",temp.path],cwd:temp,timeout:90,documentTask:true);log=r.1
                guard r.0==0 else {throw ocrFailure("Word 解析失败。",log)}
                let bytes=try Data(contentsOf:temp.appendingPathComponent("document.json"))
                guard bytes.count<=8000000,let payload=try JSONSerialization.jsonObject(with:bytes) as? [String:Any],let entries=payload["entries"] as? [[String:Any]] else {throw ToolFailure(message:"Word 结果格式无效。")}
                warnings += payload["warnings"] as? [String] ?? []
                for (index,entry) in entries.enumerated() {
                    try checkDocumentCancellation()
                    let location=entry["source"] as? String ?? "Word"
                    if let image=entry["image"] as? String {
                        guard URL(fileURLWithPath:image).lastPathComponent==image else {throw ToolFailure(message:"Word 图片路径无效。")}
                        documentProgress(id,"正在识别 \(location)（\(index+1)/\(entries.count)）…")
                        try recognizeImage(temp.appendingPathComponent(image),location)
                    } else if entry["latex"] is String {formulas.append(entry)}
                }
            } else {throw ToolFailure(message:"目前支持 PDF 和 .docx；旧版 .doc 请另存为 .docx。")}
            try checkDocumentCancellation()
            return ["formulas":formulas,"warnings":warnings,"sourceName":source.lastPathComponent,"engine":engine=="unimernet" ? "UniMERNet Tiny" : "Pix2Text","log":log]
        } catch let e as ToolFailure {return ["error":e.message,"log":String((log+"\n"+e.message).suffix(20000))]}
        catch {return ["error":error.localizedDescription,"log":String(log.suffix(20000))]}
    }
}
