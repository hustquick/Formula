# Formula 商业化路线图：V1.6 实际实现审计

审计日期：2026-10-15（Asia/Shanghai）。定位：面向科研、论文和教材写作的专业公式工作台。

## 1. Executive Summary

**Formula 已具备实用的单公式编辑与本地识别基础，但尚未达到可承诺无损三表面编辑、Office 原生可编辑粘贴和可恢复批量校订的商业成熟度。** 应先修内容所有权与表示契约，再验证办公互操作；不能以增加按钮或更多 OCR 模型代替这些工作。

基线为发布标签 `v1.6.0`，提交 `e6aca97fe635f41e662af397e5f0e9fc64181628`。工作区另有尚未发布的收尾优化：高级缩进、整页识别默认首选、1/0 PDF 默认、版本预览恢复、补全框定位和末行裁切。本文分别说明，不将本地能力归入已发布版本。本轮唯一新增产品改动是移除 OCR 结果的 `isolated / embedding / native` 分类显示；底层分类和文档页码来源仍保留。

状态定义：implemented = 找到实际代码；partial = 链路已有但覆盖、持久性或工作流不完整；missing = 未找到实现；architecture risk = 现有所有权/状态/平台边界会阻碍可靠扩展。implemented 不代表商业验收通过。没有声称 OCR 准确率、完整数学等价或 Office 粘贴成功率。

证据入口：`docs/audit/2026-10-15/commercial/probe.json` 与 `tests/commercial-audit.cjs`；已有 `tests/typesetting.cjs`、`revision-history.cjs`、`source-conversion.cjs`、`output-actions.cjs`；既有真实本机回归见 `docs/audit/2026-10-15/finish/verification.json`。历史审计的旧失败必须与其后修复区分，不能直接引用旧数字作为当前结论。

### 最强的五项

1. MathLive 结构编辑、选区变换和紧凑的单公式工作区。
2. 离线 MathJax 排版、多字体、矢量/位图导出及失败保留最后有效预览。
3. LaTeX / Typst 源码辅助、统一生成格式与有保护的模式切换。
4. Mac 本地基础/专业 OCR、PDF / DOCX 提取和可取消任务。
5. 统一命令注册、应用级撤销快照、收藏/历史、本机工具配置及备份安装。

### 最危险的五个缺口

1. 转换与输出会改变表示缓存，缺少原始表示和转换保真状态；已实际复现复制中途导致原 LaTeX 表示丢失。
2. Office 原生可编辑对象互操作没有验收矩阵；图形 payload 通过不能证明真实粘贴成熟。
3. OCR 原文、校订稿与来源没有持久 FormulaRecord，切换结果可能丢失该条校订稿。
4. 批量任务没有逐条失败恢复、checkpoint、workspace manifest；大文档失败后无法继续上次审阅。
5. macOS 仍 ad-hoc，无 Developer ID/公证及可信更新闭环；Windows 版本、桥接能力与发布标识明显不齐。

收费前必须完成三项门禁：**内容保真与可恢复契约；明确支持范围的 Office 真实工作流验收；可信签名安装、升级与恢复交付。** 若付费卖点包含 OCR，还必须完成代表性 benchmark 和人工校订成本验收，不能仅凭两张样例收费承诺高准确率。

## 2. Five Core Capabilities

### 2.1 三位一体编辑

**Current / implemented**：`web/app.js` 的 `state` 保存 `latex`、`rawSource`、`editorMode` 及排版选项；`typesetting.mjs` 从 editorMode 派生语言。MathLive 持有结构和占位符；`readSource()` 以当前 textarea 原文转换到 LaTeX，再 `mf.setValue()`；`syncVisual()` 反向读取 MathLive 并生成源码。Typst 内置预览实际上先转 LaTeX，再由 MathJax 排版，并非原生内置 Typst 引擎。显式本机尝试按语言调用既有工具链。

**Partial**：共享的是一份活动编辑状态，而非稳定、版本化的 FormulaDocument。活动源码是用户输入权威，`state.latex` 同时担当派生缓存与转换枢纽；MathLive 在可视化时又成为权威。没有唯一 formulaId、表示 revision、转换诊断列表、独立保留的原始 LaTeX/Typst。`conversionAvailable` 只有布尔值，不能表达 partial/stale。

