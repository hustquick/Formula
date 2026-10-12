import Cocoa
import WebKit

extension AppDelegate {
    private var ocrRoot: URL { support.appendingPathComponent("OCR", isDirectory: true) }
    private var ocrVenv: URL { ocrRoot.appendingPathComponent("venv", isDirectory: true) }
    private var ocrLegacyReady: URL { ocrRoot.appendingPathComponent("ready-v1.txt") }
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
        if engine == "pix2text" && fm.fileExists(atPath:ocrLegacyReady.path) { return fm.isExecutableFile(atPath:ocrPython.path) }
        return fm.isExecutableFile(atPath:ocrPython.path) && fm.fileExists(atPath:ocrReadyURL(engine).path)
    }

    func handleOCRStatus(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let fm=FileManager.default
        let python=discoverPython3()
        var size:Int64=0
        if let e=fm.enumerator(at:ocrRoot, includingPropertiesForKeys:[.fileSizeKey], options:[.skipsHiddenFiles]) {
            for case let url as URL in e { if let n=try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize { size += Int64(n) } }
        }
        reply(id,[
            "installed":ocrInstalled("pix2text"),
            "busy":ocrBusy,
            "environmentExists":fm.isExecutableFile(atPath:ocrPython.path),
            "pythonAvailable":python != nil,
            "pythonPath":python ?? "",
            "bytes":size,
            "root":ocrRoot.path,
            "detectorInstalled":fm.fileExists(atPath:ocrMFDReady.path),
            "engines":[
                "pix2text":["installed":ocrInstalled("pix2text"),"label":"Pix2Text","description":"标准识别：MFD + Pix2Text，适合普通印刷公式"],
                "unimernet":["installed":ocrInstalled("unimernet"),"label":"UniMERNet Tiny","description":"增强识别：包含标准识别基础组件，并增加 UniMERNet Tiny"]
            ]
        ])
    }

    func handleOCRInstall(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let engine=validOCREngine(data["engine"])
        guard !ocrBusy else { reply(id,["error":"识别组件正在安装或识别，请稍后重试。"]);return }
        ocrBusy=true
        ocrWorker.async {
            let result=self.installOCR(engine)
            DispatchQueue.main.async { self.ocrBusy=false;self.reply(id,result) }
        }
    }

    func handleOCRRecognize(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let engine=validOCREngine(data["engine"])
        let page=(data["mode"] as? String) == "page"
        guard !ocrBusy else { reply(id,["error":"识别组件正在安装或识别，请稍后重试。"]);return }
        guard ocrInstalled(engine) else {
            reply(id,["error":"所选识别模型尚未安装。请先安装 \(engine == "unimernet" ? "增强识别（UniMERNet Tiny）" : "标准识别（Pix2Text）")。"]);return
        }
        guard !page || FileManager.default.fileExists(atPath:ocrMFDReady.path) else {
            reply(id,["error":"整页公式检测模型尚未安装。请对当前识别能力执行一次“安装/验证”。"]);return
        }
        ocrBusy=true
        let panel=NSOpenPanel();panel.title=page ? "选择包含公式的整页图片" : "选择公式图片";panel.canChooseDirectories=false;panel.allowsMultipleSelection=false
        panel.allowedFileTypes=["png","jpg","jpeg","webp","tif","tiff","bmp","heic"]
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else { self.ocrBusy=false;self.reply(id,["cancelled":true]);return }
            let engineLabel=engine == "unimernet" ? "UniMERNet Tiny" : "Pix2Text"
            let phase=page ? "正在检测整页公式区域并用 \(engineLabel) 识别" : "正在用 \(engineLabel) 识别"
            self.js("window.FormulaOCRProgress?.(\(self.json(id)),\(self.json(["message":phase+"："+url.lastPathComponent])));")
            self.ocrWorker.async {
                let result=self.recognizeFormula(url,engine:engine,page:page)
                DispatchQueue.main.async { self.ocrBusy=false;self.reply(id,result) }
            }
        }
    }

    private func discoverPython3() -> String? {
        let fm=FileManager.default
        let candidates=["/opt/homebrew/bin/python3","/usr/local/bin/python3","/usr/bin/python3",NSHomeDirectory()+"/.local/bin/python3"]
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
        guard let result=try? run(path,["-c","import sys; print(int(sys.version_info >= (3, 10)))"],cwd:FileManager.default.temporaryDirectory,timeout:8) else { return false }
        return result.0 == 0 && result.1.trimmingCharacters(in:.whitespacesAndNewlines) == "1"
    }

    private func ensureBaseOCR(_ log: inout String) throws {
        let fm=FileManager.default
        guard let systemPython=discoverPython3() else { throw ToolFailure(message:"未找到 Python 3。请先安装 Python 3（建议 Python 3.10+），再安装本地公式识别模型。") }
        try fm.createDirectory(at:ocrRoot,withIntermediateDirectories:true)
        if fm.isExecutableFile(atPath:ocrPython.path) && !compatibleOCRPython(ocrPython.path) {
            throw ToolFailure(message:"现有 Formula OCR 虚拟环境的 Python 版本低于 3.10。请先备份或通过后续迁移功能重建 OCR 环境；不会自动删除已有模型。")
        }
        if !fm.isExecutableFile(atPath:ocrPython.path) {
            let r=try run(systemPython,["-m","venv",ocrVenv.path],cwd:ocrRoot,timeout:120);log+=r.1
            if r.0 != 0 { throw ToolFailure(message:"创建公式识别独立环境失败。") }
        }
        var r=try run(ocrPython.path,["-m","pip","install","--upgrade","pip","setuptools","wheel"],cwd:ocrRoot,timeout:300);log+=r.1
        if r.0 != 0 { throw ToolFailure(message:"更新 OCR 安装工具失败。") }
        r=try run(ocrPython.path,["-m","pip","install","-r",bundledOCRRequirements.path],cwd:ocrRoot,timeout:1200);log+=r.1
        if r.0 != 0 { throw ToolFailure(message:"安装 Pix2Text/MFD 基础组件失败，请检查网络后重试。") }
        guard fm.fileExists(atPath:bundledOCRRunner.path) else { throw ToolFailure(message:"Formula 安装包缺少公式识别启动脚本。") }
    }

    private func installOCR(_ engine:String) -> [String:Any] {
        var log=""
        do {
            let fm=FileManager.default
            try? fm.removeItem(at:ocrReadyURL(engine))
            try ensureBaseOCR(&log)

            if engine == "unimernet" {
                var r=try run(ocrPython.path,["-m","pip","install","unimernet==0.2.3","huggingface_hub>=0.23,<1"],cwd:ocrRoot,timeout:1800);log+=r.1
                if r.0 != 0 { throw ToolFailure(message:"安装 UniMERNet 依赖失败。UniMERNet 需要 Python 3.10+。") }
            }

            var r=try run(ocrPython.path,[bundledOCRRunner.path,"--warmup-detector","--root",ocrRoot.path],cwd:ocrRoot,timeout:1200);log+=r.1
            if r.0 != 0 || !r.1.contains("FORMULA_MFD_READY=1") { throw ocrFailure("数学公式区域检测（MFD）模型初始化失败。",r.1) }
            try "ready".write(to:ocrMFDReady,atomically:true,encoding:.utf8)

            // 标准识别是所有 OCR 能力的基础。即使用户直接安装增强识别，也必须先完成 Pix2Text MFR 初始化。
            r=try run(ocrPython.path,[bundledOCRRunner.path,"--warmup","--engine","pix2text","--root",ocrRoot.path],cwd:ocrRoot,timeout:1200);log+=r.1
            if r.0 != 0 || !r.1.contains("FORMULA_OCR_READY=pix2text") { throw ocrFailure("标准识别（Pix2Text）模型初始化失败。",r.1) }
            try "ready".write(to:ocrPixReady,atomically:true,encoding:.utf8)
            try? "ready".write(to:ocrLegacyReady,atomically:true,encoding:.utf8)

            if engine == "unimernet" {
                r=try run(ocrPython.path,[bundledOCRRunner.path,"--warmup","--engine","unimernet","--root",ocrRoot.path],cwd:ocrRoot,timeout:2400);log+=r.1
                if r.0 != 0 || !r.1.contains("FORMULA_OCR_READY=unimernet") { throw ocrFailure("增强识别（UniMERNet Tiny）已安装，但模型初始化失败。",r.1) }
                try "ready".write(to:ocrUniReady,atomically:true,encoding:.utf8)
                return ["installed":true,"engine":engine,"message":"增强识别已安装：标准识别（MFD + Pix2Text）与 UniMERNet Tiny 均已就绪，可离线使用。","log":String(log.suffix(20000))]
            }

            return ["installed":true,"engine":engine,"message":"标准识别已安装：MFD 公式区域检测与 Pix2Text 均已就绪，可离线使用。","log":String(log.suffix(20000))]
        } catch let e as ToolFailure { return ["error":e.message,"log":String((log+"\n"+e.message).suffix(20000))] }
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

    private func recognizeFormula(_ image:URL,engine:String,page:Bool) -> [String:Any] {
        var log=""
        do {
            let normalized=ocrRoot.appendingPathComponent("image-"+UUID().uuidString+".png")
            defer { try? FileManager.default.removeItem(at:normalized) }
            try ocrImageData(image).write(to:normalized,options:.atomic)
            var args=[bundledOCRRunner.path,"--engine",engine,"--root",ocrRoot.path]
            if page { args.append("--page") }
            args.append(normalized.path)
            let r=try run(ocrPython.path,args,cwd:ocrRoot,timeout:page || engine == "unimernet" ? 600 : 240);log=r.1
            if r.0 != 0 { throw ocrFailure("公式识别失败。",r.1) }
            let label=engine == "unimernet" ? "UniMERNet Tiny" : "Pix2Text 1.1.7"
            if page {
                let prefix="FORMULA_OCR_PAGE="
                guard let line=log.components(separatedBy:.newlines).last(where:{$0.hasPrefix(prefix)}) else { throw ToolFailure(message:"整页检测器没有返回公式结果。") }
                let text=try decodeOCRPayload(line,prefix)
                guard let data=text.data(using:.utf8),let formulas=try JSONSerialization.jsonObject(with:data) as? [[String:Any]] else { throw ToolFailure(message:"整页公式结果格式无效。") }
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
