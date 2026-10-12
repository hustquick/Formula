# Formula 本地图片公式识别

## 目标

Formula 主应用保持轻量，不把 Python 环境、识别依赖和模型权重打进 DMG。用户第一次使用“图片识别”时按需安装本地组件；安装完成后可离线识别。

## 当前架构

### 两种可选识别模型

- **Pix2Text**：轻量、启动较快，适合普通印刷公式和日常截图。
- **UniMERNet Tiny**：高精度选项，面向复杂公式、手写公式和噪声截图。模型权重约 441 MB，只有用户主动选择安装时才下载。

两个识别器共享同一个 Formula OCR Python 虚拟环境，但分别维护就绪标记。未安装 UniMERNet 时不会下载其 Python 依赖和模型权重。

### 两种图片模式

1. **单个公式**：图片直接交给所选识别模型，返回 LaTeX 并自动送入 Formula 编辑器。
2. **整页提取公式**：输入教材、论文或笔记的整页照片；先用 Pix2Text 自带的 **MFD 1.5（Math Formula Detection）** 只检测数学公式区域，不对普通正文做 OCR；再裁剪每个公式区域并送给用户选择的 Pix2Text 或 UniMERNet。结果按页面顺序列出，用户逐条点击“插入”。

整页流程为：

```text
整页图片
  ↓
MFD 1.5 检测公式区域
  ↓
按 bbox 裁剪公式
  ↓
Pix2Text 或 UniMERNet Tiny
  ↓
LaTeX 结果列表
  ↓
逐条插入 MathLive 编辑器
```

普通正文、页码和背景不会作为最终识别结果返回。

## 安装流程

1. 用户打开“图片识别”。
2. 选择 Pix2Text 或 UniMERNet Tiny。
3. Formula 检查本地 OCR 环境与所选模型就绪状态。
4. 未安装时，用户点击“安装当前模型”。
5. Formula 创建或复用独立 Python venv。
6. 安装 Pix2Text 基础依赖，并初始化 MFD 1.5 公式区域检测模型。
7. 如果选择 Pix2Text，初始化 MFR 1.5。
8. 如果选择 UniMERNet Tiny，再安装 `unimernet==0.2.3`，并从 `wanderkid/unimernet_tiny` 下载权重到 Application Support/OCR/models。
9. 对应启动脚本返回就绪标记后才写入 ready 文件。

所有 OCR 环境与模型文件均位于用户 Application Support 下，不计入 Formula.app/DMG 体积。

## 实现边界

- 当前本地后端首先支持 macOS。
- 输入支持 PNG/JPEG/WebP/TIFF/BMP/HEIC；macOS 原生解码后统一转为 PNG 再进入 Python。
- 整页识别目前针对图片；PDF 后续可逐页渲染成图片后复用同一 MFD → MFR 流程。
- MFD 只负责定位公式，不负责识别普通文字。
- UniMERNet 当前使用 Tiny 档，优先控制下载体积和 CPU 内存占用；Small/Base 可作为后续高级选项。
- Typst 继续复用 Formula 现有 LaTeX → Typst 转换链路。

## 授权说明

- Pix2Text 代码为 MIT License。
- UniMERNet 为 Apache License 2.0。
- 公式区域检测使用 Pix2Text 自带 MFD 路径，不直接集成 PDF-Extract-Kit。这样既减少依赖，也避免把 PDF-Extract-Kit 后续版本的 AGPL-3.0 授权要求引入 Formula 主程序。

发布时仍需在第三方许可文件中保留相应版权与许可证信息。

## 就绪与错误处理

venv 存在不代表任一模型已经安装完成。Formula 分别维护：

- Pix2Text 就绪状态；
- UniMERNet 就绪状态；
- MFD 公式区域检测就绪状态。

未通过模型初始化的环境不能开始识别。安装和识别使用单独队列并拒绝重复请求；Python 错误和超时保留日志并自动展开日志区域。

已复现 RapidOCR 3.10.0 移除 `resolve_model_key` 导致 CnSTD 1.2.8 导入失败；Pix2Text 基础安装继续固定 `cnstd==1.2.8`、`cnocr==2.3.3`、`rapidocr==3.9.2` 兼容组合。

## 后续阶段

- PDF 逐页公式提取；
- 公式区域缩略图预览与批量勾选；
- 识别置信度与候选结果显示；
- 粘贴剪贴板图片、拖拽图片、屏幕区域截图；
- OCR 环境删除/更新/模型版本管理；
- Windows 本地 OCR 后端；
- Apple Silicon 上评估 MPS/CoreML/ONNX 加速。