| 切换 | 当前行为 | 判断 |
|---|---|---|
| Visual → LaTeX | `syncVisual` 生成 LaTeX | 对 MathLive 已表达结构可用；不保证原始排版源码、注释或宏无损 |
| LaTeX → Visual | 先 readSource，再 MathLive | 有效/可转换保护；MathLive 可表达性不是完整 TeX 保真证明 |
| LaTeX → Typst | tex2typst(strict) + 格式化 | 不支持时阻止；成功也可能归一化宏和布局 |
| Typst → LaTeX | 未编辑时沿用缓存；编辑后 typst2tex | 保护常见往返，但原 Typst 的全部语法/注释/布局无独立存档 |
| Typst → Visual | 经 LaTeX；不支持则阻止 | partial；本机可编译不等于 MathLive 可编辑 |
| Visual → Typst | 经 MathLive LaTeX 转换 | partial；非任意结构无损 |

**实际探针**：输入 `\cfrac{1}{x}` → Typst → LaTeX，未触发其他动作时原文保留。输入同式 → Typst → 复制 Typst → LaTeX，变为 `\frac{1}{x}`。`exportFile()` 无条件 `readSource()`，后者将派生 Typst 解析回 LaTeX 并覆盖缓存。丢失的是原始表示/排版信息，不据此宣称数学数值变化；Undo/历史可能找回原文，但复制动作本身没有独立编辑事务。列为 Phase 1 的内容保真 P0，不在审计中顺手重构整个编辑层。

`source-conversion.mjs` 将 cfrac→frac、limits/nolimits→空白等做适配，证明转换成功不能直接标记 lossless。未支持语法、未知宏、本机包和自定义 Typst 函数必须显式保留原始表示。当前失败时原文通常保留，保存 MathForge 草稿也可保存无效源，这是应保留的优点。

**Undo / history 所有权**：`RevisionHistory` 已是主撤销所有者，捕获源码、模式、视觉选区、源码范围/滚动和排版选项；CommandRegistry 路由菜单/快捷键。textarea/native 编辑仍有内部撤销栈；MathLive 私有 `_mathfield` undo/canUndo 被适配到应用历史，且用 stopCoalescingUndo 建边界。不能删掉已有有效适配，应通过公开 adapter 包装并锁定 MathLive 版本。辅助设置输入仍用系统本地撤销，不纳入公式内容。

模式切换的 snapshot signature 包含 editorMode，所以会产生撤销步骤；这可用于恢复导航，但不应等同数学版本。`FormulaHistory` 以去空白/left/right 的 LaTeX 字符串去重，不是语义 identity，可能忽略表示变化；100 条/4MB 上限与 localStorage 不等于可靠长期 journal。

**Already good**：显式命令、选区 wrapper、失败保护、末次有效预览、异步 renderID 防过期结果、模式与主工作区 frame 回归。**Needs correction**：复制/导出只读，模式切换不生成伪内容版本，各表面 cursor/scroll 独立恢复。**Architecture risk**：无稳定 identity/source-of-truth，字符串推断等价，私有 MathLive API，localStorage 与 native state 分裂且写失败反馈不足。

**Recommended Direction：最小 representation contract（设计，未实现）**

- `FormulaDocument {schemaVersion,id,revision,activeRepresentation,representations,metadata}`；UI editorMode 单独作为 presentation/context，不承担内容身份。
- 每个 representation 保存 `source,language,revision,origin,derivedFrom,status,diagnostics`。视觉结构通过现有 MathLive adapter 保存必要 serialization，不强迫所有 TeX/Typst 进入不完备 AST。
- 权威是最近一次用户提交的活动表示 revision；其他表示是带来源版本的派生缓存，不能反向覆盖权威原文。
- status 语义：exact=原表示字节一致；lossless=在明确支持子集且经验证的保真转换；partial=已知结构/排版丢失，需明确接受；unsupported=不生成可编辑替代；stale=derivedFrom 与当前 revision 不一致。未知保真不得标 lossless。保留 original + converted + diagnostics，不重复维护无归属的三套字符串。
- `applyEdit` 才推进内容 revision；模式切换保存表面上下文但不推进内容版本；export/copy/preview 为只读。一个应用 revision journal 负责 Undo/Redo，MathLive/textarea 作为输入 adapter；明确区分内容撤销、表面导航和辅助输入本地撤销。
- 先迁移旧 state/MathForge 文件，保留旧字段读取兼容与恢复备份；不一次性改写模板、渲染和本机编译器。跨语言 cursor 暂只保守定位，不伪装成可靠 source-map。

