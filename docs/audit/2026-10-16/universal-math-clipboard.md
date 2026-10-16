# Universal Math Clipboard：第一阶段协议审计

## 当前证据与边界

已读取两份在线长期规范及项目 AGENTS.md。此次仅增加只读诊断工具，不改应用复制行为或部署应用。

源码路径：`web/app.js` 的 `copy` 命令 → `copyEquation` → `web/equation-clipboard.mjs` → `macos/Formula.swift` 的 `EquationClipboard`。

公式对象复制写入一个 NSPasteboardItem：

| 表示 | macOS 类型 | 编码 |
| --- | --- | --- |
| MathML | 注册名 MathML、MathML Presentation 转换得到的 UTI | UTF-16LE |
| MathML | org.w3.mathml、public.mathml | UTF-8 |
| HTML 内嵌 MathML | public.html | UTF-8 |
| LaTeX | org.mathforge.latex | UTF-8 |
| 文本 fallback | public.utf8-plain-text | UTF-8，普通智能复制为 LaTeX |
| Formula 自有实体 | org.mathforge.equation | JSON UTF-8 |
| 图形（存在时） | public.svg-image、com.adobe.pdf、public.png | 原始字节 |

“复制为可编辑公式”路径不带图形，文本为 MathML。源码选区 Command+C 复制文本，MathLive 选区复制 LaTeX；不能据此判断公式对象复制协议。

目前没有 WPS 原生对象、OMML、Typst 或 RTF 的同次复制表示。已有单独 LaTeX、Typst、MathML、SVG、PNG 命令未修改。上述是源码审计，尚非已安装 Formula 的 Command+C 实测结果。

当前剪贴板实际快照仅含 public.utf8-plain-text、public.text、com.apple.is-remote-clipboard；来源未确认，不能标记为 WPS 样本。

## 最小采样方法

从项目根目录运行：

```sh
xcrun swiftc tools/pasteboard-audit.swift -o /tmp/formula-pasteboard-audit
/tmp/formula-pasteboard-audit build/pasteboard-audit/wps-equation-01
```

每次先在对应应用复制，再运行第二条命令，输出目录必须是新的。依次采集：

1. Formula 预览/公式对象 Command+C → `formula-object-01`。
2. WPS 普通文本 → `wps-text-01`。
3. WPS 图片对象 → `wps-image-01`。
4. WPS 真正可编辑公式，退出内部文本选区后选中整个公式对象 → `wps-equation-01`。
5. 同一公式再次复制，以及内容不同的第二个公式 → `wps-equation-02`、`wps-equation-different-01`。

记录 WPS 版本、公式内容、复制时选区形态，以及在 WPS 自身粘贴后是否仍为整体可编辑公式。工具不写剪贴板；读取可能触发提供方延迟生成数据。manifest.json 包含 item 边界、类型顺序、注册名（可解析时）、长度、SHA256、读取失败及 changeCount。载荷保存为 .bin，保存在 git 忽略的 build 目录，不输出载荷内容；请使用无敏感内容的测试公式。

## 判定流程

比较同版本 WPS 的文本、图片、原生公式样本，检查额外类型和同类型载荷差异。只有类型名称不能确定协议；HTML/RTF 也可能包含对象封装。解析实际字节以确定容器、数学结构、对象元数据和依赖。

随后需要逐项剔除或单项重放，在 WPS 实际粘贴并进入公式编辑状态，确定必要类型组合。不得将 SVG、PNG、普通文本或 MathML 字符串粘贴视为成功。跨进程/重启后的重放用于排除仅进程内句柄或缓存引用。

如为私有格式，需评估其是否自包含、版本稳定、能否从任意 Formula Entity 确定性生成，以及是否包含不可重建的内部引用。无法生成时明确报告技术阻塞，不冒充原生支持。

优先级是产品目标；Pasteboard 的声明顺序不能强制宿主按该优先级选择。只有真实宿主验收能证明它选用了可编辑对象。

## 本轮验证

