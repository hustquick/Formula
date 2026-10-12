import Cocoa
import WebKit

extension AppDelegate {
    private var ocrRoot: URL { support.appendingPathComponent("OCR", isDirectory: true) }
    private var ocrVenv: URL { ocrRoot.appendingPathComponent("venv", isDirectory: true) }
    private var ocrPython: URL { ocrVenv.appendingPathComponent("bin/python3") }
    private var bundledOCRRunner: URL { Bundle.main.resourceURL!.appendingPathComponent("formula-ocr-runner.py") }

    func loadOCRUI() {
        js("""
        if (!document.getElementById('formula-ocr-script')) {
          const script=document.createElement('script');
          script.id='formula-ocr-script';script.src='ocr.js';document.head.append(script);
        }
        """)
    }

    func handleOCRStatus(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        let fm=FileManager.default
        let installed=fm.isExecutableFile(atPath:ocrPython.path)
        let python=discoverPython3()
        var size:Int64=0
        if let e=fm.enumerator(at:ocrRoot, includingPropertiesForKeys:[.fileSizeKey], options:[.skipsHiddenFiles]) {
            for case let url as URL in e { if let n=try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize { size += Int64(n) } }
        }
        reply(id,["installed":installed,"pythonAvailable":python != nil,"pythonPath":python ?? "","bytes":size,"root":ocrRoot.path])
    }

    func handleOCRInstall(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        worker.async {
            let result=self.installOCR()
            DispatchQueue.main.async { self.reply(id,result) }
        }
    }

    func handleOCRRecognize(_ data:[String:Any]) {
        let id=data["id"] as? String ?? ""
        guard FileManager.default.isExecutableFile(atPath:ocrPython.path) else {
            reply(id,["error":"本地公式识别模型尚未安装。请先点击“安装本地识别模型”。"]);return
        }
        let panel=NSOpenPanel();panel.title="选择包含公式的图片";panel.canChooseDirectories=false;panel.allowsMultipleSelection=false
        panel.allowedFileTypes=["png","jpg","jpeg","webp","tif","tiff","bmp","heic"]
        panel.beginSheetModal(for:window){response in
            guard response == .OK,let url=panel.url else { self.reply(id,["cancelled":true]);return }
            self.worker.async {
                let result=self.recognizeFormula(url)
                DispatchQueue.main.async { self.reply(id,result) }
            }
        }
    }

    private func discoverPython3() -> String? {
        let fm=FileManager.default
        let candidates=["/opt/homebrew/bin/python3","/usr/local/bin/python3","/usr/bin/python3",NSHomeDirectory()+"/.local/bin/python3"]
        for path in candidates where fm.isExecutableFile(atPath:path) { return path }
        let dir=FileManager.default.temporaryDirectory
        if let result=try? run("/bin/zsh",["-lc","command -v python3"],cwd:dir,timeout:8),result.0==0 {
            let path=result.1.trimmingCharacters(in:.whitespacesAndNewlines)
            if fm.isExecutableFile(atPath:path) { return path }
        }
        return nil
    }

    private func installOCR() -> [String:Any] {
        var log=""
        do {
            guard let systemPython=discoverPython3() else { throw ToolFailure(message:"未找到 Python 3。请先安装 Python 3（例如 Homebrew Python），再安装本地公式识别模型。") }
            try FileManager.default.createDirectory(at:ocrRoot,withIntermediateDirectories:true)
            if !FileManager.default.isExecutableFile(atPath:ocrPython.path) {
                let r=try run(systemPython,["-m","venv",ocrVenv.path],cwd:ocrRoot,timeout:120);log+=r.1
                if r.0 != 0 { throw ToolFailure(message:"创建公式识别独立环境失败。") }
            }
            var r=try run(ocrPython.path,["-m","pip","install","--upgrade","pip","setuptools","wheel"],cwd:ocrRoot,timeout:300);log+=r.1
            if r.0 != 0 { throw ToolFailure(message:"更新 OCR 安装工具失败。") }
            r=try run(ocrPython.path,["-m","pip","install","pix2text>=1.1.7,<1.2"],cwd:ocrRoot,timeout:1200);log+=r.1
            if r.0 != 0 { throw ToolFailure(message:"安装 Pix2Text 失败，请检查网络后重试。") }
            guard FileManager.default.fileExists(atPath:bundledOCRRunner.path) else { throw ToolFailure(message:"Formula 安装包缺少公式识别启动脚本。") }
            r=try run(ocrPython.path,[bundledOCRRunner.path,"--warmup"],cwd:ocrRoot,timeout:1200);log+=r.1
            if r.0 != 0 { throw ToolFailure(message:"Pix2Text 已安装，但模型下载或初始化失败。请检查网络后重试。") }
            return ["installed":true,"message":"本地公式识别已安装，可以离线识别单公式图片。","log":String(log.suffix(20000))]
        } catch let e as ToolFailure { return ["error":e.message,"log":String(log.suffix(20000))] }
        catch { return ["error":error.localizedDescription,"log":String(log.suffix(20000))] }
    }

    private func recognizeFormula(_ image:URL) -> [String:Any] {
        var log=""
        do {
            let r=try run(ocrPython.path,[bundledOCRRunner.path,image.path],cwd:ocrRoot,timeout:180);log=r.1
            if r.0 != 0 { throw ToolFailure(message:"公式识别失败，请查看识别日志。") }
            guard let line=log.components(separatedBy:.newlines).last(where:{$0.hasPrefix("FORMULA_OCR_RESULT=")}) else { throw ToolFailure(message:"识别器没有返回 LaTeX 结果。") }
            let payload=String(line.dropFirst("FORMULA_OCR_RESULT=".count))
            guard let data=Data(base64Encoded:payload),let latex=String(data:data,encoding:.utf8),!latex.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else { throw ToolFailure(message:"识别结果为空。") }
            return ["latex":latex.trimmingCharacters(in:.whitespacesAndNewlines),"engine":"Pix2Text 1.1.x","log":String(log.suffix(20000))]
        } catch let e as ToolFailure { return ["error":e.message,"log":String(log.suffix(20000))] }
        catch { return ["error":error.localizedDescription,"log":String(log.suffix(20000))] }
    }
}