### 2.2 本地高质量 OCR

**Implemented**：`FormulaOCR.swift` 的基础/专业独立环境、共享 `MathForge/OCR` 根目录、模型初始化后 readiness marker、暂存环境替换/失败回退、取消任务；`formula-ocr-runner.py` 的 MFD 区域检测、排序、crop、Pix2Text/UniMERNet 推理。已有真实样例识别和安全安装测试。

**Partial**：实际可识别，不等于质量已经量化；无代表性 benchmark。installed 检查主要是 Python 可执行、版本与 ready marker，不是启动时全面模型哈希完整性验证。模型分散于 OCR 根和库缓存，尚无统一版本/checksum 清单。专业模块是否改善准确率未有数据支持。

V1.6.0 有单式/整页偏好与结果勾选；本地后续版已改始终 page、默认第一条激活、互斥切换。已真实识别两条并切换；切换不重跑 OCR。原始 `pageFormulas` 留在内存，缩略图/文件名也属临时状态；`insertLatex` 写入单公式编辑器，但编辑后的内容没有回写该 result record。离开/重开面板会清空集合。因此原图关联和 correction trace 为 partial，持久校订缺失。

**Missing / architecture risk**：输入指纹、原图持久引用、模型版本、识别原文与编辑稿关联、reviewStatus、人工修改次数、置信度校准及质量门禁。UI selected 仅代表当前激活，绝不能当“用户已确认正确”。

**Recommended Direction**：先建立 `tests/ocr_benchmark/` 数据契约与合法样本计划（本轮提供设计框架，未生成数据集/未跑准确率）；再接 FormulaRecord 持久 provenance。优先减少修正成本，暂不加模型。

### 2.3 Batch Formula Workspace

**Implemented**：`FormulaDocument.swift` 用 PDFKit 渲染页面，按页运行 OCR；默认最多20页，100MB/1000结果限制、加密/超范围/取消处理。DOCX 经 `formula-document-runner.py` + Pandoc sandbox 提取原生公式与嵌入图片，保留文档顺序/段落提示，限制 zip 展开量，跳过外链。不处理旧 doc 全版式。

**Partial**：是提取器与单公式候选列表，不是批量工作台。DOCX 原生公式是 Pandoc 输出 LaTeX，未保存原 OMML；PDF 临时 page.png 每页覆盖，结束清理临时目录，无法长期恢复对应 crop。bbox 是像素坐标但没有持久页尺寸/缩放映射；来源目前是展示字符串。异常路径返回 error/log 而非逐条可恢复结果，先前已提取内容可能无法交付。现有批量导出只是每行公式逐次保存，不是一个任务目录与 manifest。

**Missing / architecture risk**：FormulaRecord、审阅状态、逐条校订保存、断点续审、批量规范 preview/apply/undo、批量导出结果清单。1000条上限不证明 1000条工作流成熟；20页限制不应被当商业吞吐能力。

**Recommended Direction（独立工作区）**：复用单公式编辑器 adapter，增加持久 `BatchWorkspace {id,schemaVersion,documentAssets,recordIds,jobCheckpoint,ruleProfile}`。`FormulaRecord {id,documentId,location(page1Based/paragraph),region(coordinateSpace/pageSize),assetRef,originalOCR,formulaDocumentRef,reviewStatus,normalizeStatus,exportStatus,errors}`；OCR原文不可变，最终编辑内容只由 FormulaDocument 负责，不另建冲突字符串。

reviewStatus 为 unreviewed/confirmed/needsChanges/failed，与 activeResultId 分离。上/下一条、确认、标记修改提供可发现快捷键，避免系统快捷键冲突。按记录保存，坏页保留成功结果并显示失败项。批量字体/字号/颜色/留白/微分/算子/单位/向量/矩阵括号/格式使用规则 profile：先预览差异，再 apply，一笔可撤销事务。

导出 `formula_001...` 加版本化 manifest.json，记录来源、页/段落、原始OCR、最终文档版本、文件及哈希、状态、错误；用临时文件+原子提交，重新打开不依赖原机器临时路径。先验收100条，再扩展至500条；不把复杂 UI 塞回单公式主界面。

