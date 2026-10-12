# 本地文档识别

在“文档识别”中安装组件，选择 PDF、Word (.docx) 或整页图片。已有的单公式模型会复用；文档模式额外加载中英文文字识别和公式检测模型。文档独立记录就绪状态，单公式安装完成不代表文档组件已就绪。

PDF 可指定起止页；末页留空时处理起始页之后最多 20 页，若还有页数会显示提示，可修改页码分批继续。加密 PDF 应先解除密码保护。Word 使用本地 Pandoc 读取正文、表格和 OMML 公式，嵌入图片使用 Pix2Text 识别；Word 不按页码切分。外部链接或无法读取的图片会在结果中注明，正文和原生公式仍可提取。

结果提供 Markdown 全文预览、复制、导出和公式列表，公式标注页码或 Word 来源。可逐个导入，也可勾选多个合并送入 Formula。识别结果需核对；多栏、复杂排版或低清晰度图片可能影响阅读顺序与识别准确性。此功能提取内容，输出采用 Markdown。

识别在本机进行，首次安装模型需要联网。缓存就绪后可离线使用。PDF/图片识别由 Pix2Text TextFormulaOCR 完成；Word 原生公式由 Pandoc 转为 LaTeX。Python 环境位于 Application Support/MathForge/OCR，模型使用 Pix2Text/CnOCR/CnSTD 用户缓存。

原生桥接 actions: ocrStatus、ocrInstall(document=true)、ocrDocument(first,last)。文档结果写入临时 JSON 文件，避免进程日志截断大型结果；返回前解析并校验，结束后清理临时文件。一次原生识别最多 600 秒，前端保留操作日志与逐页进度。
