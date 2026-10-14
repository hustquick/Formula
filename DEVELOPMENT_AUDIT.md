# DEVELOPMENT_AUDIT — Formula 阶段性产品审计

日期：2026-10-14（Asia/Shanghai）。对象：`feature/clipboard-ocr` 工作区，Git HEAD `ec3776ac3c9bed44fb8ea2aa1266843fd156ce3f` **加未提交改动**。正式发布基线 1.5.1。

本轮仅审计：读取规范、检查代码、构建、运行自动测试、全量模板转换/本机编译、现有模型离线推理、连接本机应用；新增审计证据与本报告。**未修改产品实现，未安装覆盖应用，未推送 GitHub。** 旧审计保存在 `docs/audit/2026-10-14/previous-audit.md`，其旧结论不能替代本轮结果。

## A. Executive Summary

**整体成熟度：Early Beta。** 常用公式输入、渲染、模板、选区结构操作与输出已有实测基础；当前工作区新增命令/历史能力尚不能认为完整交付。重点阻碍是：两套Undo状态分歧、普通文本框复制被全局命令截获、语言与renderer耦合、双语言转换覆盖不足，以及原生端验收与源码版本不一致。

不提供“完成百分比”：不同项目权重不同，且本轮完整Mac工作流未通过（补充真实验证见L节）。下面以40个可核查条目给出**一个主状态**；其他问题在详情交叉说明，避免数量重复。

### 审计证据边界

- **当前源码**：构建后的工作区Chromium运行；不是已安装Mac应用。
- **已安装应用**：`/Applications/Formula.app`，ID `org.mathforge.desktop`，进程38177；AX可读旧公式与旧文件/编辑菜单。初次后续操作不可用；用户回复已解锁后，已完成补充原生验证，详见末尾L节。测试前备份原状态，测试后通过原生导入恢复原公式、排版和输出选项，未强退或覆盖安装。
- 两份app.bundle.js SHA256不同：工作区 `21aa794200e41e173abbcbaf4f80275178506c005ae4386ff534d7e40be6c070`；已安装 `cc6de3797c70d57777c49a96eee719f9cac460a519008298a5cb33f48717d7fa`。因此新版Registry/History/native菜单不能用旧应用验收。
- **构建**：npm离线资源打包成功；合并当前Swift三文件，`xcrun swiftc -swift-version 5 -framework Cocoa -framework WebKit -framework PDFKit` 实际生成 `/tmp/formula-audit-20261014/Formula`，成功。未生成正式签名/公证发布包；未做干净资源全量安装。
- **自动测试**：30个JS测试脚本，29通过、1失败；另Python OCR单元2项通过。首次3项环境失败在补充本地server/依赖路径后重测，其中custom-toolbar/compact-layout通过，reference-layout仍等待已删除`#input-color`超时。**没有把失败测试改成通过。**
- **真实引擎运行**：126模板MathJax渲染成功；100模板转换后本机Typst实际编译成功；现有Pix2Text单式/整页、UniMERNet单式离线推理成功。不是准确率/语义等价证明。
- **原生交付**：本轮未安装，运行中的是已有版；解锁后OCR、双源、两种本机排版和保存再开实测通过，编辑操作失配；完整19步Mac工作流未通过，见H及L节。Word/WPS/Pages未实测。

### 状态计数

| 主状态 | 数量 |
|---|---:|
| COMPLETE | 8 |
| PARTIAL | 21 |
| MISSING | 1 |
| BROKEN | 3 |
| ARCHITECTURE RISK | 4 |
| TEST COVERAGE MISSING | 3 |

## B. Feature Audit Table

