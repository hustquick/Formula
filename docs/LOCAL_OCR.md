# Formula 本地图片公式识别

## 目标

Formula 主应用保持轻量，不把 Pix2Text、Python 虚拟环境和模型权重打进 DMG。用户第一次使用“图片识别”时，由应用按需创建独立环境并下载识别组件；安装完成后可离线识别。

## 当前第一阶段

- 支持 macOS。
- 面向单个、已裁剪的公式图片。
- 本地后端：Pix2Text 1.1.7 系列，CPU 模式。
- 输入：PNG/JPEG/WebP/TIFF/BMP/HEIC。
- 输出：LaTeX，并自动回填现有 Formula 编辑器。
- Typst 继续复用 Formula 现有 LaTeX → Typst 转换链路。
- OCR 环境位于用户 Application Support 下，不计入 Formula.app/DMG 体积。

## 安装流程

1. 用户打开“图片识别”。
2. Formula 检查本地 OCR 环境。
3. 未安装时，用户点击“安装本地识别模型”。
4. Formula 创建独立 Python venv。
5. 在 venv 中安装 `pix2text>=1.1.7,<1.2`。
6. 初始化 Pix2Text 的 LatexOCR 单公式识别器（不加载文档布局、表格和文本检测模型）；模型按 Pix2Text 的下载机制获取并缓存。只有启动脚本返回 FORMULA_OCR_READY=1 后才写入就绪标记。
7. 以后识别不需要重新安装。

## 后续阶段

- 多公式检测：增加 MFD，识别一张截图中的多个公式区域。
- 识别结果候选与置信度显示。
- 粘贴剪贴板图片、拖拽图片、屏幕区域截图。
- OCR 环境删除/更新/模型版本管理。
- Windows 本地 OCR 后端。
- 若后续采用原生 ONNX/CoreML 推理，可在不改变前端交互的前提下替换当前 Python/Pix2Text 后端。

## 就绪与错误处理

venv 存在不代表 Pix2Text 或模型安装完成。未通过模型初始化的环境显示“继续安装”，不能开始识别。安装和识别使用单独队列并拒绝重复请求；选择文件后显示识别阶段。Python 错误和超时保留日志并自动展开日志区域。模型损坏时可以验证/修复。原生 OCR 桥接直接写入 Swift 源文件，构建不再依赖文本替换注入。

已复现 RapidOCR 3.10.0 移除 resolve_model_key 导致 CnSTD 1.2.8 导入失败；安装使用 cnstd==1.2.8、cnocr==2.3.3、rapidocr==3.9.2 兼容组合。初始化错误直接显示 Python 错误类型及消息，不能笼统归因网络。