- Swift 采样工具编译成功，读取真实 general Pasteboard 成功，changeCount 稳定。CoreServices 注册名反解有弃用警告，当前构建可用。
- `node tests/equation-pasteboard.cjs` 通过（独立命名的真实 NSPasteboard 多表示测试）。
- `node tests/equation-clipboard.cjs` 未运行成功：环境缺少 playwright 模块。
- 应用代码未修改，应用构建、安装、启动未执行；本轮交付物为本机可运行的诊断工具。
- 等待 WPS 原生公式及对照样本；协议和生成可行性尚未确定。
- 未进行 GitHub 写入，未获本轮验收和推送授权。


## WPS 用户原生公式样本（2026-10-16）

用户确认复制真正可编辑的 WPS 公式后采集，changeCount=208 全程稳定。完整快照位于 `build/pasteboard-audit/wps-equation-01-carbon/manifest.json`。

关键发现：AppKit NSPasteboardItem 及 board.data 对包含空格的 Qt 私有 flavor 名称均返回 nil；这不是载荷不存在。诊断工具已增加 Carbon PasteboardCopyItemFlavorData 通路，成功读取全部 16 个底层 flavor（含零字节 Embed Source），保留每项长度及哈希。此前 AppKit 读取失败记录保留用于诊断。

| 私有 flavor（前缀 com.trolltech.anymime.） | 字节 | 实际内容 |
| --- | ---: | --- |
| Kingsoft Data Descriptor | 133 | 二进制前缀加 registry XML |
| Kingsoft WPS 9.0 Format | 7219 | ZIP/OOXML 文档包，含 word/document.xml 等 15 个条目 |
| Embed Source | 0 | 空载荷，不能据名称判断为 OLE 对象 |
| Object Descriptor | 88 | 二进制描述符，UTF-16 文本 WPS Docs Document |
| Kingsoft Image Data | 1508 | 未解析 |
| Rich Text Format | 17079 | 与 text--rtf 相同的 RTF |
| Kingsoft Shapes Tag | 32 | JSON，objectsTag 和 shapesTag 均为空 |

另有 text--rtf、text--richtext、传统 Mac 文本、UTF-16 文本、public.text、text--plain、public.html、text--html 及 UTF-16 external 文本。AppKit 另提供 public.utf8-plain-text 等别名。

OOXML 的 word/document.xml 含真实 m:oMath，内部有 m:sSup 和 m:rad，文本对应 α+b²=√c。包中无 embeddings 或 media 条目。由此可确认：该 WPS 原生复制样本携带 OMML，但它位于 Kingsoft WPS 9.0 Format 的完整 OOXML 包内，不能推出直接写入裸 OMML/MathML 就能创建 WPS 公式。

RTF 未发现 object/objdata/objclass 或数学控制词，发现两个 pict 标记；HTML 未发现 oMath、math、object 等标记。尚未将其作为可编辑通路。

可行性初判：私有 flavor 名称承载的主数据实际可解析为 OOXML，有望从 Formula 生成含 OMML 的文档包；尚需验证 WPS 是否接受跨进程重放、必要的描述符组合、最小包结构，以及 Formula 数学结构到 OMML 的完整转换。当前仅为有证据的候选路线，不是已验证兼容性，也不是已完成实现。

下一步等待 WPS 普通文本和图片对照样本，然后进行逐项剔除粘贴验收。应用未改、未构建或重新安装启动；诊断工具重新编译成功并完成 Carbon 真实读取。未推送 GitHub。


## WPS 普通文本对照样本

用户确认复制 WPS 普通文本后采集于 `build/pasteboard-audit/wps-text-01/`，changeCount=210，全程稳定。Carbon 读取 15 个 flavor，全部返回成功。

与公式样本相比，类型集合仅缺少 `com.trolltech.anymime.Kingsoft Image Data`。`Kingsoft Data Descriptor`（133 字节）、`Object Descriptor`（88 字节）、`Kingsoft Shapes Tag`（32 字节）以及空 `Embed Source` 的 SHA256 均与公式样本完全一致。因此这些类型名称本身不能证明复制的是公式，也不能据此判定其必要性。

普通文本也提供 `Kingsoft WPS 9.0 Format`，为 7387 字节 OOXML ZIP 包，条目集合与公式样本相同。其 word/document.xml 中 m:oMath 数量为 0；普通 w:t 文本拼接为 `audit text`。公式样本对应 m:oMath 数量为 1，结构包含上标、根号。