| ID | Feature | Status | Evidence | Problems | Severity | Recommended Action |
|---|---|---|---|---|---|---|
| A01 | 任务驱动工作流 | PARTIAL | `web/index.html；web/app.js:539–606`；commands、output-actions、ocr-behavior 通过 | 低频工具仍有重叠入口；不能以入口齐全代表任务闭环 | P1 | 先修上下文和编辑连续性，再做任务效率对比 |
| A02 | 焦点感知与标准复制 | BROKEN | `web/app.js:556；web/commands.mjs:7`；context-copy.json：命令搜索框选中 hat 后 ⌘C 发出 copyImage/svg | 全局捕获快捷键可覆盖用户复制意图，写错剪贴板 | P0 | 普通文本输入交回原生编辑链；补全部焦点矩阵测试 |
| A03 | 布局与编辑上下文稳定 | PARTIAL | `web/v1.1.css:232–250；web/app.js:413、591`；panels.json：760/1180 宽全部六标签+History+Palette frame 不变；probes.json 另测820/1440 | 标签点击后焦点在按钮，未恢复编辑器；滚动探针内容不够长，不能证明滚动保留 | P1 | 补长源码、设置和原生 UI 的 frame/焦点/滚动断言 |
| A04 | 多公式及长公式完整可见 | COMPLETE | `web/v1.1.css:244–245`；probes.json：1/10/50 行；50行 scrollHeight5214、首端top1、末端bottom−0.75；长公式横向6863px两端可达 | 不代表所有 renderer 或遮罩组合已验证 | P2 | 把本次1/10/50与横向边界探针转为正式CI断言 |
| A05 | 基础源码编辑与导航 | PARTIAL | `web/index.html #source；web/source-assist.mjs`；source-mode、source-assist、source-candidates 通过 | textarea与全局命令层可能争夺快捷键 | P1 | 保留原生基础语义并增加真实键盘导航测试 |
| A06 | 语法高亮与括号匹配标记 | MISSING | `web/index.html #source 为 textarea；web/source-assist.mjs`；实际源码组件无高亮层/匹配括号标记；测试也未提供该能力 | 不能称为已对标专业源码编辑器 | P2 | 先明确轻量高亮方案和不影响选区的验收条件 |
| A07 | LaTeX / Typst 补全 | PARTIAL | `web/source-assist.mjs:41–90；web/completion-data`；source-assist、source-candidates 通过 | Typst词表有限；LaTeX借用词库不等于插件完整功能 | P1 | 按上下文补参数结构，保持ghost不写原文 |
| A08 | 自动闭合与跳出括号 | PARTIAL | `web/source-assist.mjs:45–49、86–88`；source-assist 通过：ghost接受和已有闭合符跳出 | 与成熟编辑器的自动闭合仍有差距 | P2 | 补成对编辑语义与撤销测试 |
| A09 | 手写缩进与自动格式策略 | PARTIAL | `web/source-assist.mjs:71–79；web/app.js:269`；source-mode、visual-format、generated-source 通过 | 用户手写复杂结构仍需手动整理 | P2 | 增加显式缩进命令，避免实时重排 |
| A10 | 查找与替换 | PARTIAL | `web/app.js:598–604`；command-shortcuts 通过 CmdF/G/ShiftG | 查找输入框受全局复制/撤销上下文缺陷影响 | P1 | 修焦点后补最小替换流程 |
| A11 | 自动生成源码格式规范 | COMPLETE | `web/format-latex.mjs；scripts/sync-latexlive-catalog.mjs；docs/GENERATED_SOURCE_STANDARD.md`；generated-source、visual-format、template-generated-source、ocr-format 通过；126模板MathJax实际渲染+幂等 | 复杂自定义宏仍保守处理；不可把幂等当作数学语义证明 | P2 | 加入更多宏/注释/Typst文档保真样本 |
| A12 | 选区感知结构变换 | COMPLETE | `web/editor-transforms.mjs；web/app.js:563–574；web/latexlive-exact.js:56`；selection-transforms：33种实际菜单点击、operand/source/preview、MathLive undo/redo、无选区placeholder通过 | 私有MathLive undo边界API风险归A25；本项仅确认结构语义回归已通过浏览器运行 | P1 | 将同类source/Typst/无选区光标行为加入矩阵 |
| A13 | Visual / Source 双向同步 | PARTIAL | `web/app.js:124–147、269–288、526–532`；source-mode、visual-format、commands、selection-transforms通过 | readSource调用mf.setValue；两套历史可分歧 | P0 | 先统一历史所有权，补跨模式连续操作测试 |
| A14 | 双语言复杂公式支持 | PARTIAL | `web/app.js:65、133、140–147；tex2typst0.6.2`；compatibility.json：126模板，100正向转换并本机编译，81反向解析成功 | 不支持的宏与转换器边界使双语言体验不一致 | P1 | 优先覆盖现有模板的可等价语法 |
| A15 | 源码语言与renderer解耦 | BROKEN | `web/app.js:140–141、514`；代码明确禁止本机LaTeX+Typst源码/本机Typst+LaTeX源码；引擎切换改state.mode | 切引擎会改变源码语言；误导用户并触发有损转换 | P1 | 保留原始sourceLanguage，通过独立转换适配renderer |
| A16 | 统一内容与双源码模型 | ARCHITECTURE RISK | `web/app.js:22、65、133、147、232`；兼容探针证明100种可编译但其中19反向失败；数据只存rawSource+latex+mode | 并非简单字符串替换库，但应用层仍依赖字符串双转，不能承诺无损 | P1 | 先明确representation与转换结果契约，不直接重写整个AST |
| A17 | 模板库双语言完整性 | PARTIAL | `web/vendor/latexlive/catalog.js（生成产物）；scripts/sync-latexlive-catalog.mjs`；compatibility.json遍历十类126模板：原生双源0、仅LaTeX126 | UI能力被renderer规则额外限制；详见I节 | P1 | 补原生Typst与转换能力标记，先解决高频模板 |
| A18 | 离线OCR识别链路 | PARTIAL | `macos/formula-ocr-runner.py；FormulaOCR.swift；web/ocr.js`；复用现有模型离线Pix2Text单式/整页2式、UniMERNet单式成功；ocr-chain.json双引擎结果导入→格式→Typst→内置渲染通过 | 成功运行不等于识别数学正确；UniMERNet样例额外生成样式/空格 | P1 | 建立含复杂结构的标注语料，测正确率与失败恢复 |
| A19 | 剪贴板图片 / 图片导入 | PARTIAL | `web/ocr.js:320–341；macos/FormulaOCR.swift handleOCRRecognize`；clipboard-ocr、ocr-behavior通过（桥接模拟）；本机runner真实推理通过 | 桥接模拟不能证明原生剪贴板稳定 | P1 | 解锁后实测图片/文本混合粘贴及撤销 |
| A20 | PDF / DOCX 提取 | PARTIAL | `macos/FormulaDocument.swift；formula-document-runner.py；web/ocr.js`；document-behavior通过；本轮未重跑真实PDF/DOCX集成 | 不可将既有功能当尚未实现，也不能宣称本轮验证通过 | P2 | 复用已安装环境重跑document-integration，禁止重新下载模型 |
| A21 | 快捷工具 / 模板 / 二级面板 | PARTIAL | `web/latexlive-exact.js；latexlive-menus.js`；126模板渲染、selection-transforms33项、shortcut-previews通过 | 渲染通过不等于插入和转换都正确 | P1 | 自动生成完整按钮能力矩阵 |
| A22 | 自定义工具栏 | COMPLETE | `web/app.js:296–410；web/v1.1.css工具区`；custom-toolbar重测通过：真实drag增删排序、持久化、模式、恢复默认；panels frame稳定 | 全局菜单/快捷键风险不由此项保证 | P2 | 保留当前回归并补最小宽度溢出断言 |
| A23 | Copy / Export 格式及分工 | PARTIAL | `web/app.js:165–228；macos/Formula.swift:136–140`；output-actions通过8种内置格式：复制payload/导出文件名；native-preview-size通过 | 不保证Word/WPS/Pages效果；单representation缺fallback | P1 | 区分复制图形与复制源码能力；增加多representation |
| A24 | Word / WPS / Pages 实际兼容 | TEST COVERAGE MISSING | `macos/Formula.swift:138–140`；本轮未逐应用粘贴；仅有桥接payload验证 | 不能宣称原生可编辑公式粘贴兼容；无OMML专用写入证据 | P1 | 逐应用实测并记录版本/粘贴类型/清晰度/编辑性 |
| A25 | Undo / Redo 统一所有权 | ARCHITECTURE RISK | `web/commands.mjs RevisionHistory；web/editor-transforms.mjs；MathLive内部executeCommand`；undo-divergence.json：registry hat后MathLive undo到x，revision.index仍2且canRedo=false，registry redo无效 | 当前可复现历史分歧；不能称统一撤销已完成 | P0 | 统一所有入口与事务边界，补混合入口跨模式回归 |
| A26 | 可查看的自动编辑History | PARTIAL | `web/commands.mjs RevisionHistory；web/app.js:591–617`；revision-history、commands通过：恢复、分支、100条/4MB限制 | schedule.flush丢具体标题；本机安装版尚无新History UI | P1 | 先与Undo统一，再完善持久化与清理 |
| A27 | History快照覆盖排版设置 | BROKEN | `web/commands.mjs signature；web/app.js captureRevision`；probes.json signature=true：透明true/false判作同一revision | 透明/分辨率/字体等更改不可靠地进入可撤销历史 | P1 | 集中声明文档状态字段并测试每项变化的Undo |
| A28 | 键盘快捷键体系 | PARTIAL | `web/app.js:537–620；web/commands.mjs:7`；command-shortcuts、commands通过：无重复键、N/O/S/1/2/3/F/G/K/L/E等 | 已安装应用仍旧⌘E导出/⇧⌘C源码，不是当前源码新键位 | P1 | 修上下文后统一原生菜单及网页事件优先级 |
| A29 | macOS 菜单栏 Commands | TEST COVERAGE MISSING | `macos/Formula.swift:86–129`；Swift真实编译成功；本机AX只见旧文件/编辑菜单，新菜单尚未安装 | 代码存在不能当COMPLETE；已安装版本与源码不同 | P1 | 通过审计后安装当前候选，完整原生菜单工作流验证 |
| A30 | Command Palette / 上下文菜单 | PARTIAL | `web/app.js:587–606`；commands、command-shortcuts通过；panels浮层frame不变 | 搜索框标准复制存在已复现回归 | P1 | 先修编辑上下文，再收敛上下文相关命令 |
| A31 | Command Registry 统一程度 | ARCHITECTURE RISK | `web/commands.mjs；web/app.js:539–621、514、remember/restore`；commands测试核心统一入口通过；静态仍见直接engine/settings/favorites修改 | 动态命令与独立事件并存，错误enabled和历史遗漏易反复 | P1 | 列所有mutation入口，统一状态/事务约定，避免大重写 |
| A32 | 自动测试体系与CI | PARTIAL | `.github/workflows；tests/*.cjs；docs/audit/2026-10-14/test-summary.json`；本轮30个JS脚本29通过1失败；Python OCR单元2项通过 | 绿色旧CI不能证明本轮新架构；旧测试等待已删除#input-color超时 | P1 | 整理统一测试入口，新增高风险测试接CI并修旧断言 |
| A33 | 真实Mac完整工作流 | TEST COVERAGE MISSING | `/Applications/Formula.app；本轮CUA记录`；连接运行中应用成功、读到公式与旧菜单；后续操作无响应且截图不可用，已请求解锁 | 不得把headless或已有进程当新版本真实验收通过 | P1 | 解锁后按19步清单实测，保留用户原公式/设置 |
| A34 | 用户资产与共享模型 | PARTIAL | `macos/Formula.swift:16–17、134；FormulaOCR.swift:9；runner:25、50`；现有OCR环境离线推理成功，无安装/下载；本轮未删除任何用户资产 | 不能称所有模型都在统一Models目录；marker/依赖检查不是权重完整性校验 | P1 | 明确共享资源清单与只读完整性检查，避免移动venv |
| A35 | 本机安装与构建可重复性 | ARCHITECTURE RISK | `scripts/install-local.sh`；npm build:vendor成功；当前Swift真实编译成功；应用bundle hash与工作区不同 | 不能称干净通用构建；资源更新可能漏复制，安装不能等同代码构建 | P1 | 先补产物清单/回滚，再安装经验证候选 |
| A36 | 错误输入与Last Valid Preview | COMPLETE | `web/app.js:68–75、85–123`；last-valid-preview通过：保留上一有效图像，禁止导出陈旧结果 | 本项结论限已测失效/恢复场景 | P2 | 维持陈旧结果不可导出的回归约束 |
| A37 | 输出字体与无闪烁切换 | COMPLETE | `web/app.js MathJax字体加载/渲染；web/v1.1.css`；math-fonts、font-controls、font-native-reload通过 | 浏览器测试不代替用户对所有Mac显示器的闪烁感受 | P3 | 补原生视觉冒烟，不扩大字体UI |
| A38 | 独立编辑缩放与输出字号 | COMPLETE | `web/app.js editor-size/output-size；Formula.swift render`；editor-zoom、native-preview-size通过 | 保留各自状态，不重新合并缩放 | P3 | 保持回归测试 |
| A39 | 收藏公式图形展示 | COMPLETE | `web/app.js:206–210；web/v1.1.css:223–224`；compact-layout与custom-toolbar/现有渲染路径通过；代码渲染SVG到收藏card | 本项只确认图形展示基础路径，不将其当自动History | P2 | 补复杂宏fallback与收藏搜索 |
| A40 | 保存、重新打开与文档生命周期 | PARTIAL | `web/app.js:234–240、541–542、originalImport；Formula.swift save/importFile`；output-actions验证MathForge导出名与payload；commands open/save桥接通过 | 缺持续文档身份与异常恢复证据 | P1 | 定义最小文档生命周期，验证保存→关闭→重开一致性 |

### 逐项证据、已实现及缺口

#### A01 任务驱动工作流