### 2.4 Office 真实无缝工作流

**Implemented**：`web/app.js:exportFile/copy` + `Formula.swift:copy/copyImage` 写入真实 pasteboard；有 Option 拖出文件及 SVG/PDF 中公式 metadata。**Partial**：图形与源码传递基础存在，完整多表示/可编辑回传缺失。

| 路径 | macOS 实际类型 | 备注 |
|---|---|---|
| 源码/MathML/MathForge 文本复制 | NSPasteboard `.string`（public.utf8-plain-text） | MathML 是 XML 文本，并未声明专用 MathML type；不等于 Office 原生公式 |
| 图形复制 | public.svg-image / com.adobe.pdf / public.png / public.jpeg / public.tiff / com.adobe.encapsulated-postscript | Swift 接收相应 payload 才写，非每次全部写 |
| 非 PNG 图形复制 | 所选格式 + public.png fallback | 当前探针观测 SVG + PNG |
| 内部信息 | org.mathforge.equation | 写入恢复 state；粘贴读取 handler 未消费该 UTI，不能宣称双向 round-trip |
| OMML、RTF/HTML math、原生 Office 对象 | missing | 未找到专用序列化或粘贴适配器 |

一次复制的推荐设计是独立 payload builder 生成 internal、LaTeX/plain、MathML、SVG、PDF、PNG，按平台合法类型一次写入；文本/图形焦点复制语义仍分开。不得将不同内容拼成冲突的 representation，也不能假设 Office 自动选择自定义类型。大表示惰性生成/缓存须绑定 document revision。

**真实验证边界**：本轮探针只捕获桥接 payload，没有向 Office 写入文档；机器标准路径/Spotlight 未发现 Word、PowerPoint、Pages、Keynote，WPS 12.1.29166 可见，既有审计因 WPS 自动化不可观察未完成粘贴验收。因此五款软件的可编辑/矢量/打印/保存再开均不能写 pass。矩阵见 `docs/OFFICE_COMPATIBILITY.md`，未知不是失败，也不是通过。

