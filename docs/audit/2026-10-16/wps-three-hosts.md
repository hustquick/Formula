# WPS 三类宿主：双原生剪贴板

## 协议证据

同公式原生 fixture：Tests/Fixtures/WPS/{writer,presentation,spreadsheet}/fraction，公式为分式 (x²+y²)/(a+b)，每组保留完整 manifest 与载荷。

| 宿主 | 关键类型 | 内容 |
| --- | --- | --- |
| Writer | com.trolltech.anymime.Kingsoft WPS 9.0 Format | 7296 字节，Word OOXML ZIP / word/document.xml / OMML |
| Presentation | com.trolltech.anymime.Art::GVML ClipFormat | 9405 字节，DrawingML ZIP / lockedCanvas / a14:m / OMML；另有 drawingEx 和图片 fallback |
| Spreadsheet | com.trolltech.anymime.Art::GVML ClipFormat | 4997 字节，DrawingML ZIP / lockedCanvas / a14:m / OMML；无 drawingEx/media |

Slides 另发布 WPS Drawing Shape Format、Chromium custom data、Kingsoft Data Descriptor；Sheets 另发布 WPS Drawing Shape Format、Et Internal Shape、WPS Spreadsheets 6.0 Format。详细类型/哈希以 fixture manifest 为准。

## 人工剔除与生成实验

- 单项原生 Sheets GVML：用户最终更正确认三者均可编辑，撤销早先 Writer 无内容反馈。
- 完全自有最小 GVML，含 Greek、上下标和根式的新分式：Slides/Sheets 可编辑，Writer 无内容。原生包中使 Writer 兼容的额外因素尚未定位，不能宣称最小 GVML 单项通吃。
- 同 item 自有 Writer OOXML + 自有 GVML，无图片或文本：用户确认三者皆可编辑。该实验支持路线 A。

Slides/Sheets 通过同一个自有 GVML codec 的单项实际验收，确认在当前测试条件下共享该结构化入口。不存在必须生成 Et/Chromium 私有二进制的证据。当前 Formula 原来只提供 Writer 文档封装，没有 DrawingML/GVML；用户报告 Slides/Sheets 扁平化与缺少其已验证结构化入口一致，但此前究竟读取 HTML 还是别的 fallback 未做读取日志证明，不能声称精确定位了其选择分支。

## 实现

macos/formula-wps-clipboard.py：共享 encode_gvml，将同一数学 OMML 封装为自有三部件 DrawingML package，不读 fixture、不从 Writer XML 转换、不含图片。Mac 源码转换器 formula-latex-ooxml.py 在同一次转换输出 OMML、Writer DOCX、candidate.gvml。FormulaDocument.swift 后台返回 OMML+GVML，web/app.js 版本核对后提交全部表示，Formula.swift 在同 item 写入两种 WPS 原生类型及原有 MathML/OMML/LaTeX/Typst/自有实体/HTML/SVG/PDF/PNG/文本。

不新增宿主检测：已验证双表示可共存；本机 WPS 12.1.29166 共用主 bundle com.kingsoft.wpsoffice.mac，复制时前台又是 Formula，不能把它当粘贴目标。没有引入脆弱的标题检测。未知目标同样提供完整 bundle。

本轮只增加一个共享嵌入 exporter，不无关重构，也不添加未证明必要的 HostDetector 或两份重复 Slides/Sheets codec。GVML shape 当前使用固定初始尺寸和默认字体/字号，复杂公式尺寸、颜色/字体还需扩展验收；不宣称完整展示属性保真。已知 mathbf、负间距限制保留。

## 自动验证

Python 6 个测试方法通过，新增必需公式集共 11 项：上标、下标、组合、分式、根式、求和、积分、矩阵、分段、多行、Greek 根式/括号嵌套。每项验证 GVML ZIP CRC、自有三部件、无图片、OMML 数学树与同次源转换完全一致以及目标结构存在。

真实生产转换桥接的 equation-clipboard、equation-upright 通过；focus-copy-matrix 三尺寸通过；source-equation-race 通过；universal-pasteboard 增加 GVML 数据同 item 精确回读通过。前端 bundle 与完整原生应用构建通过（既有 API 弃用警告）。这些不替代三宿主最终产品验收。

## 交付门禁

双包重放三宿主人工实验通过；应用自身完整多表示复制的三宿主验收待部署后进行。未推送、未创建/更新 PR/远程标签/Release，未获本轮推送授权。

部署完成：scripts/install-local.sh 构建、资源核对、ad-hoc 签名验证通过。已安装并确认启动 /Applications/Formula.app，备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-191058/Formula.app，保持 org.mathforge.desktop 和原有数据模型路径。尚待应用自身最终验收。

## 应用自身三宿主人工验收

用户在已安装双表示版 Formula 按提示执行预览复制一次、分别到 Writer/Slides/Sheets 粘贴并进入公式编辑，明确反馈“皆可编辑”。本轮应用链路三宿主验收通过；不把图片、源码或扁平文本计为成功。主要验收输入为分式 (x²+y²)/(a+b)。提示同时提供了 Greek/上下标/根式第二样例，但回复未分别说明，因此不单独将第二样例记为人工验收通过；其自有双包重放三宿主验收与自动结构测试证据仍保留。

最终状态：共享 GVML codec + Writer OOXML 同 item 发布，无需宿主检测；代码、构建、自动测试、备份安装与启动完成，三真实 WPS 宿主用户确认可编辑。范围为本机 WPS 12.1.29166 的已测公式。固定 GVML 初始尺寸/展示属性、复杂语法和其他版本限制仍保留。未推送 GitHub，未创建/更新远程 PR、标签或 Release，仍需明确推送授权。

## 推送授权与提交范围

用户在三宿主验收后明确要求“推送”。提交包含本轮剪贴板功能及其统一公式对象必要依赖、协议 fixture、测试和审计工具。OCR 引擎/布局、界面样式、Windows 等其他在任务开始前已有的改动留在工作区。待提交索引已导出到临时目录，独立编译前端和完整 Mac 原生应用通过；对象、复制、积分、焦点、快捷键、异步失败保护及 Python 公式集测试通过。没有因此重新安装应用；用户已验收的 /Applications/Formula.app 保持运行版本。