- 当前状态：**PARTIAL**。
- 代码证据：`web/index.html；web/app.js:539–606`。
- 运行证据：commands、output-actions、ocr-behavior 通过。
- 已实现：输入、编辑、预览、复制、导出、收藏入口完整；新增历史/命令面板。
- 未实现/未验证：缺少统一文档生命周期和可靠焦点上下文。
- Bug或风险：低频工具仍有重叠入口；不能以入口齐全代表任务闭环。
- 严重性：P1。
- 下一步：先修上下文和编辑连续性，再做任务效率对比。

#### A02 焦点感知与标准复制

- 当前状态：**BROKEN**。
- 代码证据：`web/app.js:556；web/commands.mjs:7`。
- 运行证据：context-copy.json：命令搜索框选中 hat 后 ⌘C 发出 copyImage/svg。
- 已实现：源码选区复制、MathLive 选区复制、结果复制已分支。
- 未实现/未验证：未覆盖命令搜索、查找、设置等普通文本框。
- Bug或风险：全局捕获快捷键可覆盖用户复制意图，写错剪贴板。
- 严重性：P0。
- 下一步：普通文本输入交回原生编辑链；补全部焦点矩阵测试。

#### A03 布局与编辑上下文稳定

- 当前状态：**PARTIAL**。
- 代码证据：`web/v1.1.css:232–250；web/app.js:413、591`。
- 运行证据：panels.json：760/1180 宽全部六标签+History+Palette frame 不变；probes.json 另测820/1440。
- 已实现：固定工具区、浮层、核心区域稳定；源码 selection [1,3] 保留。
- 未实现/未验证：原生 WKWebView、设置、所有长内容滚动与焦点恢复未全覆盖。
- Bug或风险：标签点击后焦点在按钮，未恢复编辑器；滚动探针内容不够长，不能证明滚动保留。
- 严重性：P1。
- 下一步：补长源码、设置和原生 UI 的 frame/焦点/滚动断言。

#### A04 多公式及长公式完整可见

- 当前状态：**COMPLETE**。
- 代码证据：`web/v1.1.css:244–245`。
- 运行证据：probes.json：1/10/50 行；50行 scrollHeight5214、首端top1、末端bottom−0.75；长公式横向6863px两端可达。
- 已实现：内置预览短公式居中，超长内容从边缘可滚动，frame稳定。
- 未实现/未验证：本项结论限内置SVG；本机图片预览的50行仍待人工验证。
- Bug或风险：不代表所有 renderer 或遮罩组合已验证。
- 严重性：P2。
- 下一步：把本次1/10/50与横向边界探针转为正式CI断言。

#### A05 基础源码编辑与导航

- 当前状态：**PARTIAL**。
- 代码证据：`web/index.html #source；web/source-assist.mjs`。
- 运行证据：source-mode、source-assist、source-candidates 通过。
- 已实现：原生 textarea 的选区、删除、换行和光标；辅助候选与ghost。
- 未实现/未验证：词级导航、长命令、中文IME和原生macOS全矩阵未实测。
- Bug或风险：textarea与全局命令层可能争夺快捷键。
- 严重性：P1。
- 下一步：保留原生基础语义并增加真实键盘导航测试。

#### A06 语法高亮与括号匹配标记

- 当前状态：**MISSING**。
- 代码证据：`web/index.html #source 为 textarea；web/source-assist.mjs`。
- 运行证据：实际源码组件无高亮层/匹配括号标记；测试也未提供该能力。
- 已实现：已有候选和虚拟闭合提示。
- 未实现/未验证：LaTeX/Typst token高亮、匹配括号定位。
- Bug或风险：不能称为已对标专业源码编辑器。
- 严重性：P2。
- 下一步：先明确轻量高亮方案和不影响选区的验收条件。

#### A07 LaTeX / Typst 补全

- 当前状态：**PARTIAL**。
- 代码证据：`web/source-assist.mjs:41–90；web/completion-data`。
- 运行证据：source-assist、source-candidates 通过。
- 已实现：多候选、模糊匹配、光标ghost、begin/end最近未闭合环境；Typst数学/#/sym/math。
- 未实现/未验证：无语言服务器诊断、上下文类型推断、完整参数snippet。
- Bug或风险：Typst词表有限；LaTeX借用词库不等于插件完整功能。
- 严重性：P1。
- 下一步：按上下文补参数结构，保持ghost不写原文。

#### A08 自动闭合与跳出括号

- 当前状态：**PARTIAL**。
- 代码证据：`web/source-assist.mjs:45–49、86–88`。
- 运行证据：source-assist 通过：ghost接受和已有闭合符跳出。
- 已实现：虚拟闭合、Tab接受、避免重复闭合、IME保护。
- 未实现/未验证：未实现完整即时成对插入、选区包裹、成对删除。
- Bug或风险：与成熟编辑器的自动闭合仍有差距。
- 严重性：P2。
- 下一步：补成对编辑语义与撤销测试。

#### A09 手写缩进与自动格式策略

- 当前状态：**PARTIAL**。
- 代码证据：`web/source-assist.mjs:71–79；web/app.js:269`。
- 运行证据：source-mode、visual-format、generated-source 通过。
- 已实现：环境补全含缩进；手写源码不持续自动重排。
- 未实现/未验证：通用Enter缩进、Tab/ShiftTab多行缩进未实现。
- Bug或风险：用户手写复杂结构仍需手动整理。
- 严重性：P2。
- 下一步：增加显式缩进命令，避免实时重排。

#### A10 查找与替换

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:598–604`。
- 运行证据：command-shortcuts 通过 CmdF/G/ShiftG。
- 已实现：源码精确文本查找、前后循环。
- 未实现/未验证：替换/全部替换、大小写/正则选项、匹配计数缺失。
- Bug或风险：查找输入框受全局复制/撤销上下文缺陷影响。
- 严重性：P1。
- 下一步：修焦点后补最小替换流程。

#### A11 自动生成源码格式规范

- 当前状态：**COMPLETE**。
- 代码证据：`web/format-latex.mjs；scripts/sync-latexlive-catalog.mjs；docs/GENERATED_SOURCE_STANDARD.md`。
- 运行证据：generated-source、visual-format、template-generated-source、ocr-format 通过；126模板MathJax实际渲染+幂等。
- 已实现：短结构compact、复杂结构换行缩进；OCR/visual/模板/补全接入共用规范；模板存储已规范化。
- 未实现/未验证：保护性保留的宏/文本不会强制美化；不是全语言语义等价证明。
- Bug或风险：复杂自定义宏仍保守处理；不可把幂等当作数学语义证明。
- 严重性：P2。
- 下一步：加入更多宏/注释/Typst文档保真样本。

#### A12 选区感知结构变换

- 当前状态：**COMPLETE**。
- 代码证据：`web/editor-transforms.mjs；web/app.js:563–574；web/latexlive-exact.js:56`。
- 运行证据：selection-transforms：33种实际菜单点击、operand/source/preview、MathLive undo/redo、无选区placeholder通过。
- 已实现：hat/widehat/tilde/dot/ddot/vec/bar、上下标、分式根式括号等保留选中内容；统一helper。
- 未实现/未验证：完整原生手工链路这轮因桌面不可交互未重验。
- Bug或风险：私有MathLive undo边界API风险归A25；本项仅确认结构语义回归已通过浏览器运行。
- 严重性：P1。
- 下一步：将同类source/Typst/无选区光标行为加入矩阵。

#### A13 Visual / Source 双向同步

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:124–147、269–288、526–532`。
- 运行证据：source-mode、visual-format、commands、selection-transforms通过。
- 已实现：两向同步与格式化；避免手写源码自动重排。
- 未实现/未验证：转换失败/跨renderer/不同Undo入口组合未稳定。
- Bug或风险：readSource调用mf.setValue；两套历史可分歧。
- 严重性：P0。
- 下一步：先统一历史所有权，补跨模式连续操作测试。

