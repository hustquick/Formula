# Formula · Mac 公式工坊

Formula 是面向论文、教材和科研写作的 macOS 公式编辑器。提供 MathLive 可视化编辑、LaTeX / Typst 源码、本机排版引擎和矢量导出；快捷工具与公式模板参考 LaTeX Live，随应用离线打包。

## 下载

[下载最新 Formula Mac 安装包](https://github.com/hustquick/Formula/releases/latest) · [所有版本](https://github.com/hustquick/Formula/releases)

优先下载 Release 中的 `Formula-1.5.1.dmg`。打开磁盘映像，将 `Formula.app` 拖入 Applications 即可。DMG 内是预编译通用应用，同时支持 Apple Silicon 与 Intel，最终用户无需安装 Node.js、npm 或编译工具。

> 当前发布采用临时签名，尚未 Apple 开发者公证。首次启动如被 Gatekeeper 阻止，可在“系统设置 → 隐私与安全性”中选择“仍要打开”。

## 1.6 开发中的输入工作流

开发分支支持粘贴剪贴板图片及向输入卡片拖入一张图片。使用 macOS `⌃⇧⌘4` 截取区域到剪贴板，然后在 Formula 按 `⌘V`；识别候选需勾选确认后才写入。普通文本粘贴不触发 OCR。需已安装本地识别模型，本功能尚未包含在 v1.5.1 Release。

## v1.5.1 更新

- 图片识别、文档识别直接显示在输入卡片内；保留必要选项与状态，安装修复及日志折叠展示，不再弹出模态窗口。
- 输出区统一为格式下拉框与相连的“复制 / 导出”按钮，两者均使用中性色。内置排版提供 SVG、PDF、PNG、JPEG、LaTeX 源码、Typst 源码、MathML、MathForge 共 8 种；本机引擎另支持 TIFF，SVG / EPS 按引擎及转换工具能力显示。格式列表不随每次编译增删。
- 内置排版提供 11 套离线数学字体：New Computer Modern、Asana Math、TeX Gyre Bonum、DejaVu Sans、Fira Math、Latin Modern、TeX Gyre Pagella、TeX Gyre Schola、STIX Two、TeX Gyre Termes、TeX / Computer Modern。切换仅更新预览，保留当前公式，不刷新整页。本机引擎字体使用导言区 / 前置代码配置。
- 输入区“样式”作用于选中内容；输入 A− / A+ 分别记忆源码与可视化编辑显示大小。输出 A− / A+ 调整预览和导出字号，修复本机 LaTeX / Typst 预览缩放。
- 输出默认黑色，透明背景使用可切换标签；PNG 分辨率提供 72、96、150、300、600、1200 DPI，默认 300 DPI。
- 自定义工具最多两行，超限添加会撤回并提示；右侧固定显示 `◈ / T / ◈T` 单选控件。自定义面板可点击外部、按 Esc 或点击完成收起。
- 收藏夹展示自适应缩放的公式图形，点击恢复源码与排版设置；收藏入口使用小星形图标。尺寸和排版引擎信息居于底部中央，与状态、快捷键同行。
- 模板隐藏分类编号；化学默认支持 mhchem；微分符号统一为正体 `\mathrm{d}`。修复快捷工具预览、模板启动位置与语言切换问题。

完整改动见 [版本记录](docs/RELEASE_NOTES.md)。

## v1.4.0 文档公式识别

“文档识别”可直接选择 PDF 或 `.docx`。PDF 使用 macOS PDFKit 逐页渲染，再检测并识别公式；可设置页码范围，每次最多 20 页，结束页填 0 时自动处理最多 20 页并明确提示范围。扫描 PDF 与普通 PDF 使用同一流程。

Word 原生公式通过独立 Pandoc 组件转换为 LaTeX，嵌入图片交给所选 OCR 引擎识别，结果保持文档顺序。首次使用 Word 请点击“安装 Word 解析组件”；它有独立环境，不修改基础版或专业版依赖。旧 `.doc` 请先另存为 `.docx`，外部图片链接会提示跳过。Word 的段落位置用于定位，不冒充固定页码。

结果显示可勾选公式预览以及页码/段落来源，勾选立即同步编辑器。可取消文档识别，取消会终止正在运行的识别进程并清理临时页面。文档每次最多 100 MB、1000 个结果；本功能提取公式，不转换正文、批注或完整文档版式。

## v1.3.0 本地分级识别与整页公式提取

macOS 支持基础识别（Pix2Text + MFD）和专业识别（UniMERNet Tiny）。专业版先确保基础版就绪，再在独立环境中安装；专业版下载期间可继续使用基础识别。整页图片只提取公式区域，结果以公式预览和复选框展示，勾选或取消立即同步到编辑器。

安装选择兼容的 Python 3.10–3.12（优先 3.11），通过真实模型初始化后才标记就绪。修复在新环境中完成，失败或取消保留原环境；界面显示阶段、当前下载步骤进度和实时日志。1.4.0 增加 PDF / Word 文档公式识别；暂不提供 Windows 本地 OCR。

## v1.2.1 本地图片识别修复

- 按需安装 Pix2Text，模型初始化成功后才启用识别。
- 修复 RapidOCR/CnSTD 依赖不兼容导致的 `resolve_model_key` 导入错误。
- 选择 JPG 后显示识别进度，错误与超时保留完整诊断日志。
- macOS 原生解码 JPEG/PNG/HEIC 等图片后统一传递 PNG，识别阶段无需临时下载 HEIC 插件。
- 本地双击构建与 CI 复用同一个通用应用/DMG 构建脚本。

详情见 [本地识别说明](docs/LOCAL_OCR.md)。

## v1.1.0 核心特性

### 完整快捷工具

Formula 直接使用构建时同步并随应用离线打包的 LaTeX Live `map_input.json`，完整提供 10 个快捷工具一级分类及其二级内容：

- 常用符号
- 希腊字母
- 分数微分
- 根式角标
- 极限对数
- 三角函数
- 积分运算
- 大型运算
- 括号取整
- 数组矩阵

二级内容以浮动 palette 打开，不改变主编辑区尺寸。弹层自动避让窗口边缘，支持鼠标、Esc 关闭以及方向键 / Home / End 键盘导航。

### 完整公式模板

公式模板完整提供 LaTeX Live 的 10 个分类：

- 代数
- 几何
- 不等式
- 微积分
- 矩阵
- 三角
- 统计
- 数列
- 物理
- 化学

每个分类点击下三角后，以独立浮动二级面板显示全部模板，不再只保留“第一页”或少量示例。模板点击后直接插入可视化编辑器并同步源码与输出预览。

### 矩阵与多行公式

矩阵、多行、分段公式和符号等均使用浮动二级菜单，不挤压或重排主窗口。矩阵与多行公式支持：

- 上方加行 / 下方加行 / 删除行
- 左侧加列 / 右侧加列 / 删除列
- `matrix` / `bmatrix` / `pmatrix` / `Bmatrix`
- `vmatrix` / `Vmatrix`
- 条件公式与多行对齐

Formula 将 LaTeX Live 数据中的矩阵示意项转换成 MathLive 可编辑占位结构，避免把“…”示意字符直接插入公式。

### Finder 风格自定义工具栏

顶部常用工具栏支持类似 Finder 的自定义方式：

- 从功能面板拖入工具栏
- 工具栏内拖拽调整顺序
- 拖到移除区删除
- 勾选快速添加 / 移除
- 一键恢复默认布局
- 配置自动保存

右侧固定分段控件提供三种显示模式（偏好自动保存）：

- 图标＋文字
- 仅图标
- 仅文字

数字键盘不再保留，避免与编辑器右侧功能重复。

## 输入与编辑

- MathLive 可视化编辑与 LaTeX 源码双向同步。
- LaTeX / Typst 输入模式切换。
- 支持 `$…$`、`$$…$$`、`\[…\]`、`\(…\)` 外层定界符。
- 可视化工具可对选中内容套用分数、上下标、根号、积分、求和、矩阵等结构。
- 显示并复制 LaTeX、Typst 与 MathML。
- 可设置字号、颜色、留白、透明背景、行内 / 独立公式，以及 PNG 分辨率。

可视化编辑器关闭普通字母序列的自动符号替换：输入 `pi`、`alpha`、`sin` 等仍保持普通字母；需要数学命令时显式输入 `\pi`、`\alpha`、`\sin` 并确认，或直接从快捷工具插入。

## 排版引擎

主界面可选择：

| 引擎 | 用途 |
|---|---|
| 内置排版 | MathJax 矢量排版，离线可用 |
| 本机 LaTeX | XeLaTeX / pdfLaTeX / LuaLaTeX，可使用本机宏包和导言区 |
| 本机 Typst | 直接编译 Typst 公式和前置代码 |

输入区“设置”可打开系统排版工具，检测或手动指定：

| 工具 | 用途 |
|---|---|
| XeLaTeX / pdfLaTeX / LuaLaTeX | 本机 TeX 排版 |
| Typst | 本机 Typst 排版 |
| dvisvgm | 将 LaTeX PDF 转换为 SVG |
| pdftops | 将 PDF 转换为 EPS |

LaTeX 进程使用直接参数调用并启用 `-no-shell-escape`。

## 导出与恢复

| 格式 / 操作 | 内置引擎 | 本机引擎 |
|---|---|---|
| SVG | 矢量路径 | Typst 原生；LaTeX 需 dvisvgm |
| PDF | 矢量 | 原生矢量 PDF |
| PNG | 支持透明背景 | PDFKit 渲染 |
| JPEG | 白色背景 | 白色背景 |
| TIFF | — | PDFKit 渲染 |
| EPS | — | 需要 pdftops |
| LaTeX / Typst / MathML | 支持范围内转换 | 支持范围内转换 |
| `.mathforge` | 保存源码与排版设置 | 同左 |

Formula 生成的 SVG / PDF 写入可恢复源码元数据；长期保存建议同时保留 `.mathforge` 文件。

## 收藏与批量导出

- 收藏最多 100 条公式及排版设置。
- 支持收藏 JSON 备份与恢复。
- 自动保存当前公式状态。
- 系统工具支持逐行批量导出 SVG / PDF。

## 快捷键

| 快捷键 | 操作 |
|---|---|
| ⌘O | 导入公式 |
| ⌘S | 保存可恢复公式 |
| ⌘E | 导出 SVG |
| ⌘⇧C | 复制当前输入语言源码 |
| ⌘, | 打开系统排版工具 |
| Option + 拖动预览 | 拖出公式文件 |

浮动公式菜单支持 Esc 关闭；菜单内可使用方向键、Home、End 移动焦点。

## 离线目录机制

v1.1.0 不在运行时依赖 LaTeX Live 网站。发布构建会：

1. 从 LaTeX Live 官方仓库同步 `json/map_input.json`。
2. 校验快捷工具和公式模板各有 10 个一级分类。
3. 将原始 JSON 打包到 `web/vendor/latexlive/map_input.json`。
4. 同时生成适用于 macOS `WKWebView file://` 的 `catalog.js`。
5. DMG 构建完成后再次检查两个目录文件确实存在于最终 `Formula.app` 中。

因此安装后的 Formula 可以断网使用完整快捷工具与公式模板。

## v1.1.0 发布验收

仓库提供机器可执行的发布契约：

```bash
npm run sync:latexlive
npm run validate:v1.1
```

`validate:v1.1` 会检查：

- LaTeX Live 10 类快捷工具与 10 类模板分类名称和数据完整性。
- 快捷项和模板项数量没有异常缩水。
- 二级菜单使用浮动定位，不改变主编辑区布局。
- 模板、快捷菜单具备键盘导航和 Esc 关闭逻辑。
- Finder 风格自定义工具栏与图标 / 文字模式存在。
- 数字键盘未重新引入。
- `Info.plist` 版本为 1.1.0。
- DMG 构建会验证离线 catalog。

另有 `tests/v1.1.cjs` 对完整目录、浮动菜单、主布局不变、键盘导航、自定义工具栏和显示模式执行端到端浏览器验收。

## 本地构建

### 最终用户式本地构建

在 macOS 上双击：

```text
Build-Mac.command
```

脚本会自动：

- 检查 Apple Command Line Tools。
- 同步并验证完整 LaTeX Live 目录。
- 生成 file-safe `catalog.js`。
- 校验 v1.1.0 视觉与运行时版本标记。
- 编译当前 Mac 架构的原生应用。
- 临时签名并验证应用。

### 开发构建

```bash
npm ci
npm run build:vendor
npm run sync:latexlive
npm run validate:v1.1
bash scripts/build-dmg.sh
```

GitHub Actions 使用 macOS runner 分别编译 arm64 / x86_64，再通过 `lipo` 合并成 Universal Binary，验证签名和 DMG 后发布 `Formula-1.1.0.dmg` 与 SHA-256 文件。

## 技术栈

- Swift / Cocoa / WebKit / PDFKit
- MathLive 0.111.1
- MathJax 4.1.3 + New Computer Modern
- tex2typst 0.6.2
- jsPDF / svg2pdf.js

第三方许可见 `THIRD-PARTY-NOTICES.txt`。

## 当前边界

v1.1.0 聚焦高质量公式编辑、模板、排版与导出。v1.2.1 已启用 macOS 单公式图片识别，并修复安装状态和依赖兼容问题；1.4.0 已启用 PDF / Word 文档公式提取；当前版本也不包含自动更新、完整 LaTeXiT 公式库兼容或公式计算系统。