目前最有区分力的证据是同一私有 flavor 内 OOXML 正文的数学结构，而不是额外出现一个“公式专属 UTI”。公式独有的 Kingsoft Image Data 仍可能只是预览，须与图片样本对照，不能认定它是可编辑载荷。

本次未改代码，未执行新构建或测试，未安装或启动应用。尚待图片样本及实际剔除重放验收；未进行 GitHub 写入。


## WPS 图片对照与单项重放实验

图片快照位于 `build/pasteboard-audit/wps-image-01`，changeCount=213，稳定。也含 Kingsoft WPS 9.0 Format（7383 字节 OOXML），正文 m:oMath=0、w:drawing=1。另有 GVML、WPS Drawing Shape Format、图片 MIME flavor 和 PNG/JPEG/TIFF 等。Kingsoft Image Data 为 4822 字节，因此此类型不专属于公式。Carbon 查询时还枚举到系统派生图像格式，其中 public.pvr 未返回数据，已在 manifest 保留状态。

新增 `tools/pasteboard-replay.swift`：预先校验并读取指定样本类型，然后通过 Carbon 替换剪贴板，只重放明确指定的类型并核对字节。该工具会写剪贴板，区别于只读采样工具。

单项实验只重放 `com.trolltech.anymime.Kingsoft WPS 9.0 Format`（公式样本 7219 字节），完全没有文本、图片、HTML/RTF 或描述符。工具编译成功，写后校验成功；另一个采样进程确认剪贴板仅含这一 flavor，载荷长度及 SHA256 与原样本一致（`replay-equation-package-only-02`）。等待用户实际 WPS 粘贴并进入编辑状态。该实验仅验证已有样本能否跨进程重放，不等于 Formula 已能生成任意公式协议。

注意 `replay-equation-package-only-01` 是首次重放编译失败后误命名的图片剪贴板快照，不可用于重放成功证据；有效实验为 02。首次编译的 flags 类型错误已修复并重新编译通过。

应用代码未改，未构建安装或启动应用。仅诊断与重放工具构建/实际数据校验通过。未推送 GitHub。


## 用户实际验收结果与生成可行性

1. **单项原样本重放通过**：用户明确反馈“成为整体公式，能进入公式编辑并修改”。仅 Kingsoft WPS 9.0 Format 即足以在当前 WPS/当前测试条件下创建整体可编辑公式，不需要其他描述符或 fallback。该实验不证明其他类型不能独立实现同样效果，也不代表跨版本支持。
2. **程序生成数学内容通过**：重新构造 m:oMath，使用 m:f（分子 x+1、分母 y）、等号和 m:rad（z），替换样本包中的旧数学树，重新 ZIP 压缩。生成包 6568 字节，只以相同私有 flavor 写入。XML 解析、写入回读与独立进程快照校验通过。用户明确反馈“新公式正确显示且可编辑”。样本位于 `build/pasteboard-audit/generated-equation-01`，重放快照位于 `replay-generated-equation-01`。

因此：当前 WPS 的协议入口已找到并通过两次人工验收；私有名称下的 OOXML 数学正文可以程序生成，并非必须依赖不可访问的 WPS 内部对象句柄。未发现当前实验必须携带私有二进制描述符的阻塞。

范围限制：生成实验仍复用用户样本的 OOXML 外壳（样式、关系、设置等），不应将其直接作为产品模板提交；需要构造最小自有包并再次验证。目前仓库没有通用输出 OMML serializer；现有文档导入使用 Pandoc 解析 DOCX 是反向能力，不能直接计为已实现的复制输出。需要实现/验证 Formula 数学内容 → OMML → 自有 OOXML 包 → Carbon 私有 flavor，同时保留现有同 item 多表示输出及焦点语义。Word、其他 WPS 版本和 Pages 尚未验证。

最终 Formula Command+C → WPS 可编辑公式的验收**仍未完成**，因为应用复制链路未接入该生成通路。第一阶段正在补采已安装 Formula 的真实 Command+C 类型，以与源码审计区分。

本轮应用源码未修改；诊断/重放工具编译成功，原始及生成载荷回读验证成功，两次 WPS 人工重放验收通过。没有重新构建、安装、启动应用。未推送、未获本轮推送授权。


## 已安装 Formula Command+C 真实采样与第一阶段结论