#### A14 双语言复杂公式支持

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:65、133、140–147；tex2typst0.6.2`。
- 运行证据：compatibility.json：126模板，100正向转换并本机编译，81反向解析成功。
- 已实现：常用分式矩阵cases上下标等可转换渲染。
- 未实现/未验证：26正向失败；19已编译Typst反向解析失败；无完整语义等价证明。
- Bug或风险：不支持的宏与转换器边界使双语言体验不一致。
- 严重性：P1。
- 下一步：优先覆盖现有模板的可等价语法。

#### A15 源码语言与renderer解耦

- 当前状态：**BROKEN**。
- 代码证据：`web/app.js:140–141、514`。
- 运行证据：代码明确禁止本机LaTeX+Typst源码/本机Typst+LaTeX源码；引擎切换改state.mode。
- 已实现：界面已有独立语言按钮和engine下拉。
- 未实现/未验证：实现仍绑定语言与引擎；Auto renderer未提供。
- Bug或风险：切引擎会改变源码语言；误导用户并触发有损转换。
- 严重性：P1。
- 下一步：保留原始sourceLanguage，通过独立转换适配renderer。

#### A16 统一内容与双源码模型

- 当前状态：**ARCHITECTURE RISK**。
- 代码证据：`web/app.js:22、65、133、147、232`。
- 运行证据：兼容探针证明100种可编译但其中19反向失败；数据只存rawSource+latex+mode。
- 已实现：保留原文与canonical LaTeX；部分避免未修改文本往返。
- 未实现/未验证：没有统一语义AST或带能力/损失信息的双representation模型。
- Bug或风险：并非简单字符串替换库，但应用层仍依赖字符串双转，不能承诺无损。
- 严重性：P1。
- 下一步：先明确representation与转换结果契约，不直接重写整个AST。

#### A17 模板库双语言完整性

- 当前状态：**PARTIAL**。
- 代码证据：`web/vendor/latexlive/catalog.js（生成产物）；scripts/sync-latexlive-catalog.mjs`。
- 运行证据：compatibility.json遍历十类126模板：原生双源0、仅LaTeX126。
- 已实现：全部LaTeX模板可内置渲染，100能动态生成Typst。
- 未实现/未验证：原生Typst模板未存；26转换失败；19反向失败。
- Bug或风险：UI能力被renderer规则额外限制；详见I节。
- 严重性：P1。
- 下一步：补原生Typst与转换能力标记，先解决高频模板。

#### A18 离线OCR识别链路

- 当前状态：**PARTIAL**。
- 代码证据：`macos/formula-ocr-runner.py；FormulaOCR.swift；web/ocr.js`。
- 运行证据：复用现有模型离线Pix2Text单式/整页2式、UniMERNet单式成功；ocr-chain.json双引擎结果导入→格式→Typst→内置渲染通过。
- 已实现：本地模型、单式/整页、规范化与候选、取消/修复入口。
- 未实现/未验证：长式/复杂多行/真实截图准确率基线及原生全链路未完成。
- Bug或风险：成功运行不等于识别数学正确；UniMERNet样例额外生成样式/空格。
- 严重性：P1。
- 下一步：建立含复杂结构的标注语料，测正确率与失败恢复。

#### A19 剪贴板图片 / 图片导入

- 当前状态：**PARTIAL**。
- 代码证据：`web/ocr.js:320–341；macos/FormulaOCR.swift handleOCRRecognize`。
- 运行证据：clipboard-ocr、ocr-behavior通过（桥接模拟）；本机runner真实推理通过。
- 已实现：图片粘贴、单图拖入、文字优先、不自动覆盖候选。
- 未实现/未验证：真实NSPasteboard图片→UI确认→编辑Undo整链未完成。
- Bug或风险：桥接模拟不能证明原生剪贴板稳定。
- 严重性：P1。
- 下一步：解锁后实测图片/文本混合粘贴及撤销。

#### A20 PDF / DOCX 提取

- 当前状态：**PARTIAL**。
- 代码证据：`macos/FormulaDocument.swift；formula-document-runner.py；web/ocr.js`。
- 运行证据：document-behavior通过；本轮未重跑真实PDF/DOCX集成。
- 已实现：已有按页/文档序提取、Word组件入口、最多20页处理。
- 未实现/未验证：本轮真实多页/混合原生公式图片覆盖不足。
- Bug或风险：不可将既有功能当尚未实现，也不能宣称本轮验证通过。
- 严重性：P2。
- 下一步：复用已安装环境重跑document-integration，禁止重新下载模型。

#### A21 快捷工具 / 模板 / 二级面板

- 当前状态：**PARTIAL**。
- 代码证据：`web/latexlive-exact.js；latexlive-menus.js`。
- 运行证据：126模板渲染、selection-transforms33项、shortcut-previews通过。
- 已实现：十类模板、浮层、符号/矩阵/修饰结构、无标题ID噪声。
- 未实现/未验证：不是每个按钮都已做source/Typst/selection/Undo四维验证。
- Bug或风险：渲染通过不等于插入和转换都正确。
- 严重性：P1。
- 下一步：自动生成完整按钮能力矩阵。

#### A22 自定义工具栏

- 当前状态：**COMPLETE**。
- 代码证据：`web/app.js:296–410；web/v1.1.css工具区`。
- 运行证据：custom-toolbar重测通过：真实drag增删排序、持久化、模式、恢复默认；panels frame稳定。
- 已实现：拖动排序/移除、图标/文字/组合、两行受限、收起浮层。
- 未实现/未验证：本项限当前浏览器窗口与已测交互。
- Bug或风险：全局菜单/快捷键风险不由此项保证。
- 严重性：P2。
- 下一步：保留当前回归并补最小宽度溢出断言。

#### A23 Copy / Export 格式及分工

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:165–228；macos/Formula.swift:136–140`。
- 运行证据：output-actions通过8种内置格式：复制payload/导出文件名；native-preview-size通过。
- 已实现：复制到clipboard、导出到file；能力列表稳定；本机额外TIFF/EPS有工具依赖。
- 未实现/未验证：格式列表仍显示实际转换失败的源码项；renderedCopy可能复制所选源码格式。
- Bug或风险：不保证Word/WPS/Pages效果；单representation缺fallback。
- 严重性：P1。
- 下一步：区分复制图形与复制源码能力；增加多representation。

#### A24 Word / WPS / Pages 实际兼容

- 当前状态：**TEST COVERAGE MISSING**。
- 代码证据：`macos/Formula.swift:138–140`。
- 运行证据：本轮未逐应用粘贴；仅有桥接payload验证。
- 已实现：已写系统SVG/PDF/PNG等类型；可复制MathML文本。
- 未实现/未验证：三款编辑器逐应用图形/可编辑公式验收未做。
- Bug或风险：不能宣称原生可编辑公式粘贴兼容；无OMML专用写入证据。
- 严重性：P1。
- 下一步：逐应用实测并记录版本/粘贴类型/清晰度/编辑性。

#### A25 Undo / Redo 统一所有权

- 当前状态：**ARCHITECTURE RISK**。
- 代码证据：`web/commands.mjs RevisionHistory；web/editor-transforms.mjs；MathLive内部executeCommand`。
- 运行证据：undo-divergence.json：registry hat后MathLive undo到x，revision.index仍2且canRedo=false，registry redo无效。
- 已实现：registry ⌘Z/⇧⌘Z核心测试通过，MathLive自身Undo也通过。
- 未实现/未验证：两套Undo入口未统一；textarea原生历史亦未彻底协调。
- Bug或风险：当前可复现历史分歧；不能称统一撤销已完成。
- 严重性：P0。
- 下一步：统一所有入口与事务边界，补混合入口跨模式回归。

#### A26 可查看的自动编辑History

- 当前状态：**PARTIAL**。
- 代码证据：`web/commands.mjs RevisionHistory；web/app.js:591–617`。
- 运行证据：revision-history、commands通过：恢复、分支、100条/4MB限制。
- 已实现：历史UI、搜索、时间戳、恢复、localStorage持久化，与收藏分开。
- 未实现/未验证：清理UI、可靠数据迁移、完整paste/delete/OCR原生记录未完成。
- Bug或风险：schedule.flush丢具体标题；本机安装版尚无新History UI。
- 严重性：P1。
- 下一步：先与Undo统一，再完善持久化与清理。

#### A27 History快照覆盖排版设置

- 当前状态：**BROKEN**。
- 代码证据：`web/commands.mjs signature；web/app.js captureRevision`。
- 运行证据：probes.json signature=true：透明true/false判作同一revision。
- 已实现：snapshot捕获透明/scale/displayMode等字段。
- 未实现/未验证：signature未包含透明、scale、displayMode；mathFont未capture。
- Bug或风险：透明/分辨率/字体等更改不可靠地进入可撤销历史。
- 严重性：P1。
- 下一步：集中声明文档状态字段并测试每项变化的Undo。

#### A28 键盘快捷键体系

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:537–620；web/commands.mjs:7`。
- 运行证据：command-shortcuts、commands通过：无重复键、N/O/S/1/2/3/F/G/K/L/E等。
- 已实现：新键位注册、原生quit/close保留、toolbar部分tooltip。
- 未实现/未验证：命令搜索和设置焦点下标准编辑键错误；并非每按钮有tooltip。
- Bug或风险：已安装应用仍旧⌘E导出/⇧⌘C源码，不是当前源码新键位。
- 严重性：P1。
- 下一步：修上下文后统一原生菜单及网页事件优先级。

#### A29 macOS 菜单栏 Commands

- 当前状态：**TEST COVERAGE MISSING**。
- 代码证据：`macos/Formula.swift:86–129`。
- 运行证据：Swift真实编译成功；本机AX只见旧文件/编辑菜单，新菜单尚未安装。
- 已实现：当前源码已有文件/编辑/视图/公式/窗口/帮助及动态enabled桥。
- 未实现/未验证：尚缺最新源码的原生菜单点击、Responder链/快捷键实测。
- Bug或风险：代码存在不能当COMPLETE；已安装版本与源码不同。
- 严重性：P1。
- 下一步：通过审计后安装当前候选，完整原生菜单工作流验证。

#### A30 Command Palette / 上下文菜单

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:587–606`。
- 运行证据：commands、command-shortcuts通过；panels浮层frame不变。
- 已实现：搜索、键盘上下导航、执行、Esc恢复、History复用。
- 未实现/未验证：上下文菜单实际打开全量命令面板，未精简相关项。
- Bug或风险：搜索框标准复制存在已复现回归。
- 严重性：P1。
- 下一步：先修编辑上下文，再收敛上下文相关命令。

