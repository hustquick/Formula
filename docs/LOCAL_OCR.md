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
6. 初始化 Pix2Text；模型按 Pix2Text 的下载机制获取并缓存。
7. 以后识别不需要重新安装。

## 后续阶段

- 多公式检测：增加 MFD，识别一张截图中的多个公式区域。
- 识别结果候选与置信度显示。
- 粘贴剪贴板图片、拖拽图片、屏幕区域截图。
- OCR 环境删除/更新/模型版本管理。
- Windows 本地 OCR 后端。
- 若后续采用原生 ONNX/CoreML 推理，可在不改变前端交互的前提下替换当前 Python/Pix2Text 后端。