用户在 Formula 预览区域 Command+C 后采集于 `build/pasteboard-audit/formula-object-01`。一个 item，changeCount=217，稳定。AppKit item 直接列出 11 个表示，与源码审计一致：

| 类型 | 字节 |
| --- | ---: |
| dyn.agu8y42pyrbgy2（注册名 MathML） | 388 |
| dyn.agu8y42pyrbgy2kcusmw1g3pssvu1k4ptr2（注册名 MathML Presentation） | 388 |
| org.w3.mathml | 194 |
| public.mathml | 194 |
| public.html | 308 |
| org.mathforge.latex | 7 |
| public.utf8-plain-text | 7 |
| org.mathforge.equation | 3565 |
| public.svg-image | 8246 |
| com.adobe.pdf | 16450 |
| public.png | 4821 |

org.mathforge.equation 是 mathforge-equation version 1 JSON。底层 Carbon 读取另枚举到文本和多种图像派生格式，完整列表、字节数、哈希与读取状态见 manifest；不能把这些系统派生格式误记为 Formula 代码主动写入。未发现 Kingsoft WPS 9.0 Format、OMML 文档包、Typst 或 RTF 表示。

第一阶段结论：

- 当前安装版 Formula 多表示复制已经实际存在，但缺少本轮已通过 WPS 人工验收的私有 flavor OOXML 包。
- 当前测试条件下，该单一 flavor 已充分实现样本的整体可编辑粘贴；不意味着它是 WPS 唯一可接受的协议，也不等于所有版本支持。
- 程序生成的新 OMML 数学树装入样本 OOXML 外壳后已实测可编辑，因此未发现必须依赖不可生成的私有对象格式的技术阻塞。
- 任意 Formula Entity 到 OMML 的完整映射、无用户样本依赖的 OOXML 包生成、与当前多表示 item 的整合、格式优先级的真实宿主选择，仍需下一阶段实现和回归。Pasteboard 类型顺序不能强制宿主选择。
- 第一阶段七项审计已具备源码、三类 WPS 实样、Formula 实样及两次 WPS 人工协议验证证据；最终产品验收仍未完成。

交付状态：仅新增/调整诊断和重放工具及审计文档；未改应用复制或界面，不涉及布局/编辑状态改动。工具编译通过；真实采样、重放回读与两次 WPS 人工验收通过；原生多表示回归通过；浏览器测试缺 playwright 未能运行。应用构建未执行，未重新安装 `/Applications/Formula.app` 或启动应用。现有 LaTeX、Typst、MathML、SVG、PNG 命令未修改。尚未逐应用验证 Word/Pages，尚未验证 WPS 跨版本行为。未 push/PR/远程写入，未获本轮最终验收或推送授权。


## 第二阶段实现、部署与最终链路人工验收

实现文件：`web/math-omml.mjs`（Presentation MathML → OMML），`web/app.js`（同一对象复制载荷增加 OMML 和 Typst），`macos/Formula.swift`（自有三部件 OOXML ZIP，Carbon 同 item 多表示写入）。未改 UI 布局或标准焦点复制路由；未引入网络、模型或外部进程依赖。没有使用用户样本文档作为产品模板。

数学结构支持：数学行、字符/数字/运算符、文本、分式、平方根/指数根、上下标、上下标组合、定界符、矩阵、上下限及部分重音。未知结构明确报错并在发送原生写入前停止，不将 fallback 当作原生成功。复杂排版属性并未完整映射；不承诺全部 MathML 语义或像素外观一致。RTF 未增加；HTML 保留已有表示；Word/Pages 未进行本轮人工验收。

验证：

- `npm run build:vendor` 通过，完整原生 Swift 应用编译通过。
- `tests/math-omml.cjs` 通过：分式、指数根、矩阵、XML escaping、不支持结构明确拒绝。
- `tests/equation-clipboard.cjs` 通过：对象版本、多格式、既有复制菜单（使用 bundled runtime 的 NODE_PATH，已解决此前 playwright 缺失）。
- `tests/focus-copy-matrix.cjs` 通过：760/1120/1440 三种宽度下焦点、选区、菜单与复制路由。
- `tests/command-shortcuts.cjs` 通过：标准编辑、保存、查找等快捷键。
- `tests/equation-pasteboard.cjs` 通过：原生多表示与无效载荷保护。
- `tests/universal-pasteboard.cjs` 通过：WPS 私有 flavor、OMML、MathML、Typst、图形、文本同 item 精确字节回读；自有 ZIP CRC、部件和 XML 验证。
- 用户确认完全自有三部件最小包中的分式 (x+7)/y 正确显示并能编辑。