#### A31 Command Registry 统一程度

- 当前状态：**ARCHITECTURE RISK**。
- 代码证据：`web/commands.mjs；web/app.js:539–621、514、remember/restore`。
- 运行证据：commands测试核心统一入口通过；静态仍见直接engine/settings/favorites修改。
- 已实现：菜单/快捷键/主要toolbar共享registry；结构helper统一。
- 未实现/未验证：context未成明确契约；undoable metadata未完整暴露；部分入口绕开transaction。
- Bug或风险：动态命令与独立事件并存，错误enabled和历史遗漏易反复。
- 严重性：P1。
- 下一步：列所有mutation入口，统一状态/事务约定，避免大重写。

#### A32 自动测试体系与CI

- 当前状态：**PARTIAL**。
- 代码证据：`.github/workflows；tests/*.cjs；docs/audit/2026-10-14/test-summary.json`。
- 运行证据：本轮30个JS脚本29通过1失败；Python OCR单元2项通过。
- 已实现：单元、真实Chromium集成、渲染、转换、OCR runner与回归已有。
- 未实现/未验证：最新command/selection/formatter测试尚未加入CI；旧reference-layout已过时。
- Bug或风险：绿色旧CI不能证明本轮新架构；旧测试等待已删除#input-color超时。
- 严重性：P1。
- 下一步：整理统一测试入口，新增高风险测试接CI并修旧断言。

#### A33 真实Mac完整工作流

- 当前状态：**TEST COVERAGE MISSING**。
- 代码证据：`/Applications/Formula.app；本轮CUA记录`。
- 运行证据：连接运行中应用成功、读到公式与旧菜单；后续操作无响应且截图不可用，已请求解锁。
- 已实现：浏览器集成与真实离线模型推理完成；本机进程存在。
- 未实现/未验证：19步完整人工工作流未完成；当前源码新菜单/history/原生copy尚未安装验证。
- Bug或风险：不得把headless或已有进程当新版本真实验收通过。
- 严重性：P1。
- 下一步：解锁后按19步清单实测，保留用户原公式/设置。

#### A34 用户资产与共享模型

- 当前状态：**PARTIAL**。
- 代码证据：`macos/Formula.swift:16–17、134；FormulaOCR.swift:9；runner:25、50`。
- 运行证据：现有OCR环境离线推理成功，无安装/下载；本轮未删除任何用户资产。
- 已实现：正式ID固定；MathForge/state.json与现有OCR根保留，收藏字段兼容。
- 未实现/未验证：模型散布MathForge/OCR和~/.pix2text；缺完整hashmanifest；History另存localStorage。
- Bug或风险：不能称所有模型都在统一Models目录；marker/依赖检查不是权重完整性校验。
- 严重性：P1。
- 下一步：明确共享资源清单与只读完整性检查，避免移动venv。

#### A35 本机安装与构建可重复性

- 当前状态：**ARCHITECTURE RISK**。
- 代码证据：`scripts/install-local.sh`。
- 运行证据：npm build:vendor成功；当前Swift真实编译成功；应用bundle hash与工作区不同。
- 已实现：备份→正式ID替换→启动已有脚本，原有授权仍适用。
- 未实现/未验证：依赖现有app离线资源；无可靠失败回滚；两次重复ditto；本轮未执行安装。
- Bug或风险：不能称干净通用构建；资源更新可能漏复制，安装不能等同代码构建。
- 严重性：P1。
- 下一步：先补产物清单/回滚，再安装经验证候选。

#### A36 错误输入与Last Valid Preview

- 当前状态：**COMPLETE**。
- 代码证据：`web/app.js:68–75、85–123`。
- 运行证据：last-valid-preview通过：保留上一有效图像，禁止导出陈旧结果。
- 已实现：保留可见结果、stale提示、renderID防旧结果覆盖。
- 未实现/未验证：不是任意不完整语法都可临时自动补全。
- Bug或风险：本项结论限已测失效/恢复场景。
- 严重性：P2。
- 下一步：维持陈旧结果不可导出的回归约束。

#### A37 输出字体与无闪烁切换

- 当前状态：**COMPLETE**。
- 代码证据：`web/app.js MathJax字体加载/渲染；web/v1.1.css`。
- 运行证据：math-fonts、font-controls、font-native-reload通过。
- 已实现：11种内置字体、默认黑色、只更新预览、局部样式与输出字体分开。
- 未实现/未验证：本机字体选择仍禁用，为当前明确能力边界。
- Bug或风险：浏览器测试不代替用户对所有Mac显示器的闪烁感受。
- 严重性：P3。
- 下一步：补原生视觉冒烟，不扩大字体UI。

#### A38 独立编辑缩放与输出字号

- 当前状态：**COMPLETE**。
- 代码证据：`web/app.js editor-size/output-size；Formula.swift render`。
- 运行证据：editor-zoom、native-preview-size通过。
- 已实现：源码/visual显示独立；输出字号与本机LaTeX/Typst同步；A−A+组合。
- 未实现/未验证：本轮未做全部字号上限的人工视觉验收。
- Bug或风险：保留各自状态，不重新合并缩放。
- 严重性：P3。
- 下一步：保持回归测试。

#### A39 收藏公式图形展示

- 当前状态：**COMPLETE**。
- 代码证据：`web/app.js:206–210；web/v1.1.css:223–224`。
- 运行证据：compact-layout与custom-toolbar/现有渲染路径通过；代码渲染SVG到收藏card。
- 已实现：收藏保存公式与排版、SVG自适应、删除与恢复；保留旧字符串兼容。
- 未实现/未验证：转换失败/自定义宏可能回退源码；分类检索尚未实现。
- Bug或风险：本项只确认图形展示基础路径，不将其当自动History。
- 严重性：P2。
- 下一步：补复杂宏fallback与收藏搜索。

#### A40 保存、重新打开与文档生命周期

- 当前状态：**PARTIAL**。
- 代码证据：`web/app.js:234–240、541–542、originalImport；Formula.swift save/importFile`。
- 运行证据：output-actions验证MathForge导出名与payload；commands open/save桥接通过。
- 已实现：可恢复MathForge、源码文件导入、收藏备份。
- 未实现/未验证：⌘S与另存为都弹保存；无明确文档URL/dirty状态；原生保存再开未全验。
- Bug或风险：缺持续文档身份与异常恢复证据。
- 严重性：P1。
- 下一步：定义最小文档生命周期，验证保存→关闭→重开一致性。

## C. COMPLETE

- A04 多公式及长公式完整可见：不代表所有 renderer 或遮罩组合已验证。
- A11 自动生成源码格式规范：复杂自定义宏仍保守处理；不可把幂等当作数学语义证明。
- A12 选区感知结构变换：私有MathLive undo边界API风险归A25；本项仅确认结构语义回归已通过浏览器运行。
- A22 自定义工具栏：全局菜单/快捷键风险不由此项保证。
- A36 错误输入与Last Valid Preview：本项结论限已测失效/恢复场景。
- A37 输出字体与无闪烁切换：浏览器测试不代替用户对所有Mac显示器的闪烁感受。
- A38 独立编辑缩放与输出字号：保留各自状态，不重新合并缩放。
- A39 收藏公式图形展示：本项只确认图形展示基础路径，不将其当自动History。

## D. PARTIAL

