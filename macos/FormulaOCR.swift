import Cocoa
import WebKit
import UniformTypeIdentifiers
import PDFKit
import ImageIO

extension AppDelegate {
    // Fixed shared OCR environment: independent of app identity and debug data roots.
    // Keep the existing location; moving venvs would invalidate their absolute shebangs.
    private var ocrRoot: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MathForge/OCR", isDirectory: true).standardizedFileURL.resolvingSymlinksInPath() }
    private var ocrVenv: URL { ocrRoot.appendingPathComponent("venv", isDirectory: true) }
    private var ocrUniVenv: URL { ocrRoot.appendingPathComponent("venv-unimernet", isDirectory: true) }
    private var ocrUniPython: URL { ocrUniVenv.appendingPathComponent("bin/python3") }
    private var ocrPixReady: URL { ocrRoot.appendingPathComponent("ready-pix2text-v2.txt") }
    private var ocrUniReady: URL { ocrRoot.appendingPathComponent("ready-unimernet-v2.txt") }
    private var ocrMFDReady: URL { ocrRoot.appendingPathComponent("ready-mfd-v2.txt") }
    private var ocrPython: URL { ocrVenv.appendingPathComponent("bin/python3") }
    private var bundledOCRRequirements: URL { Bundle.main.resourceURL!.appendingPathComponent("ocr-requirements.txt") }
    private var bundledOCRRunner: URL { Bundle.main.resourceURL!.appendingPathComponent("formula-ocr-runner.py") }

    func loadOCRUI() {
        js("""
        if (!document.getElementById('formula-ocr-script')) {
          const script=document.createElement('script');
          script.id='formula-ocr-script';script.src='ocr.js';document.head.append(script);
        }
        """)
    }

    private func validOCREngine(_ raw: Any?) -> String {
        let engine=(raw as? String) ?? "pix2text"
        return engine == "unimernet" ? "unimernet" : "pix2text"
    }

    private func ocrReadyURL(_ engine:String) -> URL { engine == "unimernet" ? ocrUniReady : ocrPixReady }
    private func ocrInstalled(_ engine:String) -> Bool {
        let fm=FileManager.default
        let python=engine == "unimernet" ? ocrUniPython : ocrPython
        return fm.isExecutableFile(atPath:python.path) && compatibleOCRPython(python.path) && fm.fileExists(atPath:ocrReadyURL(engine).path)
    }

    // A multi-gigabyte dependency tree must never be scanned on the UI thread.
    func handleOCRStatus(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        if !ocrSizeCalculating && Date().timeIntervalSince(ocrSizeUpdated)>60 {
            ocrSizeCalculating=true
            let root=ocrRoot
            DispatchQueue.global(qos:.utility).async {
                var size:Int64=0
                if let files=FileManager.default.enumerator(at:root,includingPropertiesForKeys:[.fileSizeKey],options:[.skipsHiddenFiles]) {
                    for case let url as URL in files {
                        if let n=try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize { size+=Int64(n) }
                    }
                }
                let bytes=size
                DispatchQueue.main.async { self.ocrCachedBytes=bytes;self.ocrSizeUpdated=Date();self.ocrSizeCalculating=false }
            }
        }
        DispatchQueue.global(qos:.utility).async {
            let fm=FileManager.default
            let python=self.discoverPython3()
            let pixReady=self.ocrInstalled("pix2text")
            let uniReady=self.ocrInstalled("unimernet")
            let environmentExists=fm.isExecutableFile(atPath:self.ocrPython.path)
            let detectorReady=fm.fileExists(atPath:self.ocrMFDReady.path)
            DispatchQueue.main.async {
                self.reply(id,[
                    "documentInstalled":fm.isExecutableFile(atPath:self.ocrRoot.appendingPathComponent("venv-document/bin/python3").path) && fm.fileExists(atPath:self.ocrRoot.appendingPathComponent("ready-document-v2.txt").path),
                    "installed":pixReady,"busy":self.ocrBusy || self.ocrInstallBusy,
                    "installing":self.ocrInstallBusy,
                    "installingEngine":self.ocrBasicInstalling ? "pix2text" : self.ocrInstallingEngine,
                    "environmentExists":environmentExists,"pythonAvailable":python != nil,"pythonPath":python ?? "",
                    "bytes":self.ocrCachedBytes,"bytesCalculating":self.ocrSizeCalculating,
                    "root":self.ocrRoot.path,"detectorInstalled":detectorReady,
                    "engines":[
                        "pix2text":["installed":pixReady,"label":"Pix2Text","description":"基础识别：MFD + Pix2Text"],
                        "unimernet":["installed":uniReady,"label":"UniMERNet Tiny","description":"专业识别：基础版 + UniMERNet Tiny"]
                    ]
                ])
            }
        }
    }

