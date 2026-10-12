# Formula 本地图片公式识别

## 目标

Formula 主应用保持轻量，不把 Python 环境、识别依赖和模型权重打进 DMG。用户第一次使用“图片识别”时按需安装本地组件；安装完成后可离线识别。

## 当前架构

### 递进式识别能力

Formula 不把 Pix2Text 与 UniMERNet 作为两个彼此独立的下载项，而是采用递进式安装：

- **标准识别**：Pix2Text 基础环境 + MFD 1.5 公式区域检测 + Pix2Text 公式识别。安装完成后即可完成“整页找公式 → 识别 → 导出/编辑”的完整流程。
- **增强识别**：在标准识别全部能力基础上，再额外安装 UniMERNet Tiny，用于复杂公式、手写公式和噪声截图。

如果用户直接选择“增强识别”，Formula 会自动先安装并初始化标准识别所需的 Pix2Text 与 MFD，再安装 UniMERNet Tiny，不允许出现“只有 UniMERNet、没有 MFD”的不完整状态。

UniMERNet Tiny 模型权重约 441 MB，只有用户主动选择增强识别时才下载。基础版与专业版分别使用独立虚拟环境和就绪标记。专业版依赖固定 `transformers==4.42.4`、`torch==2.2.2` 等已验证版本，不能在 Pix2Text 环境中安装。专业版整页模式通过基础版 Python 子进程执行 MFD，然后在专业版进程识别裁剪区域。

### 两种图片模式

1. **单个公式**：图片直接交给当前识别模型，返回 LaTeX 并自动送入 Formula 编辑器。
2. **整页提取公式**：输入教材、论文或笔记的整页照片；先用 Pix2Text 自带的 **MFD 1.5（Math Formula Detection）** 只检测数学公式区域，不对普通正文做 OCR；再裁剪每个公式区域并交给 Pix2Text 或 UniMERNet 识别。

整页流程为：

```text
整页图片
  ↓
MFD 1.5 检测全部公式区域
  ↓
按页面顺序裁剪各公式
  ↓
Pix2Text 或 UniMERNet Tiny
  ↓
渲染后的公式结果列表 + Checkbox
  ↓
勾选即同步到编辑器；取消即移除
```

普通正文、页码和背景不会作为最终识别结果返回。

## 多公式交互

整页图片检测到多个公式后，Formula 一次列出全部识别结果。列表显示渲染后的数学公式，而不是要求用户阅读 LaTeX 源码。

每个公式前使用 Checkbox：

- 勾选一个公式：该公式立即同步到 Formula 源码输入与输出预览；
- 勾选多个公式：按页面阅读顺序组合并同步；
- 取消某个公式：立即从组合结果中移除；
- 取消最后一个公式：清空本次 OCR 组合结果；
- 不再设置“确认插入”或“插入所选”之类的二次确认按钮。

当选择多个公式时，前端使用 `gathered` 环境保持每个公式独立成行，并按检测结果的页面顺序排列。

## 安装流程

1. 用户打开“图片识别”。
2. 选择“标准识别（Pix2Text）”或“增强识别（UniMERNet Tiny）”。
3. Formula 检查本地 OCR 环境、MFD 与对应识别能力的就绪状态。
4. 未安装时，用户点击安装当前识别能力。
5. Formula 优先选择 Python 3.11，支持 3.10–3.12；拒绝不兼容解释器并在独立目录创建新的 venv。
6. 基础版未就绪时，先安装 Pix2Text 基础依赖并初始化 MFD 1.5；升级专业版复用已验证基础版，不修改其环境。
7. 初始化 Pix2Text 公式识别并写入标准识别就绪标记。
8. 如果选择增强识别，再安装 `unimernet==0.2.3`，下载 `wanderkid/unimernet_tiny` 权重并初始化 UniMERNet Tiny。
9. 只有各层对应模型真实完成初始化后才写入 ready 文件。

OCR 环境与 UniMERNet 模型位于用户 Application Support 的 `MathForge/OCR` 下；Pix2Text 使用其默认 `~/.pix2text` 模型缓存。两者都不计入 Formula.app/DMG 体积。界面的空间统计计算 OCR 目录中的文件，不重复计算环境软链接，也不包含外部 Pix2Text 缓存。

安装先在固定绝对路径的 `environment-UUID` 目录中完成，成功后将 `venv` 或 `venv-unimernet` 软链接切换到已验证环境；不会移动 venv，因此 pip 等入口的绝对 shebang 保持有效。切换异常会恢复原环境和原就绪标记。取消立即终止当前进程及子进程，移除未启用的新环境和本应用 `models` 目录下的 `.incomplete` 文件，保留已完成的权重以及 Pix2Text 外部可续传缓存。

安装界面分别显示识别状态和安装阶段，按当前步骤的输出显示百分比或不确定进度，持续保留最近的日志。专业版安装中每三秒刷新基础版就绪状态，基础版完成后无需等待专业版下载即可识别。Python 版本检查和目录空间统计在后台运行；空间统计缓存一分钟，避免大目录扫描阻塞界面或取消操作。原生图片选择器显式允许选择文件，并使用现代 UTType.image 类型声明。

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

- Pix2Text 标准识别就绪状态；
- UniMERNet 增强识别就绪状态；
- MFD 公式区域检测就绪状态。

增强识别安装成功必须同时意味着标准识别与 MFD 已经就绪。未通过模型初始化的环境不能开始识别。安装和识别使用单独队列并拒绝重复请求；Python 错误和超时保留日志并自动展开日志区域。整页 JSON 结果通过临时文件传递，避免大结果被进程日志长度限制截断；处理后删除临时图片与结果文件。

已复现 RapidOCR 3.10.0 移除 `resolve_model_key` 导致 CnSTD 1.2.8 导入失败；Pix2Text 基础安装继续固定 `cnstd==1.2.8`、`cnocr==2.3.3`、`rapidocr==3.9.2` 兼容组合。

## 后续阶段

- PDF 逐页公式提取；
- 原图公式框编号与结果列表联动；
- 识别置信度与候选结果显示；
- 粘贴剪贴板图片、拖拽图片、屏幕区域截图；
- OCR 环境删除/更新/模型版本管理；
- Windows 本地 OCR 后端；
- Apple Silicon 上评估 MPS/CoreML/ONNX 加速。