- A01 任务驱动工作流：低频工具仍有重叠入口；不能以入口齐全代表任务闭环。
- A03 布局与编辑上下文稳定：标签点击后焦点在按钮，未恢复编辑器；滚动探针内容不够长，不能证明滚动保留。
- A05 基础源码编辑与导航：textarea与全局命令层可能争夺快捷键。
- A07 LaTeX / Typst 补全：Typst词表有限；LaTeX借用词库不等于插件完整功能。
- A08 自动闭合与跳出括号：与成熟编辑器的自动闭合仍有差距。
- A09 手写缩进与自动格式策略：用户手写复杂结构仍需手动整理。
- A10 查找与替换：查找输入框受全局复制/撤销上下文缺陷影响。
- A13 Visual / Source 双向同步：readSource调用mf.setValue；两套历史可分歧。
- A14 双语言复杂公式支持：不支持的宏与转换器边界使双语言体验不一致。
- A17 模板库双语言完整性：UI能力被renderer规则额外限制；详见I节。
- A18 离线OCR识别链路：成功运行不等于识别数学正确；UniMERNet样例额外生成样式/空格。
- A19 剪贴板图片 / 图片导入：桥接模拟不能证明原生剪贴板稳定。
- A20 PDF / DOCX 提取：不可将既有功能当尚未实现，也不能宣称本轮验证通过。
- A21 快捷工具 / 模板 / 二级面板：渲染通过不等于插入和转换都正确。
- A23 Copy / Export 格式及分工：不保证Word/WPS/Pages效果；单representation缺fallback。
- A26 可查看的自动编辑History：schedule.flush丢具体标题；本机安装版尚无新History UI。
- A28 键盘快捷键体系：已安装应用仍旧⌘E导出/⇧⌘C源码，不是当前源码新键位。
- A30 Command Palette / 上下文菜单：搜索框标准复制存在已复现回归。
- A32 自动测试体系与CI：绿色旧CI不能证明本轮新架构；旧测试等待已删除#input-color超时。
- A34 用户资产与共享模型：不能称所有模型都在统一Models目录；marker/依赖检查不是权重完整性校验。
- A40 保存、重新打开与文档生命周期：缺持续文档身份与异常恢复证据。

## E. MISSING

- A06 语法高亮与括号匹配标记：不能称为已对标专业源码编辑器。

## F. BROKEN / REGRESSION

- A02 焦点感知与标准复制：全局捕获快捷键可覆盖用户复制意图，写错剪贴板。
- A15 源码语言与renderer解耦：切引擎会改变源码语言；误导用户并触发有损转换。
- A27 History快照覆盖排版设置：透明/分辨率/字体等更改不可靠地进入可撤销历史。

## G. ARCHITECTURE RISKS

- A16 统一内容与双源码模型：并非简单字符串替换库，但应用层仍依赖字符串双转，不能承诺无损。
- A25 Undo / Redo 统一所有权：当前可复现历史分歧；不能称统一撤销已完成。
- A31 Command Registry 统一程度：动态命令与独立事件并存，错误enabled和历史遗漏易反复。
- A35 本机安装与构建可重复性：不能称干净通用构建；资源更新可能漏复制，安装不能等同代码构建。

## H. TEST COVERAGE GAPS

- A24 Word / WPS / Pages 实际兼容：不能宣称原生可编辑公式粘贴兼容；无OMML专用写入证据。
- A29 macOS 菜单栏 Commands：代码存在不能当COMPLETE；已安装版本与源码不同。
- A33 真实Mac完整工作流：不得把headless或已有进程当新版本真实验收通过。

### 具体失败与覆盖边界

1. `context-copy.json`：命令搜索框选中“hat”，⌘C得到 `copyImage` + SVG，应该复制文本。不是推测。
2. `undo-divergence.json`：registry修饰后index=2，MathLive内部Undo使源码回到x，但index仍2，registry canRedo=false，调用registry redo无效。两种Undo单测各自通过仍不能证明组合正确。
3. `probes.json`：透明背景true/false的history signature相等；实现漏字段。并非所有排版参数都有事务入口。
4. `test-summary.json`：29通过/1失败。失败是`reference-layout`的过时选择器；尚不能称整套测试绿色。
5. 本轮未重复下载模型；真实OCR结果证明环境可用，不证明复杂图片、原生粘贴、撤销、保存再开全链路。
6. 新增command/selection/formatter等测试未接现有CI；很多原生桥测试使用mock，不验证NSResponder和实际剪贴板。
7. scroll探针已覆盖1/10/50行、长横式；没有全面覆盖本机PNG预览、候选面板50条及用户手动源码滚动。不能概括成所有长内容无遗漏。

### 实际Mac 19步工作流记录（初次锁屏阶段；解锁后的更新见L节）

| 步骤 | 本轮真实Mac结果 | 浏览器/其他运行补充 |
|---|---|---|
| 启动/连接 | 连接已运行应用、可读AX和文件菜单；不是新版本启动验收 | 当前源码另有Chromium运行 |
| 1 新建 | 未执行，桌面不可交互 | command-shortcuts通过 |
| 2 输入源码 | 未执行 | source-mode/source-assist通过 |
| 3 Source/Visual切换 | 未执行 | source-mode/visual-format通过 |
| 4 插入模板 | 未执行 | 126渲染、部分按钮插入通过 |
| 5 选中变量上标 | 未执行 | selection-transforms通过 |
| 6 添加hat | 未执行 | 实际Chromium菜单点击通过 |
| 7 Undo | 未执行 | registry与MathLive独立通过；混用分歧已复现 |
| 8 Redo | 未执行 | 同上 |
| 9 OCR图片 | 未走原生UI | 现有模型离线真实推理，单图/整页通过 |
| 10 查看LaTeX | AX可读当前LaTeX公式 | OCR链导入通过 |
| 11 查看Typst | 未执行 | 100模板转换编译、19反向失败 |
| 12 切renderer | 未执行 | 源码证实会改变语言；本机Typst CLI编译成功 |
| 13 Copy | 未执行 | 桥接payload8格式通过；命令搜索文本复制错误 |
| 14 Export | 未执行 | 8格式payload/文件名通过，不能代替保存对话框 |
| 15 History | 安装版不是新架构，未验证 | 工作区UI搜索恢复通过 |
| 16 Palette | 同上 | 工作区搜索/执行通过 |
| 17 多公式滚动 | 未执行 | 1/10/50行与横式可达 |
| 18 保存 | 未执行 | MathForge payload通过 |
| 19 重新打开 | 未执行 | 本轮无真实保存再开证据 |

**必须保留这一验收缺口；不能将本轮审计报告标注为完整原生功能验收通过。**

## I. LaTeX / Typst Compatibility Report

统计对象是十类**完整公式模板**，不把占位结构按钮、分隔符或符号算作独立模板。原始每项源码、转换结果和错误在`compatibility.json`。

| 指标 | 数量/说明 |
|---|---:|
| Template total | 126 |
| Both stored natively | 0 |
| LaTeX only stored | 126 |
| Typst only stored | 0 |
| LaTeX MathJax parse/render success | 126 |
| Both supported at forward-convert + native-Typst-compile level | 100 |
| LaTeX only through current forward converter | 26 |
| Typst only by runtime capability | 0 |
| Forward conversion failed | 26 |
| Forward output native Typst compile failed | 0 / 100 |
| Reverse parser success | 81 / 100 |
| Reverse parser failed | 19 / 100 |
| True Typst language limitation proven | 0；未证明，不能将失败归咎语言 |
| Converter/parser limitation | 26正向 + 19反向；两组不重叠 |
| UI limitation | 本机引擎规则对全部126模板都有另一语言查看限制；其中100个实际可转换编译但仍受规则限制 |

100个“可转换编译”**不代表100个无损双向可编辑**。81个反向解析成功也未证明数学/排版完全等价；只表明当前converter接受语法。用户未编辑alternate时canonical保留可绕过一些往返解析，手工编辑后问题仍存在。

| 分类（catalog键） | 总数 | 正向转换+本机编译 | 正向失败 | 反向解析成功 | 反向失败 |
|---|---:|---:|---:|---:|---:|
| algebra | 13 | 10 | 3 | 8 | 2 |
| geometry | 11 | 11 | 0 | 7 | 4 |
| inequality | 13 | 9 | 4 | 8 | 1 |
| calculous | 14 | 12 | 2 | 12 | 0 |
| array | 8 | 7 | 1 | 3 | 4 |
| trigonometry | 13 | 13 | 0 | 13 | 0 |
| statistics | 16 | 12 | 4 | 7 | 5 |
| sequence | 10 | 10 | 0 | 7 | 3 |
| physics | 24 | 16 | 8 | 16 | 0 |
| chemistry | 4 | 0 | 4 | 0 | 0 |

### 失败原因分类与代表样例

按照用户给定分类：
- 正向失败主要属于 **2 当前converter未覆盖 / 5 parser不理解 / 6 不支持macro或primitive**；模板原生双源未存属于 **3**。
- 19个反向失败属于 **2/5**：已经通过本机Typst编译，明确不是Typst不能表达。
- 本机renderer锁语言属于 **7 UI/状态规则限制**；rawSource+单canonical属于 **9 数据模型限制**。
- **1 真正语言不可表达**：本轮无证据，不认定。**8 状态未同步**没有在模板全量探针独立证明，不硬归类。