按用户要求保存退出后执行 `bash scripts/install-local.sh` 成功。安装 `/Applications/Formula.app`，保持 org.mathforge.desktop；备份 `/Users/hustquick/Library/Application Support/Formula-Backups/20261016-175606/Formula.app`。签名校验通过（ad-hoc，本轮非正式签名/公证）；已启动且进程确认 PID 40267。未删除数据或模型。

用户随后明确确认应用实际 Formula Command+C → WPS Command+V “成为整体公式且能编辑”。实际剪贴板记录为 `build/pasteboard-audit/formula-universal-accepted-01`：一个 item，14 个直接表示，含 WPS OOXML 1593 字节、OMML 395 字节、Typst 11 字节及原有全部 11 个表示，changeCount 稳定；WPS ZIP CRC 验证通过。该记录用于当前测试公式的成功证据，不扩展为任意公式/任意宿主兼容承诺。

本轮最终链路用户验收通过。仍待更复杂数学结构、Word/Pages 和其他 WPS 版本的扩展验证。没有推送 GitHub、创建 PR、远程标签或 Release；未获明确推送授权。仓库开始时已有其他大量未提交修改，均保留。

## 回归修复：积分中直立微分字母丢失

用户反馈积分公式的直立 d 丢失，并提供 WPS 线性源码截图。实际应用链路复现：LaTeX 和 MathML 保留原公式；d 有 mathvariant="normal"，arctan 为 mo，但原 OMML serializer 未输出 run style。

最小修复 web/math-omml.mjs：读取自身/最近祖先 mathvariant，normal/bold/italic/bold-italic 对应 OMML m:sty p/b/i/bi；默认单字符 mi 斜体，运算符/数字/多字符 mi 直立；mtext/ms 标记 m:nor。子元素显式样式覆盖继承。

新增 tests/equation-upright.cjs，使用用户完整积分输入经过真实 MathLive → MathML → OMML → copyEquation，断言 d/arctan 直立、x/C 斜体、分式和原 LaTeX 保留，另验证继承和覆盖。该测试及 math-omml、equation-clipboard、universal-pasteboard 均通过。前端 bundle 和原生应用构建通过。

用户保存退出后 scripts/install-local.sh 已成功安装并启动 /Applications/Formula.app，备份路径 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-175950/Formula.app，ad-hoc 签名验证通过。未删数据/模型。等待本次 WPS 人工样式及整体编辑回归；宿主导出的 LaTeX 宏拼写不保证与原源码逐字相同。未推送 GitHub，未获本轮推送授权。

## 第二次样式回归：冗余直立包装与空白

用户截图显示前次修复向数字、运算符和积分符号均输出 m:sty p，使 WPS 线性源码出现不必要的 mathrm 包装。该行为是本项目 OMML serializer 的过度样式输出，不是验收成功。

本次最小修复 web/math-omml.mjs：默认单字符变量沿用 OMML 默认斜体；普通数字和符号不输出 plain 属性；直立字母仍显式 p。MathML U+2061 ApplyFunction 与 U+2062 InvisibleTimes 不作为独立可见 run 输出。识别常见函数名及紧随的一个 MathML 参数节点，以 m:func/fName/e 表示，避免函数名与等号合并。一般函数参数解析与复杂 MathML 仍有范围限制。

更新 equation-upright 回归：用户完整积分中只应有 d 和 arctan 两项 p，数字、符号无 style，OMML 不含不可见乘号/函数应用字符，且 arctan 用 m:func。该测试、math-omml、equation-clipboard、universal-pasteboard 均通过；前端 bundle 构建通过。等待新版本 WPS 实际间距与线性源码验收，不提前宣称修复成功。未推送 GitHub。

本次部署完成：scripts/install-local.sh 原生构建、前端构建、资源验证、ad-hoc 签名验证均成功；已安装并启动 /Applications/Formula.app，备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-180259/Formula.app。数据与模型未删除。等待本轮用户验收；无 GitHub 写入或推送授权。
