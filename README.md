# Formula · Mac 公式工坊

面向 LaTeXiT 使用场景的首版 Mac 公式工具：结构化输入、LaTeX / Typst 源码、离线矢量导出，以及本机排版引擎。

## 下载

[下载最新 Formula Mac 安装包](https://github.com/hustquick/Formula/releases/latest) · [所有版本](https://github.com/hustquick/Formula/releases)

优先下载 Release 中的 `Formula-版本号.dmg`，打开后将 Formula.app 拖入 Applications；该预编译通用应用支持 Apple Silicon 和 Intel，无需安装编译工具。`Formula-Mac.zip` 为旧式首次编译包；GitHub 自动生成的 Source code 压缩包是开发源码。

## DMG 安装与启动

1. 在 Releases 下载 `Formula-1.0.10.dmg`（后续版本使用相应版本号）。
2. 打开磁盘映像，将 Formula.app 拖到 Applications 快捷链接。
3. 从“应用程序”启动 Formula。DMG 内是预编译通用应用，无需 Command Line Tools、Node.js 或 npm。

此版本采用临时签名，尚未 Apple 开发者公证。

## 旧式 ZIP 包安装与启动

1. 解压 `Formula-Mac.zip`，将 `Formula.app` 拖入“应用程序”。
2. 首次打开可使用右键 → 打开。若 macOS 阻止启动，进入“系统设置 → 隐私与安全性”，对该应用选择“仍要打开”。此版本没有 Apple 开发者公证。
3. 首次启动在本机编译原生外壳。如果缺少 Apple Command Line Tools，应用会显示系统安装提示；安装完成后再次打开即可。已安装完整 Xcode 的 Mac 也可以使用。
4. 后续启动直接打开已经编译的原生应用；不需要 Node.js、npm、Python 或网络连接。

支持 macOS 12 及以上，分别在 Apple Silicon 或 Intel Mac 上构建本机架构版本。未安装 TeX 或 Typst 也可以使用内置排版。

压缩包另附 `Build-Mac.command`，可以在终端显示编译过程并生成可独立移动的原生 `Formula.app`。首次启动版本的原生缓存位于 `~/Library/Application Support/MathForge/Builds/`；可将其中生成的 `.app` 拷出作为独立应用。

**验证范围：** GitHub Actions 已在 macOS 上编译通用应用，并验证 DMG 完整性、挂载后的两个架构、临时签名和 Applications 链接。离线编辑器及八类文件导出已经自动验证；本机引擎使用的 LaTeX、Typst 和 EPS 命令已在 Linux 上实际执行。Gatekeeper、剪贴板、文件拖出和 Finder 启动仍需 Mac 实机验收。

## 输入与编辑

- 可视化公式输入，提供分数、上下标、根号、积分、求和与矩阵快捷按钮；支持数学虚拟键盘。
- LaTeX / Typst 源码切换、粘贴导入、双向同步：可视化编辑会更新源码和导出预览，源码修改会更新可视化公式。系统引擎在输入稍停后排版。
- 根号按钮：选中内容时包住选中公式，没有选中内容时插入可填写的根号结构。原生 Typst 扩展语法无法转换时，请使用源码编辑。
- 支持 `$…$`、`$$…$$`、LaTeX `\[…\]` 与 `\(…\)` 外层定界符。
- 矩阵、多行公式、上下限、数学字体等常用公式结构。
- 显示并复制 LaTeX、Typst 与 MathML。
- 设置字号、颜色、留白、透明背景、行内 / 独立公式，以及 PNG 清晰度（1–4 倍；等效约 96–384 DPI）。

内置模式通过 `tex2typst` 在 Typst 数学语法和 LaTeX 之间转换，再交给 MathJax 排版。**跨语言转换存在语法边界，并非任意 LaTeX / Typst 文档无损互转。** 使用自定义 Typst 函数或原生特性时，请选“本机 Typst”，在系统工具里填写 Typst 前置代码。无法转换的 Typst 公式仍可由本机引擎排版，此时可视化编辑区会暂时禁用。

## 系统排版工具

点击“系统工具”检测并配置：

| 工具 | 用途 |
|---|---|
| XeLaTeX / pdfLaTeX / LuaLaTeX | 调用本机 TeX 和自定义宏包生成矢量 PDF；自动检测按此顺序优先 |
| Typst | 直接编译 Typst 数学公式，生成 PDF / SVG |
| dvisvgm | 将本机 LaTeX 的 PDF 转成无字体依赖的 SVG；实际支持取决于其 PDF 后端 |
| pdftops | 将矢量 PDF 转成 EPS |

自动查找登录终端 PATH，以及 `/Library/TeX/texbin`、`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`、`~/.local/bin` 和 `~/.cargo/bin`。找不到时点击“指定路径”，选中**可执行文件**，例如 `xelatex` 或 `typst`，而不是目录。用户选择的路径会优先检测并保存。

主界面的引擎菜单选择“内置排版”“本机 LaTeX”或“本机 Typst”。原生 LaTeX 优先使用 `standalone` 自动裁切；缺少该类时，普通公式自动改用 article 公式盒裁切。完整 align / gather 等独立环境仍需要 standalone。`amsmath`、`amssymb`、`xcolor` 缺失时会提示具体包名，预览区可查看或复制完整日志。用户可填写导言区、宏包与宏定义。源文件以直接参数交给进程执行，LaTeX 使用 `-no-shell-escape`。

Typst 前置代码用于 `#let`、`#import`、字体或函数定义。当前编译根目录是每次编译的临时目录，因此相对路径的外部图片 / 文件不会自动复制；需要引用本机外部资源的完整文档不在首版范围内。

## 导出、复制与恢复

| 格式 / 操作 | 内置引擎 | 本机引擎 |
|---|---|---|
| SVG | 字形路径，透明 / 白色背景 | Typst 直接生成；LaTeX 需要 dvisvgm |
| PDF | 矢量，不是截图 | 原生引擎矢量 PDF |
| PNG | 可选透明背景 | PDFKit 渲染，可选透明背景 |
| JPEG | 白色背景 | 白色背景 |
| TIFF | — | PDFKit 渲染 |
| EPS | — | 需要 pdftops；EPS 不保留透明通道 |
| LaTeX / Typst / MathML | 在转换支持范围内 | 在转换支持范围内 |
| `.mathforge` | 完整保存当前公式和排版设置 | 同左 |
| 复制图片 | Mac 中提供 PNG 和 SVG | Mac 中提供 PNG 和 PDF |
| 拖出公式文件 | Mac 中按住 Option 拖动预览，优先 SVG | 优先 SVG，否则 PDF |

导出格式由接收软件决定是否可以在其内部直接编辑。SVG 字形是路径，适合 Affinity 等矢量软件；路径不等同于可直接修改源码的文本。

Formula 生成的 SVG 含源码和排版元数据，导入可恢复。PDF 的 Subject 元数据包含可恢复信息，Mac 应用可重新导入自己的 PDF。第三方软件重新保存后可能删除元数据，长期保存建议使用 `.mathforge`。

导入支持 `.tex`、`.typ`、`.txt`、本工具的 `.svg` / `.pdf` / `.mathforge`，以及收藏备份 JSON。LaTeX 文档导入会提取导言区与 document 内部内容，适用于单个公式文件。

收藏可保存最多 100 条公式及其排版设置，支持重新载入、删除和 JSON 备份 / 恢复。当前公式在退出后自动保存。“系统工具”还提供按行批量导出 SVG / PDF；首版逐个弹出保存对话框。

## 快捷键

| 快捷键 | 操作 |
|---|---|
| ⌘O | 导入公式 |
| ⌘S | 保存可恢复公式 |
| ⌘E | 导出 SVG |
| ⌘⇧C | 复制当前输入语言的源码 |
| ⌘, | 打开系统排版工具 |
| Option + 拖动预览 | 向桌面或接收文件的应用拖出公式文件 |

## 开发与验证

原生部分：Swift / Cocoa / WebKit / PDFKit；编辑部分：MathLive 0.111.1；内置 SVG 排版：MathJax 4.1.3 / New Computer Modern；Typst 转换：tex2typst 0.6.2；矢量 PDF：jsPDF / svg2pdf.js。

源码位于应用包 `Contents/Resources/macos/` 和 `Contents/Resources/web/`。Mac 编译入口为 `Build-Mac.command`。开发者更新前端依赖时使用 `npm ci` 后运行 `node build-vendor.mjs`；最终用户不需要安装前端依赖。

自动测试 `tests/browser-test.cjs` 覆盖 LaTeX / Typst、矩阵、多行公式、八类文件导出、收藏、无效语法、设置和零外部请求。第三方许可随包提供 `THIRD-PARTY-NOTICES.txt`。

首版未包含全局菜单栏热键、macOS Services、自动更新、公式计算，以及完整 LaTeXiT 公式库格式兼容。实际交互需要在 Mac 上进一步验收。

## 开发

运行 `npm ci` 和 `node build-vendor.mjs` 更新离线资源。在 macOS 上运行 `bash Build-Mac.command` 构建原生应用。保留旧版 MathForge 的数据目录、文件格式和应用标识，以继续使用已有收藏与公式。

仓库保存应用源码和依赖锁定文件，不提交生成的 `web/vendor/`。从 GitHub 下载源码后，先执行 `npm ci`、`node build-vendor.mjs`，再构建 Mac 应用。打包后的应用包含全部离线资源，使用时无需联网。

## DMG 发布

GitHub Actions 在 macOS 上执行 `npm ci`、离线资源打包和 `bash scripts/build-dmg.sh`，分别编译 arm64 / x86_64 后合并为通用应用。生成 `Formula-版本号.dmg` 和 SHA-256 校验文件，并上传对应 Release。镜像包含 Formula.app 与 Applications 快捷链接。当前使用临时签名，未 Apple 公证；实际 Finder 启动仍需 Mac 实机验收。

可视化编辑器关闭字母序列自动替换：`in`、`pi`、`alpha`、`sin` 等保留为字母。需要符号或函数时显式输入 `\in`、`\pi`、`\alpha`、`\sin` 等命令并按回车；结构也可用工具栏插入。

选中公式后可点击工具栏套用结构：下标/上标附加到选中内容前的基底（例如 Qincome 中选中 income 得到 Q_{income}）；根号包住选中内容，分数将其放入分子，积分/求和将其作为主体，矩阵将其放入第一个单元格。无选区时插入带占位的结构。

可视化生成的 LaTeX 自动移除数学表达式中的冗余空格；保留反斜杠命令与字母之间的分隔、文本内容和显式间距命令。Typst 的必要空格由转换器独立生成。手动输入的 LaTeX 源码不会被自动重排。

## 可视化结构工具

工具栏可直接插入分段公式，使用 Tab / Shift+Tab 在表达式和条件间移动。点击分段、矩阵或多行对齐中的单元格后，可通过上方/下方加行、删除行、左侧/右侧加列和删除列调整结构；撤销/重做可恢复操作。扩展工具包括括号、绝对值、范数、n 次根、极限、连乘、定积分、偏导、导数、多种矩阵、字体、向量与上下划线，以及常用希腊字母和关系符。选区作为结构内容保留。

点击“自定义工具栏”后，可从功能面板拖入按钮，在主工具栏内拖拽排序，或拖到移除区；也可通过勾选控制显示。点击“完成自定义”退出，配置自动保存。“恢复默认”还原初始按钮与顺序。

工具按钮提供公式效果图标；“按钮显示”可选择图标＋文字、仅图标或仅文字。显示方式自动保存，仅图标时悬停可查看名称。

扩展工具分组以悬浮二级菜单展开，不改变编辑区布局；选择功能、点击外部或按 Escape 关闭。数学键盘仅保留编辑区右侧的内置图标入口。