| 案例 | 结果 | 分类 |
|---|---|---|
| algebra_8 / physics_9 | Unknown token: `\over` | 2/5/6，非Typst语言限制 |
| inequality_4 | `\gt`无法转换 | 2/5，已有数学对应表达 |
| calculous_10/11 | `\arcsin` / `\arctan`未覆盖 | 2/5 |
| statistics_9 | `\choose`无法转换 | 2/5/6 |
| physics_21/23 | `\cfrac`无法转换 | 2/5/6 |
| chemistry_1/2 | `\ce`无法转换 | 2/6，mhchem包语法适配缺失 |
| chemistry_3/4 | Unknown token type | 2/5，未证明语言不能表达 |
| algebra_10、geometry_4/7/10 | 正向编译成功；反向Unmatched brackets | 2/5 |
| array_5/6/8 | 正向编译成功；反向delim参数错误 | 2/5 |
| statistics_8等 | 正向编译成功；反向named parameters未实现 | 2/5 |

完整26+19项逐项错误均保存在`compatibility.json`，没有只检查首页。

### 不同来源的双源码路径

| 来源 | 当前路径 | 结论 |
|---|---|---|
| 内置模板 | LaTeX catalog→load/insert→tex2typst | 全量统计如上；无原生Typst副本 |
| OCR | runner LaTeX→normalize/format→FormulaImport→conversion | 两引擎真实样例双源+内置渲染通过；复杂样例不足 |
| 用户新建 | rawSource+mode→canonical→alternate | 可等价语法可切，native renderer人为锁语言 |
| Visual | MathLive LaTeX→formatter→alternate | 正常结构通过，converter边界仍在 |
| 快捷公式/补全 | LaTeX/Typst词/结构→source | 常用命令覆盖，非全部按钮双语测试 |
| 收藏 | string或rawSource+mode+settings | 老数据兼容；错误宏可能只显示源码；未逐收藏私有数据转换 |
| 自定义工具 | 同结构入口 | helper统一；不是任意自定义macro都可转换 |

## J. Priority

### P0

- 普通文本框⌘C被公式复制拦截，已经复现错误clipboard payload。
- MathLive内部Undo与Registry History分歧，已复现Redo失效；属于恢复连续性问题，暂未证明永久数据丢失。

### P1

- 修复语言/renderer耦合，以及26正向/19反向转换缺口的产品规则。
- History状态字段、事务入口与持久化一致性；原生菜单/标准编辑焦点完整验收。
- 将新测试接CI、清理过时断言；实际Word/WPS/Pages粘贴和保存再开。
- 安装资源合约与回滚，确保测试候选对应实际源码。

### P2

- 语法高亮、括号匹配、手写缩进、查找替换深化；复杂OCR语料基线。
- 模板/收藏搜索与能力标注；文档真实集成覆盖。

### P3

- 视觉与辅助功能细节、更多字体/窗口/显示器下的冒烟验证。

## K. Recommended Next Work Batch

下一批只处理以下5项，先不换编辑器技术栈、不重写整个AST：

1. **统一编辑上下文与系统快捷键**：所有普通文本框回归原生语义，源码/visual/result各自复制正确；测试菜单、键盘和Palette入口。
2. **统一Undo/History所有权与事务字段**：接管MathLive所有Undo入口，保留光标/selection/scroll；覆盖typing→wrapper→模式切换→undo→redo，以及透明/字号/字体设置。
3. **解耦sourceLanguage与renderer并定义转换契约**：保留原文；先覆盖现有模板常见宏，反向失败可解释且不覆盖原数据。
4. **修复测试与补原生完整链**：修旧断言、新增测试入CI；解锁后完成19步工作流和至少Word/WPS/Pages的明确粘贴能力记录。
5. **完善本机产物/安装回滚与版本证据**：一致资源清单、备份可恢复、正式ID/模型复用；再安装启动候选供用户验收，未经确认不推送。

## 本轮交付状态

- 代码修改：仅本审计报告、历史审计副本和证据文件；产品实现未新增修改，既有未提交修改保留。
- 构建：web bundle与当前Swift可执行文件构建成功；非正式签名公证产物。
- 测试：29/30 JS通过，1个过时测试失败；Python OCR单元通过；真实模型3次推理成功；126渲染/100Typst编译。
- 安装：本轮未安装/覆盖；已安装应用与工作区不同。
- 启动：现有`/Applications/Formula.app`进程已确认，当前源码未安装启动。
- 等待验证：Mac解锁后的完整原生工作流、用户资产/保存恢复、Office粘贴；并先修本报告P0。
- GitHub：**未推送**；未创建/更新PR、Release或标签。等待修复、用户验收及明确授权。

## 证据索引与复现

目录：`docs/audit/2026-10-14/`。

- `test-summary.json`：最终30脚本结果；`tests.json`/`legacy-retest.json`保留环境失败与重测历史；`extra-tests.json`追加测试。
- `probes.json` / `panels.json`：滚动几何、布局、选区、命令状态。
- `compatibility.json` / `compat-summary.json`：126模板原文、转换源码、reverse错误、真实Typst编译结果。
- `context-copy.json` / `undo-divergence.json`：已复现P0；脚本context.cjs、undo.cjs。
- `ocr-*.json` / `ocr-chain.json`：现有模型离线推理和后续双源渲染；并非原生剪贴板验收。
- `build.log` / `swift-build.log`：构建stdout/stderr，后者为空代表无编译诊断，已核查实际exit0与产物。
- `ocr-unit.log`：Python单元结果。
- `previous-audit.md`：旧报告存档。

复现浏览器探针：在仓库根启动`python3 -m http.server 8765 --bind 127.0.0.1 --directory web`，安装现有npm依赖并先`npm run build:vendor`；创建`/tmp/formula-audit-20261014/`，再运行该目录脚本。`probe.cjs`→`compat.mjs`有依赖；OCR链脚本依赖本轮已保存真实runner输出。模型探针只使用现有环境并设置HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE，不运行安装器。不允许为复现审计删除数据或重新下载模型。


## L. 用户解锁后的真实Mac补充验证

本节更新初次锁屏时的待验证记录。证据：`docs/audit/2026-10-14/native-manual.json`，原生保存的SVG/MathForge样本同目录。本节测试的是**已安装应用**，没有偷换成当前工作区的新bundle，40项主状态计数保持不变。

| 真实步骤 | 结果 | 证据/限制 |
|---|---|---|
| 新建并输入x | 通过 | 清空后输入x，AX源码x，内置预览29×26px |
| Source/Visual切换 | 能切换 | 真实界面与AX；连续编辑行为未全部通过 |
| 上标后输入2 | 失配 | 观察到`x2^{}`；预期`x^2`。插入后光标/焦点/选区未被独立确认，不能直接归因于helper |
| 帽号及⌘Z/⇧⌘Z组合 | 失配，未通过 | 源码出现`x2^{}\hat{}`；还需排除Cmd+A和UI焦点链问题。不能标为原生选区修复验收成功 |
| 通过原生面板选择OCR图片 | 通过 | 测试fixture ocr-single.jpg；Pix2Text1.1.7，已安装模型，未下载安装 |
| OCR→编辑器→Typst | 通过 | `upright(x) + upright(y) = 2`，内置预览104×35px |
| 本机Typst | 通过 | UI状态“本机排版完成 · typst”，预览326×109px |
| 点击复制SVG | 执行 | 未向Word/WPS/Pages实际粘贴，不声称目标应用兼容性 |
| 原生SVG导出 | 通过 | 保存manual-ocr.svg，实际3381bytes并含SVG |
| 保存MathForge | 通过 | 保存manual-ocr.mathforge，实际552bytes；核验mode=typst与源码 |
| 清空后重新打开MathForge | 通过 | 通过⌘O与原生Open面板，源码与104×35px内置结果恢复 |
| 原始状态恢复/本机LaTeX | 通过 | 原公式及LaTeX源码恢复，本机xelatex预览777×210px；回到快捷工具/源码/SVG |
| 新History、Palette、Registry菜单 | 未测 | 安装版尚无当前工作区新实现；不能通过按键尝试把不存在入口算作成功 |
| 50行滚动/全部模板 | 原生未重做 | 仍以已有真实Chromium探针为证，不夸大为原生全覆盖 |

原始状态的本地备份仅在`/tmp/formula-audit-20261014/pre-manual-state.json`与恢复文件中，未复制用户收藏/完整偏好到仓库。已恢复原公式`P(E)={n\choose k}p^{k}(1-\hat{p})^{n-k}`、size16/padding8、新CM、透明背景、300DPI、本机LaTeX；初始引擎下拉曾显示Typst而实际持久化和预览是LaTeX，恢复以原始持久化engine=latex为准。

因此，A18/A23/A40新增了真实原生链路证据，但仍为PARTIAL；A12的COMPLETE仅指当前工作区结构语义浏览器回归，不代表已安装Mac版验收通过。下一批应把原生焦点/selection/插入光标失配列入P0回归排查，保留本轮源码格式化与结构helper成果，禁止粗暴回退。

本补充轮未修改产品实现、未重新构建、未安装、未推送GitHub；应用保持运行，原公式和主要设置已恢复。


## M. 审计缺陷修复复核（2026-10-14）