    func handleOCRInstall(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let engine=validOCREngine(data["engine"])
        guard !ocrBusy && !ocrInstallBusy else { reply(id,["error":"已有 OCR 任务正在运行。"]);return }
        ocrInstallBusy=true
        ocrInstallingEngine=engine
        ocrBasicInstalling=true
        ocrInstallCancelled=false
        DispatchQueue.global(qos:.utility).async {
            let result=self.installOCR(engine)
            DispatchQueue.main.async { self.ocrInstallBusy=false;self.ocrInstallingEngine="";self.ocrBasicInstalling=false;self.ocrInstallProcess=nil;self.ocrSizeUpdated=Date.distantPast;self.reply(id,result) }
        }
    }

    func handleOCRCancelInstall(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        guard ocrInstallBusy else { reply(id,["cancelled":false,"message":"当前没有安装任务。"]);return }
        ocrInstallCancelled=true
        // The worker owns the process lifecycle and observes this flag.
        reply(id,["cancelled":true,"message":"已请求取消安装，正在结束当前步骤。"])
    }

    func handleOCRRecognize(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let engine=validOCREngine(data["engine"])
        let page=(data["mode"] as? String) == "page"
        guard !ocrBusy else { reply(id,["error":"已有识别任务正在运行。"]);return }
        // A previously installed Basic engine remains usable while Pro downloads.
        guard !(ocrInstallBusy && (engine != "pix2text" || ocrBasicInstalling)) else { reply(id,["error":"专业版安装期间暂不能使用专业识别。"]);return }
        guard ocrInstalled(engine) else {
            reply(id,["error":"所选识别模型尚未安装。请先安装 \(engine == "unimernet" ? "增强识别（UniMERNet Tiny）" : "标准识别（Pix2Text）")。"]);return
        }
        guard !page || FileManager.default.fileExists(atPath:ocrMFDReady.path) else {
            reply(id,["error":"整页公式检测模型尚未安装。请对当前识别能力执行一次“安装/验证”。"]);return
        }
        if let encoded=data["imageBase64"] as? String {
            guard encoded.count <= 140_000_000,let bytes=Data(base64Encoded:encoded),!bytes.isEmpty else {reply(id,["error":"剪贴板图片无效或过大。"]);return}
            let temporary=FileManager.default.temporaryDirectory.appendingPathComponent("formula-paste-"+UUID().uuidString+".png")
            do {try bytes.write(to:temporary,options:.atomic)} catch {reply(id,["error":error.localizedDescription]);return}
            ocrBusy=true
            ocrWorker.async {
                let result=self.recognizeFormula(temporary,engine:engine,page:page)
                try? FileManager.default.removeItem(at:temporary)
                DispatchQueue.main.async {self.ocrBusy=false;self.reply(id,result)}
            }
            return
        }
        ocrBusy=true
        let panel=NSOpenPanel();panel.title=page ? "选择包含公式的整页图片" : "选择公式图片";panel.canChooseDirectories=false;panel.canChooseFiles=true;panel.allowsMultipleSelection=false
        panel.allowedContentTypes=[.image]
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else { self.ocrBusy=false;self.reply(id,["cancelled":true]);return }
            self.js("window.FormulaOCRInput?.(\(self.json(id)),\(self.json(["kind":"image","name":url.lastPathComponent])));")
            self.ocrWorker.async {
                let thumbnail=self.ocrInputThumbnail(url)
                DispatchQueue.main.async {self.js("window.FormulaOCRInput?.(\(self.json(id)),\(self.json(["kind":"image","name":url.lastPathComponent,"thumbnail":thumbnail])));")}
            }
            let engineLabel=engine == "unimernet" ? "UniMERNet Tiny" : "Pix2Text"
            let phase=page ? "正在检测整页公式区域并用 \(engineLabel) 识别" : "正在用 \(engineLabel) 识别"
            self.js("window.FormulaOCRProgress?.(\(self.json(id)),\(self.json(["message":phase+"："+url.lastPathComponent])));")
            self.ocrWorker.async {
                let result=self.recognizeFormula(url,engine:engine,page:page)
                DispatchQueue.main.async { self.ocrBusy=false;self.reply(id,result) }
            }
        }
    }

    func ocrInputThumbnail(_ url:URL) -> String {
        guard let source=CGImageSourceCreateWithURL(url as CFURL,nil),let image=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:128,kCGImageSourceCreateThumbnailWithTransform:true] as CFDictionary) else{return ""}
        let bitmap=NSBitmapImageRep(cgImage:image)
        guard let bytes=bitmap.representation(using:.png,properties:[:]) else{return ""}
        return "data:image/png;base64,"+bytes.base64EncodedString()
    }

    private func discoverPython3() -> String? {
        let fm=FileManager.default
        let candidates=["/opt/homebrew/bin/python3.11","/usr/local/bin/python3.11","/opt/homebrew/bin/python3.10","/usr/local/bin/python3.10","/opt/homebrew/bin/python3.12","/usr/local/bin/python3.12","/opt/homebrew/bin/python3","/usr/local/bin/python3","/usr/bin/python3",NSHomeDirectory()+"/.local/bin/python3"]
        for path in candidates where fm.isExecutableFile(atPath:path) {
            if compatibleOCRPython(path) { return path }
        }
        let dir=FileManager.default.temporaryDirectory
        if let result=try? run("/bin/zsh",["-lc","command -v python3"],cwd:dir,timeout:8),result.0==0 {
            let path=result.1.trimmingCharacters(in:.whitespacesAndNewlines)
            if fm.isExecutableFile(atPath:path) && compatibleOCRPython(path) { return path }
        }
        return nil
    }

    // Never select an interpreter solely because its executable exists.
    private func compatibleOCRPython(_ path:String) -> Bool {
        guard let result=try? run(path,["-c","import sys; print(int((3, 10) <= sys.version_info[:2] <= (3, 12)))"],cwd:FileManager.default.temporaryDirectory,timeout:8) else { return false }
        return result.0 == 0 && result.1.trimmingCharacters(in:.whitespacesAndNewlines) == "1"
    }

    // Build replacements separately: active environments are never modified by pip.
    private func prepareOCREnvironment(_ stage:URL,requirements:URL,log:inout String) throws -> URL {
        guard let python=discoverPython3() else { throw ToolFailure(message:"未找到兼容的 Python。请安装 Python 3.10–3.12（建议 3.11）；较新版本尚不受当前模型依赖支持。") }
        try FileManager.default.createDirectory(at:ocrRoot,withIntermediateDirectories:true)
        var r=try run(python,["-m","venv",stage.path],cwd:ocrRoot,timeout:120,ocrInstall:true);log+=r.1
        let target=stage.appendingPathComponent("bin/python3")
        guard r.0 == 0 && compatibleOCRPython(target.path) else { throw ToolFailure(message:"创建 OCR 虚拟环境失败。") }
        r=try run(target.path,["-m","pip","install","--upgrade","pip","setuptools","wheel"],cwd:ocrRoot,timeout:300,ocrInstall:true);log+=r.1
        guard r.0 == 0 else { throw ToolFailure(message:"更新 OCR 安装工具失败。") }
        r=try run(target.path,["-m","pip","install","--progress-bar","on","-r",requirements.path],cwd:ocrRoot,timeout:1800,ocrInstall:true);log+=r.1
        guard r.0 == 0 else { throw ToolFailure(message:"安装 OCR 依赖失败，请查看日志。") }
        r=try run(target.path,["-m","pip","check"],cwd:ocrRoot,timeout:60,ocrInstall:true);log+=r.1
        guard r.0 == 0 else { throw ToolFailure(message:"OCR 依赖检查失败。") }
        return target
    }

    private func activateOCREnvironment(_ stage:URL,_ target:URL,markers:[URL]) throws {
        if DispatchQueue.main.sync(execute:{self.ocrInstallCancelled}) { throw ToolFailure(message:"用户已取消 OCR 安装。") }
        let fm=FileManager.default
        let backup=ocrRoot.appendingPathComponent("backup-"+UUID().uuidString)
        let existed=fm.fileExists(atPath:target.path) || (try? fm.destinationOfSymbolicLink(atPath:target.path)) != nil
        let oldEnvironment=target.resolvingSymlinksInPath()
        let oldMarkers=markers.map { try? Data(contentsOf:$0) }
        if existed { try fm.moveItem(at:target,to:backup) }
        do {
            // Keep the venv at its original path so pip entry-point shebangs stay valid.
            try fm.createSymbolicLink(at:target,withDestinationURL:stage)
            for marker in markers { try "ready".write(to:marker,atomically:true,encoding:.utf8) }
            if existed {
                try? fm.removeItem(at:backup)
                if ocrPath(oldEnvironment) != ocrPath(target) && ocrPath(oldEnvironment.deletingLastPathComponent()) == ocrPath(ocrRoot) && oldEnvironment.lastPathComponent.hasPrefix("environment-") { try? fm.removeItem(at:oldEnvironment) }
            }
        } catch {
            try? fm.removeItem(at:target)
            if existed { try? fm.moveItem(at:backup,to:target) }
            for (marker,old) in zip(markers,oldMarkers) {
                if let bytes=old { try? bytes.write(to:marker,options:.atomic) } else { try? fm.removeItem(at:marker) }
            }
            throw error
        }
    }

    // Foundation URL equality includes the directory hint; compare canonical paths.
    private func ocrPath(_ url:URL) -> String {
        url.standardizedFileURL.resolvingSymlinksInPath().path.trimmingCharacters(in:CharacterSet(charactersIn:"/"))
    }

    private func reportOCRPhase(_ message:String) {
        DispatchQueue.main.async {
            self.js("window.FormulaOCRInstallPhase?.(\(self.json(message)));")
        }
    }

    private func installOCR(_ engine:String) -> [String:Any] {
        var log=""
        let fm=FileManager.default
        let stage=ocrRoot.appendingPathComponent("environment-"+UUID().uuidString)
        var baseCommitted=false
        defer {
            if !baseCommitted { try? fm.removeItem(at:stage) }
            if DispatchQueue.main.sync(execute:{self.ocrInstallCancelled}) {
                let models=ocrRoot.appendingPathComponent("models")
                if let files=fm.enumerator(at:models,includingPropertiesForKeys:nil) {
                    for case let file as URL in files where file.pathExtension == "incomplete" { try? fm.removeItem(at:file) }
                }
            }
        }
        do {
            // A Pro upgrade reuses a verified baseline without touching its packages.
            let needsBase=engine == "pix2text" || !ocrInstalled("pix2text") || !fm.fileExists(atPath:ocrMFDReady.path)
            DispatchQueue.main.sync { self.ocrBasicInstalling=needsBase }
            if needsBase {
                reportOCRPhase("正在准备基础识别独立环境…")
                let python=try prepareOCREnvironment(stage,requirements:bundledOCRRequirements,log:&log)
                reportOCRPhase("正在下载并验证 Pix2Text 与 MFD 模型…")
                let r=try run(python.path,[bundledOCRRunner.path,"--warmup-detector","--warmup","--engine","pix2text","--root",ocrRoot.path],cwd:ocrRoot,timeout:2400,ocrInstall:true);log+=r.1
                guard r.0 == 0 && r.1.contains("FORMULA_MFD_READY=1") && r.1.contains("FORMULA_OCR_READY=pix2text") else { throw ocrFailure("基础识别模型初始化失败。",r.1) }
                try activateOCREnvironment(stage,ocrVenv,markers:[ocrPixReady,ocrMFDReady])
                baseCommitted=true
                DispatchQueue.main.sync { self.ocrBasicInstalling=false }
                reportOCRPhase("基础识别已就绪，可立即使用；继续准备专业识别…")
            }
            if engine == "unimernet" {
                let proStage=ocrRoot.appendingPathComponent("environment-"+UUID().uuidString)
                var proCommitted=false
                defer { if !proCommitted { try? fm.removeItem(at:proStage) } }
                let requirements=Bundle.main.resourceURL!.appendingPathComponent("unimernet-requirements.txt")
                reportOCRPhase("正在准备 UniMERNet 独立环境，基础识别可继续使用…")
                let python=try prepareOCREnvironment(proStage,requirements:requirements,log:&log)
                reportOCRPhase("正在下载并验证 UniMERNet Tiny 模型…")
                let r=try run(python.path,[bundledOCRRunner.path,"--warmup","--engine","unimernet","--root",ocrRoot.path],cwd:ocrRoot,timeout:2400,ocrInstall:true);log+=r.1
                guard r.0 == 0 && r.1.contains("FORMULA_OCR_READY=unimernet") else { throw ocrFailure("专业识别模型初始化失败。",r.1) }
                try activateOCREnvironment(proStage,ocrUniVenv,markers:[ocrUniReady])
                proCommitted=true
            }
            return ["installed":true,"engine":engine,"message":engine == "unimernet" ? "增强识别已安装：标准识别与 UniMERNet Tiny 均已就绪。" : "基础识别已安装：Pix2Text 与 MFD 均已就绪。","log":String(log.suffix(20000))]
        } catch let e as ToolFailure { return ["error":e.message,"cancelled":DispatchQueue.main.sync { self.ocrInstallCancelled },"log":String((log+"\n"+e.message).suffix(20000))] }
        catch { return ["error":error.localizedDescription,"log":String((log+"\n"+error.localizedDescription).suffix(20000))] }
    }

    func ocrImageData(_ image:URL) throws -> Data {
        guard let source=NSImage(contentsOf:image),let cg=source.cgImage(forProposedRect:nil,context:nil,hints:nil) else {
            throw ToolFailure(message:"无法读取所选图片。请确认文件未损坏，或导出为 JPEG/PNG 后重试。")
        }
        guard cg.width > 0,cg.height > 0,cg.width <= 18000,cg.height <= 18000,cg.width*cg.height <= 80000000 else {
            throw ToolFailure(message:"图片尺寸过大。请将整页照片缩小到 8000 万像素以内后重试。")
        }
        guard let bytes=NSBitmapImageRep(cgImage:cg).representation(using:.png,properties:[:]) else {
            throw ToolFailure(message:"无法转换公式图片。")
        }
        return bytes
    }

    private func ocrFailure(_ message:String,_ log:String) -> ToolFailure {
        let detail=log.components(separatedBy:.newlines).last(where:{$0.hasPrefix("FORMULA_OCR_ERROR=")})
        return ToolFailure(message:message+(detail.map { "\n"+String($0.dropFirst("FORMULA_OCR_ERROR=".count)) } ?? ""))
    }

    private func decodeOCRPayload(_ line:String,_ prefix:String) throws -> String {
        let payload=String(line.dropFirst(prefix.count))
        guard let data=Data(base64Encoded:payload),let text=String(data:data,encoding:.utf8) else { throw ToolFailure(message:"识别器返回了无法解码的数据。") }
        return text
    }

    private func recognizeFormula(_ image:URL,engine:String,page:Bool,documentTask:Bool=false) -> [String:Any] {
        var log=""
        do {
            let normalized=ocrRoot.appendingPathComponent("image-"+UUID().uuidString+".png")
            let pageOutput=ocrRoot.appendingPathComponent("page-"+UUID().uuidString+".json")
            defer { try? FileManager.default.removeItem(at:normalized);try? FileManager.default.removeItem(at:pageOutput) }
            try ocrImageData(image).write(to:normalized,options:.atomic)
            var args=[bundledOCRRunner.path,"--engine",engine,"--root",ocrRoot.path]
            if page { args += ["--page","--page-output",pageOutput.path] }
            args.append(normalized.path)
            if page && engine == "unimernet" { args += ["--basic-python",ocrPython.path] }
            let python=engine == "unimernet" ? ocrUniPython : ocrPython
            let r=try run(python.path,args,cwd:ocrRoot,timeout:page || engine == "unimernet" ? 600 : 240,documentTask:documentTask);log=r.1
            if r.0 != 0 { throw ocrFailure("公式识别失败。",r.1) }
            let label=engine == "unimernet" ? "UniMERNet Tiny" : "Pix2Text 1.1.7"
            if page {
                let data=try Data(contentsOf:pageOutput)
                guard data.count <= 8000000,let formulas=try JSONSerialization.jsonObject(with:data) as? [[String:Any]] else { throw ToolFailure(message:"整页公式结果格式无效或过大。") }
                return ["formulas":formulas,"engine":label,"detector":"Pix2Text MFD 1.5","log":String(log.suffix(20000))]
            }
            let prefix="FORMULA_OCR_RESULT="
            guard let line=log.components(separatedBy:.newlines).last(where:{$0.hasPrefix(prefix)}) else { throw ToolFailure(message:"识别器没有返回 LaTeX 结果。") }
            let latex=try decodeOCRPayload(line,prefix).trimmingCharacters(in:.whitespacesAndNewlines)
            if latex.isEmpty { throw ToolFailure(message:"识别结果为空。") }
            return ["latex":latex,"engine":label,"log":String(log.suffix(20000))]
        } catch let e as ToolFailure { return ["error":e.message,"log":String((log+"\n"+e.message).suffix(20000))] }
        catch { return ["error":error.localizedDescription,"log":String((log+"\n"+error.localizedDescription).suffix(20000))] }
    }
}
