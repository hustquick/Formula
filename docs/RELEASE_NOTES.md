Formula 1.2.1 修复 macOS 本地图片公式识别。

- 修复 Pix2Text/CnSTD 与 RapidOCR 的依赖不兼容（resolve_model_key 导入错误）。
- 只有模型初始化成功才显示识别就绪；支持继续安装及验证/修复。
- 图片选择后显示识别进度；错误与超时显示 Python 详情并保留诊断日志。
- 单公式识别不加载无关的布局/表格模型；支持断点下载后修复模型缓存。
- macOS 原生解码 JPEG/PNG/HEIC 后统一传递 PNG，避免识别时安装格式插件。
- 本地构建与 CI 使用同一套原生桥接和通用 DMG 打包流程。

通用应用支持 Apple Silicon 和 Intel。此构建使用临时签名，尚未 Apple 公证。