Microsoft 官方说明文档数学使用 OMML，并支持 MathML/LaTeX；Apple 官方说明 Pages/Keynote 的公式对话框支持 LaTeX/MathML。这些是研究入口，**不证明 macOS clipboard 接受相同数据类型**：[Microsoft Math](https://learn.microsoft.com/en-us/office/math/)、[Apple equation support](https://support.apple.com/en-gb/102138)、[Keynote equation dialog](https://support.apple.com/en-au/guide/keynote/tan72a69d01f/mac)。

**Recommended Direction**：以真实应用版本为单位验证图形路径和原生可编辑路径。Word/PowerPoint 分别研究 MathML→OMML 及受支持导入路径，必要时 document add-in/文件插入 adapter，不能把 OMML XML 普通文本粘贴当完成。Pages/Keynote 原生公式对话框路线与图形粘贴分开；WPS独立验证。在保存、重开、编辑、打印通过前，不暴露“复制到 Word”等保证性动作。

### 2.5 Formula Inspector

**Current**：只有转换/编译错误与粗粒度 capability/syntax 分类、补全括号提示、生成源码格式化。**Implemented**：这些基础诊断与 formatter。**Missing**：独立 rule engine、位置映射、诊断集合、规则配置、修复事务；formatter 不是 Inspector。

**Architecture risk**：字符串正则无法可靠区分变量与微分、单位、算子；LaTeX/Typst 坐标与视觉 atom 未建立映射；直接重写可能改变数学语义。

**Recommended Direction**：先对支持的语法子集 token/context 检查，不搭 AI 黑箱。诊断结构 `{ruleId,documentId,revision,representation,range,severity,message,reason,suggestion,safeFix}`。编译错误先抽取 file/line/column，无法定位则标未知，不虚构位置。修复绑定 revision，过期拒绝，preview→apply→Undo。

阶段一：明确积分/微分上下文中的正体d；明确普通字母串的 sin/cos/tan/ln/log/exp；明确数值后SI单位的正体/间距/组合；括号、环境、空slot、编译错误。遇到变量/单位语义不明只提示。阶段二：虚数i、Euler e、向量/张量、下标、常量、跨式一致性用学科 profile，默认仅建议。UI 为轻量问题列表/侧面检查区，点击定位与解释，先不扩张主工具栏。

## 3. P0 / P1 / P2

| 优先级 | 工作 | 理由 |
|---|---|---|
| P0 | 表示原文保留、只读复制/导出、稳定 documentId/revision、可靠恢复 | 防止科研内容无提示被派生表示覆盖 |
| P0 | Office 所承诺目标的真实可编辑/保存再开验收 | 商业卖点不能靠格式按钮证明 |
| P0 | Developer ID、Hardened Runtime、公证/staple、可信升级与数据保留 | 商业安装可信度与升级安全；当前 ad-hoc 不达标 |
| P1 | OCR benchmark、模型版本/完整性清单、校订来源追踪 | 衡量真实质量与维护成本 |
| P1 | Batch 持久记录、逐条错误、100条审阅与断点恢复 | 从提取器升级为可用批量工作台 |
| P1 | Inspector 可解释基础规则与误报测试 | 规范能力建立在内容契约之上 |
| P2 | 编号/引用、深度文档回写、跨式高级规则、500条性能优化 | 依赖前述模型与验证 |
| P2 / 单独门禁 | Windows 商业化 | Mac优先是建议，须产品确认；不得宣称当前两端同等能力 |

### macOS / Windows 交付审计

macOS build-dmg/install-local 使用 `codesign --sign -`；实际本机签名显示 adhoc、TeamIdentifier未设置，未启用商业 Hardened Runtime 流程，未找到 notarytool/stapler。发布 DMG 采用校验值/映像检查，但它们不替代公证与 Gatekeeper 清洁机器验收。未找到应用内更新检查/签名更新验证。state.json 原子自动保存是 partial crash recovery，缺少恢复 journal、损坏恢复、磁盘满/写失败可见反馈。备份替换及共享模型兼容已有；干净安装、不同架构/不同用户、升级/回滚矩阵未完整验收。另需完成商业分发许可清单：OCR代码/权重、数学字体、补全数据及按需Word/Pandoc组件分别审核，技术开源不自动等于所有素材已获商业分发授权；仓库未发现根LICENSE，需明确项目许可与贡献归属政策。未提供明确卸载数据工具/保留策略；删 app 不等于删用户数据，不能自动删共享模型。

Windows 是 Electron portable x64，`windows/package.json` 仍1.5.1，而 Mac发布1.6.0；本轮远程v1.6.0资产仅Mac DMG及校验。Windows workflow按Windows包版本发资产，存在标识错配风险；需统一release manifest并审核旧版本资产覆盖策略。没有本地OCR/document bridge、registerCommands/nativeEdit等新动作处理，不能以共享web说明功能一致；Typst仍强制包装 `$...$`，Mac已支持文档前置指令，两端明显不同。无正式安装器、签名、应用更新和真实Office矩阵；contextIsolation:false/sandbox:false需审阅IPC与最小权限边界。上述为代码审计，未在Windows系统运行。

## 4. Recommended Implementation Order

签名/交付 P0 作为并行发布门禁，不依赖把五大功能全做完。以下各Phase独立评审，未经确认不实施整阶段。

| Phase | 最小交付 | 验收门禁 |
|---|---|---|
| 1：FormulaDocument / representation / revision | 在现有state外增兼容契约；只读输出；原表示保留；显式转换状态；Undo adapter | 六向切换矩阵含注释/宏/partial/unsupported；复制/保存/导出不改文档；身份稳定；原文可恢复；选区/焦点/scroll/Undo连续；坏数据/磁盘满/崩溃恢复 |
| 2：Office interoperability | payload builder + 每款软件可验证路径，先Mac两款主目标，再覆盖其余 | 记录版本/types；图形/原生编辑分开；粘贴、修改、打印、保存、重开；内部round-trip；失败fallback；无未经验证的UI承诺 |
| 3：OCR benchmark | 合法自建语料、模型/运行manifest、人工校订会话 | exact/normalized/compile/render分开；人工修正次数及耗时；代表性与低质子集；无伪造分数；确认基本模块与专业模块收益 |
| 4：Batch Workspace | 来源资产、记录、审阅、局部错误、checkpoint、批量事务、manifest | 100条端到端 Import→Review→Correct→Normalize→Export；坏页仍保留成功项；断电/重开继续；应用/撤销；重复导出可追踪 |
| 5：Inspector | 基础可解释规则、小型问题列表、revision-safe fix | 正例/反例/误报；语义不明不自动改；LaTeX/Typst各有规则范围；修复可撤销且渲染不退化 |
| 6：编号/引用/文档集成 | workspace级编号策略和引用adapter | 插删/移动重编号；label冲突；LaTeX/Typst/Word引用各自验证；保存重开仍指向正确formulaId |

推荐先做Phase1，因为Office payload、OCR校订、Batch记录和Inspector定位都需要一个稳定公式revision。不能把建立完整通用数学AST作为Phase1前置：保留原表示、明确转换边界是更小可行改造。Phase3可先收集合法样本，但不打断Phase1/2主线。

### 编号与引用（仅设计）

当前 state 保存 whitelist 不包含 formulaId/number/label/reference/chapter；即便JSON可放任意字段，恢复函数也不会保证这些字段完整。因此不具备可靠编号模型。建议 metadata保存用户label/来源/学科；编号策略由workspace拥有（none/sequential/chapter），显示number为推导结果而非复制到每个源码里。引用指向稳定formulaId；LaTeX label/ref、Typst label/reference、Word cross-reference分别由adapter管理，禁止把字符串替换当引用系统。

## 5. Files / Modules Affected

本轮产品代码只改 `web/ocr.js` 隐藏分类。以下是未来影响范围，不是已实现清单：

- `web/app.js`：逐步拆出 document/revision/render/export协调，保留命令入口。
- `web/typesetting.mjs`、`source-conversion.mjs`：迁移、表示来源版本、conversion diagnostics；增加 `formula-document.mjs`、representation adapter。
- `web/commands.mjs`、`editor-transforms.mjs`、`formula-history.mjs`：统一journal所有权、public adapter、稳定identity与内容版本。
- `web/ocr.js`：result激活与持久校订分离；`batch-workspace.mjs`/`formula-record.mjs`作为独立模块，不把列表再塞入app.js。
- `web/output-formats.mjs`/新增 clipboard payload builder：只读多表示输出，绑定revision。
- `macos/Formula.swift`：pasteboard读写、持久存储错误、更新/恢复、原生Office adapter边界。
- `macos/FormulaOCR.swift`、`formula-ocr-runner.py`：模型manifest、质量采样、provenance，保留共享路径及已有安装事务。
- `macos/FormulaDocument.swift`、`formula-document-runner.py`：持久页/段落/crop来源、部分失败及checkpoint；原OMML来源保存策略。
- `scripts/build-dmg.sh`、`install-local.sh`、release workflows：证书/公证/升级/clean-install矩阵；`windows/main.cjs/preload.cjs/package.json`独立平台补齐。
- `tests/`：representation/undo/continuity/unsupported矩阵；`ocr_benchmark/`；batch100/resume；Office真实应用矩阵；Inspector正反例/修复回归。
- `docs/OFFICE_COMPATIBILITY.md`、本路线图、模型/representation schema、交付验收记录。

## 6. Do Not Rewrite List

1. 不重写 MathLive 与已修复的 selection-aware transformation helper；先用adapter稳定边界。
2. 不重写离线 MathJax 字体、模板目录和已通过的图形导出器；修调用所有权而非重新实现渲染器。
3. 不推翻生成源码formatter、原生textarea补全/着色层；区分生成格式与用户手写原文。
4. 不重写本机LaTeX/Typst检测/路径配置/错误反馈；统一resolver即可。
5. 不重写OCR模型安装事务、共享目录和取消机制，不因商业化重下载有效模型。
6. 不重写PDFKit/Pandoc提取；围绕已有输出补来源、持久记录与恢复。
7. 保留单公式界面空间稳定与命令菜单；Batch和Inspector独立渐进加入。
8. 不将测试通过包装成数学语义证明、OCR准确率或Office兼容结论。

## 本轮执行与限制

已读取实际代码、发布标签和本地差异，复核签名/发布资产、补编辑器探针，形成路线图/Office未知矩阵/benchmark设计。执行 typesetting、revision-history、source-conversion、output-actions 及去分类标签的 finish-ux 测试；结果在本轮交付中如实报告。未运行OCR benchmark、100条Batch、完整Office实际粘贴或Windows；未实现FormulaDocument/Inspector/批量工作区。本轮不推送、不发布新版本。探针暴露的表示覆盖风险暂保留为Phase1明确修复项，未擅自开展架构重构。