本节对应用户“解决未通过的审计点”，是产品实现修改后的增量复核。A–L保留原始审计证据与当时状态，不把原计数改成全部通过。

### 已修复并验证

- **选区/焦点 P0**：根因包含 MathLive 内部 blurred 标记与真实 DOM 焦点失配。切换源码时显式 blur；进入 visual 时同步内部焦点并聚焦 keyboard-sink。真实 Mac 从选中 x 到上标输入 2 得到 `{x}^2`，再选中表达式加帽号得到 `\hat{{x}^2}`，不丢 operand。
- **Undo/Redo P0**：MathLive 0.111.1 内部命令、公开 executeCommand 与虚拟键盘的 Undo/Redo 接入统一 History；visual 同步路径也记录真实输入。⌘Z/⇧⌘Z 原生复核通过。仍依赖固定版本 private adapter，升级 MathLive 必须重跑。
- **复制上下文 P0**：普通设置/搜索输入框保持原生编辑；visual selection、source selection 与预览复制区分。真实命令面板复制得到 `audit-text-copy` 和纯文本类型，不误复制公式。
- **History 设置字段**：透明背景、字号、留白、字体、缩放、前言、显示模式、引擎纳入快照；flush 保留事务标签；错误恢复不前移历史指针。测试覆盖连续键入、wrapper、模式切换、撤销重做和分支截断。
- **sourceLanguage 与 renderer**：切换引擎保留原语言及原文，编译时转换，不再强制改源码；不支持转换保留原内容和上次有效预览。测试覆盖两个本机引擎与源语言独立。
- **转换覆盖**：集中 adapter 处理常见宏别名、嵌套 infix over/choose，保护 text/operatorname。126 模板中 120 正向转换且真实 Typst 编译成功（此前100）；95反向成功。仍有6正向与25反向失败，不标为全覆盖。
- **源码编辑**：增加无交互 paint 层的高亮/括号提示，原 textarea 仍负责输入、选区、滚动；增加可撤销查找替换、换行缩进、Tab/⇧Tab 多行缩进。输入法组合期间不接管这些按键。自动格式化生成源码与用户手写编辑分离。
- **复制图形**：native 粘贴板提供所选图形、PNG fallback 与原公式 metadata；文本格式复制仍按所选格式执行。metadata 的重新导入尚未接入，不能声称可编辑 Office 公式。
- **测试/安装**：旧 reference-layout 断言更新；20编辑器回归套件纳入 CI。OCR mock 安装测试固定临时根目录，避免触及用户模型。install-local 验证资源哈希/签名，备份应用，安全替换并在启动失败时回滚，保留正式 ID 与用户数据。

### 证据与当前部署边界

`docs/audit/2026-10-14/fixes/editor-tests.log`：20/20编辑器套件通过；`conversion.json`：逐模板真实转换与编译；`native-regression.json`：已安装候选上的原生链观察。实际 Mac 候选已编译安装运行，最新新增缩进/引擎历史补丁尚需更新安装；安装进行前 Mac 再次锁屏，已请求解锁。首次安装成功消息的 shell 变量边界错误已修复，实际安装与运行已独立核验，但不能将首次脚本非零退出称为成功退出。

### 未关闭的审计项

- 自动引擎选择、完整语言服务器、统一语义 AST、模板双原生语言存储未实现；本轮保留既有架构，未伪装成重写完成。
- 6正向/25反向转换缺口；mhchem与复杂字号指令未以删除语义的方式“修复”。
- Word/Pages尚未逐应用实测；WPS窗口自动化不可观察，目标粘贴未验收。现阶段提供图形粘贴，不声称原生可编辑数学对象。
- Save 与 Save As 仍都走保存面板；完整文档URL生命周期、跨原生状态存储的 History 迁移未完成。
- OCR统一全部模型目录及完整权重哈希清单、干净构建资源基线/通用架构、公证仍需后续验证。

GitHub未推送；用户验收及新的推送授权仍是发布前提。

补充复核：扩展22个套件最初19通过、3环境入口失败，已移除硬编码浏览器/服务依赖并将旧 visual-tools 断言迁移到当前真实菜单；3个重测全部通过，见 extended-tests.json 与 extended-retest.json。当前合并结果为22/22；其中3个也已纳入20个CI编辑器套件，因此两组数量不相加。


## N. 源码语言 / 排版引擎重构（2026-10-14）

- 删除持久化的 `mode` 与三选一 `engine`；新模型只保存 `sourceLanguage: latex|typst`、`typesettingEngine: builtin|local`。MathLive自身的math/latex输入模式仍是独立语义，未改名。
- `web/typesetting.mjs` 提供迁移与 actual typesetter resolver。native消息中的engine仅为派生出的实际工具名称，不再作为用户状态存储。
- 输出头部的select替换为现有segmented样式的radiogroup：固定高度、两个互斥radio、roving tabindex、方向键/Home/End、无阴影；鼠标切换保留编辑焦点/选区，变化可撤销。
- 本机发送当前语言原始源码；切换语言保持local/builtin，不再进行跨语言本机编译。工具发现、路径、环境、版本、Swift编译实现未改动。
- 内置Typst仍使用现有Typst→LaTeX→MathJax管线；不是新实现原生Typst内置编译器，语法转换边界保留。
- 兼容embedded/builtin/latex/typst/local_latex/local_typst旧设置，既有明确源码语言优先，避免覆盖不匹配旧设置中的原始源码；无明确语言才从旧程序推导。启动、文件/收藏恢复及旧History快照统一迁移；新持久化不再写冗余字段。
- 验证：21编辑器套件、8附加套件、本机预览字号套件通过；真实原生render执行XeLaTeX和Typst并返回PNG/PDF，缺工具错误通过。node语法检查与diff whitespace检查通过；项目未配置独立lint或type-check任务，不声称运行不存在的任务。
- 本机已备份替换 `/Applications/Formula.app` 并启动；资源SHA256与工作区相同，正式ID org.mathforge.desktop不变。真实界面radio及local LaTeX→Typst→LaTeX完整链通过。用户开始编辑后停止额外重启，以保留当前输入。
- 证据：`docs/audit/2026-10-14/typesetting/`。本轮等待用户验收，GitHub未推送；既有其他审计缺口不因此宣称全部关闭。


## O. 五类UX修复与OCR最终收敛（2026-10-15）

- 主界面改为历史公式：预览、最近时间、打开、删除、清空；按canonical内容去重，不以模式切换生成新条目。`web/formula-history.mjs` 与Undo store独立；输入停顿1.8秒后收录有效公式，旧操作记录一次性提取内容变化。高级公式版本历史展示Before/After，UI点击/光标/设置变化不产生内容版本。历史有100条上限；公式身份基于现有MathLive规范化LaTeX，不声称完成语义AST等价判断。
- 格式元数据统一raster/vector/source判断；分辨率控件保留原值但对矢量/源码禁用。native预览固定scale1；native位图导出按DPI重新生成，vector不使用用户DPI。两组A−/A+统一78×30px、无中间竖线。
- selection policy集中定义函数wrap、primary operand、special body、replace。积分主体/求和/连乘/极限区别于上下限，符号替换选区；嵌套分式/函数/矩阵及Undo/Redo、空placeholder通过集成测试。编辑依然采用MathLive现有LaTeX插入API，不宣称新建AST。
- 最终OCR工作区：右侧固定148px竖向微型工具，依次选择按钮、2px进度线、64×40px以内缩略图或中间省略文件名。文件名保留前后段和完整扩展名，tooltip只含basename。选择后自动识别；无真实百分比时使用indeterminate，完成归零。图片/文档共享布局，识别结果占其余空间。异常仅提示失败/重试，详细错误留日志。
- 模块选择/单公式与整页/页码/安装修复与取消进度集中在设置→高级→OCR模块，偏好保存；完整日志在诊断/安装日志。主区无模块、技术状态、安装或日志入口。保留既有环境/model，不重新下载。
- 原生文件确认回调只传basename与小缩略图；ImageIO按128px生成，不传整张图片路径。剪贴板缩略图转换为小图后释放临时URL。修复Typst文档指令被包入数学定界符的旧兼容问题，并有native包装回归。
- 23编辑器套件通过；OCR安装取消/进度/专业版切换测试通过；原生构建通过（现有allowedFileTypes弃用警告保留）。无独立lint/typecheck配置；node语法检查与diff whitespace通过。真实图片OCR完整链通过；文档文件确认布局由集成测试覆盖，本轮未宣称真实文档识别完成。
- 已备份安装并启动/Applications/Formula.app，正式org.mathforge.desktop不变，bundle哈希与工作区一致。测试前公式和主要设置已恢复；用户在设置中开始操作后停止进一步UI控制。
- 证据在`docs/audit/2026-10-15/ux-five/`。GitHub未推送，等待用户验收。此前审计转换/Office/架构缺口不因此视为全部关闭。
