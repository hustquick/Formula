> 当前执行规则（2026-10-15）：B表 A01–A40 是唯一主任务清单，按依赖与用户当前优先级选择未完成项，Execution Order 保留历史排序；一次只验收一项。其余章节为有日期的历史证据，不能覆盖 B 表当前状态。未经重新验证的条目保留原审计状态。

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

### 初始审计状态计数（2026-10-14，非当前进度）

| 主状态 | 数量 |
|---|---:|
| COMPLETE | 8 |
| PARTIAL | 21 |
| MISSING | 1 |
| BROKEN | 3 |
| ARCHITECTURE RISK | 4 |
| TEST COVERAGE MISSING | 3 |

## B. Feature Audit Table

执行依赖：A02为独立P0；A16内容契约→A31事务入口→A25撤销→A27快照→A13同步→A40生命周期→A26历史。之后转换与模板→UI命令→输出/Office→OCR/文档→其余能力→构建/CI/原生整体验收。A32自动测试贯穿每一项，末尾代表整体CI验收；A35基础构建每次执行，末尾代表独立可重复性验收。原表P3保留原始评级，执行时归低优先级P2批次。排序不删除任务，不代表已提前完成依赖项。

| Execution Order | ID | Feature | Status | Evidence | Problems | Severity | Recommended Action | Commit / Files | Test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A02 | 焦点感知与标准复制 | COMPLETE | 2026-10-15：760/1120/1440 焦点矩阵；真实 Mac NSPasteboard 文本、空选区、菜单、图形验证；见 docs/audit/2026-10-15/a02/ | 已修复辅助输入复制路由；空源码选区不清空剪贴板；只读文本与 MathLive 隐藏选区分离 | P0 | 保留自动回归；Office互操作单独在A24验收 | web/app.js；tests/focus-copy-matrix.cjs；tests/native-clipboard-probe.swift；未单独提交 | 定向矩阵 + test:editor；原生构建安装/剪贴板记录见A02证据 | 本轮仅A02；不改变文档模型/用户数据；不需要迁移；当前批次1/5 |
| 2 | A16 | 统一内容与双源码模型 | COMPLETE | 2026-10-15 FormulaContent原文/双表示/revision/来源/转换状态契约；真实Mac Typst重启往返保留cfrac；docs/audit/2026-10-15/a16/ | 已解决原文/缓存混用；派生保真明确unverified，不声称统一数学AST | P1 | 保持契约，A31事务→A25历史；复杂转换能力留A14/A17 | web/formula-content.mjs；web/app.js；web/commands.mjs；tests/formula-content*.cjs；scripts/test-editor.cjs；docs/FORMULA_CONTENT_CONTRACT.md；未单独提交 | PASS 33组回归；760/1120/1440；原生构建安装/重启 | 增量schemaVersion1；保留旧字段兼容；无文件迁移/数据删除；本批次2/5；等待用户体验，未推送 |
| 3 | A31 | Command Registry 统一程度 | COMPLETE | 2026-10-15 A31.1/.2/.3入口契约；批量scope/asset/preference/OCR桥接统一；38组回归+原生取消恢复；docs/audit/2026-10-15/a31/runtime/ | 已列明内部适配例外；通用并发/嵌套Undo所有权继续归A25，未宣称完整资产Undo | P1 | 下一项A25统一Undo所有权；完成后第五项阶段回归 | web/app.js；web/commands.mjs；web/ocr.js；tests/runtime-mutation-scope.cjs；scripts/test-editor.cjs；docs/COMMAND_MUTATION_CONTRACT.md及前两子项 | PASS 38组+3项OCR专项、原生批量取消、完整持久化数据恢复、构建安装 | 累计4/5完整A项；已安装启动；无schema变化/模型下载；未推送 |
| 4 | A25 | Undo / Redo 统一所有权 | COMPLETE | 2026-10-15 A25.1/.2：编辑/撤销/导航共用队列；失败回滚、显式子事务、字体与焦点；docs/audit/2026-10-15/a25/transactions/ | 预览绘制不持有输入锁；资产Undo、A27字段清单、A40生命周期仍独立 | P0 | 建议下一项A27，先验证现有字段覆盖；本轮停止 | web/commands.mjs；web/app.js；tests/edit-transactions.cjs；tests/undo-ownership.cjs；scripts/test-editor.cjs；docs/COMMAND_MUTATION_CONTRACT.md；未单独提交 | PASS 40组、阶段回归、离线真实OCR、原生即时Undo/Redo/模式焦点、构建安装启动 | 累计5/5，阶段回归通过；无schema迁移/模型下载；已安装等待体验，未推送 |
| 5 | A27 | History快照覆盖排版设置 | COMPLETE | 2026-10-15统一documentSnapshotSettingKeys；三模式完整设置矩阵、project/favorite/version真实字体及重启；docs/audit/2026-10-15/a27/ | 原漏字段已由前轮修复；本轮补实际字体与state不同步；inline多片段预览丢失另记A13 | P1 | A13继续检查端到端同步与多片段预览 | web/document-settings.mjs；web/commands.mjs；web/app.js；tests/history-settings.cjs；scripts/test-editor.cjs；未单独提交 | PASS 42组、构建签名安装启动、真实Mac快照打开/Undo、源码缩放 | 无schema迁移/模型下载；新批次1/5；另按用户要求修复A+/A−高亮字号；未推送 |
| 6 | A13 | Visual / Source 双向同步 | COMPLETE | 2026-10-15 inline单SVG输出、未变数学内容保留visual树；source-preview-sync；docs/audit/2026-10-15/a13/ | 复杂双语言转换保真继续归A14/A17，不声称无损AST | P0 | 下一项A40文档生命周期，依赖模型/撤销/同步已齐 | web/index.html；web/app.js；tests/source-preview-sync.cjs；scripts/test-editor.cjs；未单独提交 | PASS 43组回归、构建安装启动、真实Mac行内x+y+z+w完整预览并恢复用户公式 | 新批次2/5；无schema迁移/模型下载；备份20261015-192646；未推送 |
| 7 | A40 | 保存、重新打开与文档生命周期 | PARTIAL | 2026-10-15 Mac成对恢复/重启保存；Windows完整桥接及正式Formula.exe真实进程保存重启；docs/audit/2026-10-15/a40/WINDOWS_RUNTIME.md | 用户回复Mac尚未测试；文件选择面板交互感由用户验收；Mac发布CI仍被ocr-preview旧断言阻断（不属本轮修复） | P1 | 本轮停止；Mac保存重开确认后候选A26 | tests/windows-document-runtime.cjs；.github/workflows/release-windows.yml；既有A40实现保留 | PASS Windows CI 38740469562：真实Electron/前端/IPC/文件IO、启动/退出/重启/Ctrl+S/UndoRedo/Open/冲突/占位符；构建打包发布成功 | 无本轮产品代码变更；1.6.1；main；不新建App/OCR环境；其余39项状态保留 |
| 8 | A26 | 可查看的自动编辑History | COMPLETE | 2026-10-15技术验收：精确authority去重、事务前后记录、重启previous连续性、无效草稿/占位符、清空及4MiB边界；docs/audit/2026-10-15/a26/ | 不声明语义AST等价；仅保留收到的OCR元数据；旧记录此前已合并的信息无法重建；用户体验待验收 | P1 | 下一候选A15先复核已实现的语言/renderer解耦，不自动开始 | web/formula-history.mjs；web/app.js；tests/formula-history*.cjs；scripts/test-editor.cjs | PASS 21套相关回归、前端构建、原位签名/资源/启动及用户原文设置收藏核对 | 1.6.2 build22；History与Undo独立；A40仍PARTIAL未视为人工验收；本批次技术完成3/5 |
| 9 | A15 | 源码语言与renderer解耦 | BROKEN | `web/app.js:140–141、514`；代码明确禁止本机LaTeX+Typst源码/本机Typst+LaTeX源码；引擎切换改state.mode | 切引擎会改变源码语言；误导用户并触发有损转换 | P1 | 保留原始sourceLanguage，通过独立转换适配renderer | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 10 | A14 | 双语言复杂公式支持 | PARTIAL | `web/app.js:65、133、140–147；tex2typst0.6.2`；compatibility.json：126模板，100正向转换并本机编译，81反向解析成功 | 不支持的宏与转换器边界使双语言体验不一致 | P1 | 优先覆盖现有模板的可等价语法 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 11 | A17 | 模板库双语言完整性 | PARTIAL | `web/vendor/latexlive/catalog.js（生成产物）；scripts/sync-latexlive-catalog.mjs`；compatibility.json遍历十类126模板：原生双源0、仅LaTeX126 | UI能力被renderer规则额外限制；详见I节 | P1 | 补原生Typst与转换能力标记，先解决高频模板 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 12 | A12 | 选区感知结构变换 | COMPLETE | `web/editor-transforms.mjs；web/app.js:563–574；web/latexlive-exact.js:56`；selection-transforms：33种实际菜单点击、operand/source/preview、MathLive undo/redo、无选区placeholder通过 | 私有MathLive undo边界API风险归A25；本项仅确认结构语义回归已通过浏览器运行 | P1 | 将同类source/Typst/无选区光标行为加入矩阵 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 13 | A21 | 快捷工具 / 模板 / 二级面板 | PARTIAL | `web/latexlive-exact.js；latexlive-menus.js`；126模板渲染、selection-transforms33项、shortcut-previews通过 | 渲染通过不等于插入和转换都正确 | P1 | 自动生成完整按钮能力矩阵 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 14 | A03 | 布局与编辑上下文稳定 | COMPLETE | 2026-10-15补齐真实Mac设置Done/Escape、源码/可视化选区、60行末尾滚动、Undo/Redo恢复；760/1120/1440三模式矩阵通过；docs/audit/2026-10-15/a03-context/verification-20261015.md | 既有上下文修复已验证；本轮没有发现新缺陷，未重复实现 | P1 | 保持现有回归；下一项A31事务入口，未开始 | 本轮仅DEVELOPMENT_AUDIT.md与A03证据；产品代码沿用已安装版本 | PASS editor-context/settings-context/workspace-height/commands/audit-regressions/completion-placement；真实Mac补测 | 本批次3/5；原公式/模式/外观/收藏已恢复；无schema变更或迁移；已安装运行；未推送 |
| 15 | A05 | 基础源码编辑与导航 | PARTIAL | `web/index.html #source；web/source-assist.mjs`；source-mode、source-assist、source-candidates 通过 | textarea与全局命令层可能争夺快捷键 | P1 | 保留原生基础语义并增加真实键盘导航测试 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 16 | A28 | 键盘快捷键体系 | PARTIAL | `web/app.js:537–620；web/commands.mjs:7`；command-shortcuts、commands通过：无重复键、N/O/S/1/2/3/F/G/K/L/E等 | 已安装应用仍旧⌘E导出/⇧⌘C源码，不是当前源码新键位 | P1 | 修上下文后统一原生菜单及网页事件优先级 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 17 | A29 | macOS 菜单栏 Commands | TEST COVERAGE MISSING | `macos/Formula.swift:86–129`；Swift真实编译成功；本机AX只见旧文件/编辑菜单，新菜单尚未安装 | 代码存在不能当COMPLETE；已安装版本与源码不同 | P1 | 通过审计后安装当前候选，完整原生菜单工作流验证 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 18 | A30 | Command Palette / 上下文菜单 | PARTIAL | `web/app.js:587–606`；commands、command-shortcuts通过；panels浮层frame不变 | 搜索框标准复制存在已复现回归 | P1 | 先修编辑上下文，再收敛上下文相关命令 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 19 | A10 | 查找与替换 | PARTIAL | `web/app.js:598–604`；command-shortcuts 通过 CmdF/G/ShiftG | 查找输入框受全局复制/撤销上下文缺陷影响 | P1 | 修焦点后补最小替换流程 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 20 | A07 | LaTeX / Typst 补全 | PARTIAL | `web/source-assist.mjs:41–90；web/completion-data`；source-assist、source-candidates 通过 | Typst词表有限；LaTeX借用词库不等于插件完整功能 | P1 | 按上下文补参数结构，保持ghost不写原文 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 21 | A23 | Copy / Export 格式及分工 | PARTIAL | `web/app.js:165–228；macos/Formula.swift:136–140`；output-actions通过8种内置格式：复制payload/导出文件名；native-preview-size通过 | 不保证Word/WPS/Pages效果；单representation缺fallback | P1 | 区分复制图形与复制源码能力；增加多representation | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 22 | A24 | Word / WPS / Pages 实际兼容 | TEST COVERAGE MISSING | `macos/Formula.swift:138–140`；本轮未逐应用粘贴；仅有桥接payload验证 | 不能宣称原生可编辑公式粘贴兼容；无OMML专用写入证据 | P1 | 逐应用实测并记录版本/粘贴类型/清晰度/编辑性 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 23 | A34 | 用户资产与共享模型 | PARTIAL | `macos/Formula.swift:16–17、134；FormulaOCR.swift:9；runner:25、50`；现有OCR环境离线推理成功，无安装/下载；本轮未删除任何用户资产 | 不能称所有模型都在统一Models目录；marker/依赖检查不是权重完整性校验 | P1 | 明确共享资源清单与只读完整性检查，避免移动venv | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 24 | A18 | 离线OCR识别链路 | PARTIAL | `macos/formula-ocr-runner.py；FormulaOCR.swift；web/ocr.js`；复用现有模型离线Pix2Text单式/整页2式、UniMERNet单式成功；ocr-chain.json双引擎结果导入→格式→Typst→内置渲染通过 | 成功运行不等于识别数学正确；UniMERNet样例额外生成样式/空格 | P1 | 建立含复杂结构的标注语料，测正确率与失败恢复 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 25 | A19 | 剪贴板图片 / 图片导入 | PARTIAL | `web/ocr.js:320–341；macos/FormulaOCR.swift handleOCRRecognize`；clipboard-ocr、ocr-behavior通过（桥接模拟）；本机runner真实推理通过 | 桥接模拟不能证明原生剪贴板稳定 | P1 | 解锁后实测图片/文本混合粘贴及撤销 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 26 | A20 | PDF / DOCX 提取 | PARTIAL | `macos/FormulaDocument.swift；formula-document-runner.py；web/ocr.js`；document-behavior通过；本轮未重跑真实PDF/DOCX集成 | 不可将既有功能当尚未实现，也不能宣称本轮验证通过 | P2 | 复用已安装环境重跑document-integration，禁止重新下载模型 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 27 | A08 | 自动闭合与跳出括号 | PARTIAL | `web/source-assist.mjs:45–49、86–88`；source-assist 通过：ghost接受和已有闭合符跳出 | 与成熟编辑器的自动闭合仍有差距 | P2 | 补成对编辑语义与撤销测试 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 28 | A09 | 手写缩进与自动格式策略 | PARTIAL | `web/source-assist.mjs:71–79；web/app.js:269`；source-mode、visual-format、generated-source 通过 | 用户手写复杂结构仍需手动整理 | P2 | 增加显式缩进命令，避免实时重排 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 29 | A06 | 语法高亮与括号匹配标记 | MISSING | `web/index.html #source 为 textarea；web/source-assist.mjs`；实际源码组件无高亮层/匹配括号标记；测试也未提供该能力 | 不能称为已对标专业源码编辑器 | P2 | 先明确轻量高亮方案和不影响选区的验收条件 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 30 | A04 | 多公式及长公式完整可见 | COMPLETE | `web/v1.1.css:244–245`；probes.json：1/10/50 行；50行 scrollHeight5214、首端top1、末端bottom−0.75；长公式横向6863px两端可达 | 不代表所有 renderer 或遮罩组合已验证 | P2 | 把本次1/10/50与横向边界探针转为正式CI断言 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 31 | A11 | 自动生成源码格式规范 | COMPLETE | `web/format-latex.mjs；scripts/sync-latexlive-catalog.mjs；docs/GENERATED_SOURCE_STANDARD.md`；generated-source、visual-format、template-generated-source、ocr-format 通过；126模板MathJax实际渲染+幂等 | 复杂自定义宏仍保守处理；不可把幂等当作数学语义证明 | P2 | 加入更多宏/注释/Typst文档保真样本 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 32 | A22 | 自定义工具栏 | COMPLETE | `web/app.js:296–410；web/v1.1.css工具区`；custom-toolbar重测通过：真实drag增删排序、持久化、模式、恢复默认；panels frame稳定 | 全局菜单/快捷键风险不由此项保证 | P2 | 保留当前回归并补最小宽度溢出断言 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 33 | A36 | 错误输入与Last Valid Preview | COMPLETE | `web/app.js:68–75、85–123`；last-valid-preview通过：保留上一有效图像，禁止导出陈旧结果 | 本项结论限已测失效/恢复场景 | P2 | 维持陈旧结果不可导出的回归约束 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 34 | A39 | 收藏公式图形展示 | COMPLETE | `web/app.js:206–210；web/v1.1.css:223–224`；compact-layout与custom-toolbar/现有渲染路径通过；代码渲染SVG到收藏card | 本项只确认图形展示基础路径，不将其当自动History | P2 | 补复杂宏fallback与收藏搜索 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 35 | A37 | 输出字体与无闪烁切换 | COMPLETE | `web/app.js MathJax字体加载/渲染；web/v1.1.css`；math-fonts、font-controls、font-native-reload通过 | 浏览器测试不代替用户对所有Mac显示器的闪烁感受 | P3 | 补原生视觉冒烟，不扩大字体UI | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 36 | A38 | 独立编辑缩放与输出字号 | COMPLETE | `web/app.js editor-size/output-size；Formula.swift render`；editor-zoom、native-preview-size通过 | 保留各自状态，不重新合并缩放 | P3 | 保持回归测试 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 37 | A01 | 任务驱动工作流 | PARTIAL | `web/index.html；web/app.js:539–606`；commands、output-actions、ocr-behavior 通过 | 低频工具仍有重叠入口；不能以入口齐全代表任务闭环 | P1 | 先修上下文和编辑连续性，再做任务效率对比 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 38 | A35 | 本机安装与构建可重复性 | ARCHITECTURE RISK | `scripts/install-local.sh`；npm build:vendor成功；当前Swift真实编译成功；应用bundle hash与工作区不同 | 不能称干净通用构建；资源更新可能漏复制，安装不能等同代码构建 | P1 | 先补产物清单/回滚，再安装经验证候选 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 39 | A32 | 自动测试体系与CI | PARTIAL | `.github/workflows；tests/*.cjs；docs/audit/2026-10-14/test-summary.json`；本轮30个JS脚本29通过1失败；Python OCR单元2项通过 | 绿色旧CI不能证明本轮新架构；旧测试等待已删除#input-color超时 | P1 | 整理统一测试入口，新增高风险测试接CI并修旧断言 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |
| 40 | A33 | 真实Mac完整工作流 | TEST COVERAGE MISSING | `/Applications/Formula.app；本轮CUA记录`；连接运行中应用成功、读到公式与旧菜单；后续操作无响应且截图不可用，已请求解锁 | 不得把headless或已有进程当新版本真实验收通过 | P1 | 解锁后按19步清单实测，保留用户原公式/设置 | — | 沿用历史记录；待该项重新验证 | 未在本轮验收；保留原始任务范围 |

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

- 当前状态：**COMPLETE**（2026-10-15补充技术验收，等待用户体验）。
- 实现：统一独立UI上下文捕获/恢复，标签不抢焦点；设置/命令/历史/tool关闭恢复选区与滚动。132px工具区、116px卡片、200px编辑/预览固定占位；品牌栏移除、OCR仅工作时动态进度。
- 自动证据：760/1120/1440三模式100行矩阵、设置关闭/滚动/框架、命令与Undo回归。
- 原生证据：源码设置Done与可视化设置Escape选区保留；60行公式末尾滚动经设置返回不变；Undo/Redo/Undo恢复原文与预览；磁盘数据核对原公式/模式/外观/收藏一致。
- 本轮没有新增产品代码，复核已安装版本；详见 `docs/audit/2026-10-15/a03-context/verification-20261015.md`。
- 边界：A25统一历史所有权和A33全产品原生工作流仍独立验收，本项不替代它们。

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

- 当前状态：**COMPLETE**（技术验证完成，等待用户体验）。
- 根因1：MathJax4行内公式默认拆多个SVG，应用只提取首个；x+y+z+w复现4片段但预览缺后续项。设置svg.linebreaks.inline=false保留行内数学样式，生成完整单SVG供预览/导出。
- 根因2：readSource无条件mf.setValue重建树，未变源码也抹去visual占位符和选区；现在visual数学内容相同时保留原树，实际源码变化仍同步更新。
- 回归：source-preview-sync覆盖全部glyph/导出元数据、重复读取placeholder/selection、Typst→visual修饰→LaTeX及Undo/Redo、错误输入保留和修正；43组测试全部通过，含原内容契约、History、生成格式与布局矩阵。
- 原生：备份20261015-192646，正常/Applications/Formula.app构建签名安装启动；实际设置行内x+y+z+w截图四变量/三加号完整，随后两次Undo恢复最新用户公式及黄色背景。源码/模式/输出设置/缩放/收藏与测试前一致。
- 边界：不扩张转换能力，复杂语义保真继续A14/A17；无数据结构迁移/模型操作，未推送GitHub。新批次累计2/5。
- 证据：docs/audit/2026-10-15/a13/README.md、editor-tests.log、install.log。

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

- 当前状态：**COMPLETE**（2026-10-15技术验收，等待用户体验）。
- 已实现：FormulaContent权威原文、带来源版本的双representation、转换状态及exact/unverified保真边界；编辑失效、切换/输出缓存复用、快照/持久化/旧配置兼容。
- 证据：`docs/audit/2026-10-15/a16/README.md`、33组回归、三种宽度、真实Mac Typst重启返回LaTeX仍保留cfrac。
- 边界：不声称语义AST或无损双向转换；A14/A17转换覆盖、A31/A25事务、A26History策略、A40文档身份依然各自保留。
- 原始风险和兼容性探针为2026-10-14历史证据，见I节及初始报告；新状态以B表为准。

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

- 当前状态：**COMPLETE**（A25.1/.2技术验收；等待用户实际体验，不代表已获发布授权）。
- 原因：可视化placeholder-only编辑被签名去重；异步editTransaction在finally才记录，Undo可越过正在执行的修改；失败编辑也错误记入历史。
- 修改：transaction/go/Undo/Redo共用顺序所有权；显式child context合并同一事务，Registry别名只委托叶事务；失败恢复文档/选区及原redo分支，双重恢复失败明确AggregateError；字体加载与commit统一事务；排队设置在执行时判断no-op；记录完成后通知自动History。
- 编辑连续性：异步状态修改短暂保护输入表面并保留焦点意图；普通预览绘制不持有Undo输入锁，旧渲染由revision guard丢弃；无布局改动。
- 测试：tests/edit-transactions.cjs、undo-ownership.cjs；40组编辑器回归全部通过。含Visual/LaTeX/Typst、Undo/Redo/History、760/1120/1440、生成源码及126模板渲染。阶段回归含离线真实基础单图/整页2公式、专业单图、文档解析、原生输出/工具链。
- 原生：备份安装 /Applications/Formula.app（20261015-151859）并启动；立即字号Undo/Redo、模式撤销、Typst焦点、Undo后立即输入+2通过，随后恢复原公式。资源SHA256匹配；原源码、模式、输出设置、收藏一致。
- 数据/边界：无schema迁移/模型下载/用户资产删除。A26产品History、A27快照字段覆盖、A40生命周期、资产Undo及A24 Office验收不由本项替代。
- 证据：docs/audit/2026-10-15/a25/transactions/README.md、STAGE_REGRESSION.md及日志。累计主项5/5，阶段回归已执行；未推送GitHub。下一项建议A27，本轮未开始。

#### A26 可查看的自动编辑History

- 当前状态：**COMPLETE（本轮定义的数据与自动验证条件通过，等待用户体验）**。用户明确要求继续下一轮，未把该要求当作A40人工验收，A40状态保持PARTIAL。
- 问题证据：旧formulaIdentity按去空白的渲染LaTeX合并记录，新测试实际复现不同authority只剩1条；previous未序列化导致重启后的Before断链；1.8秒定时记录无法确保快速连续导入都保留；跳过无效源码；旧清空仅清recent而未清versions，重载可能重新补入。
- 修改：最近公式按精确原始authority语言/文本标识（旧无模型记录保守兼容）；内容版本比较authority元数据与可编辑占位符。纯表示/设置切换更新完整快照而不伪造内容变化。快照深拷贝，previous成对持久化，旧数据按已保存快照恢复链并过滤畸形条目。
- 记录：文档事务前保留当前状态、成功后记录完整结果；输入仍按既有450ms分组点记录，保留来源命令标题；无效/空公式和新建可进入变化链。History资产与Undo栈完全分开，Undo新分支不截断用户History。恢复旧版本沿用Command和事务层，支持视觉占位符及继续编辑。
- 清理/容量：现有按钮改为“清空全部历史”，清recent/versions/previous；当前文档和Undo不变，活动内容签名避免未编辑的重启/查看将清空结果立即补入。100条与100版本、合计4MiB UTF-8上限，超大记录明确提示且不影响当前编辑或旧History。
- 自动测试：新增formula-history与formula-history-editor，覆盖精确原文去重、重启链、快速导入、搜索、恢复/编辑/Undo/Redo、旧分支、收到的OCR字段、无效草稿、占位符、清空重载、容量、旧数据。21套相关回归全部通过，含模板126渲染、OCR/文档/剪贴板接口、批量、输出、事务与设置。
- 部署：前端构建通过；用户保存退出后原位更新同一/Applications/Formula.app为1.6.2 build22，复用未改变的既有native可执行文件；资源SHA256、ad-hoc签名验证和启动进程通过。原authority、表示、设置、收藏逐字段一致；不创建DEV/Test/临时bundle，不触碰OCR环境/model。详细证据见a26目录。
- 边界：只保证现有FormulaContent中收到的来源/识别元数据保存，不能重构上游未传入或旧版本已合并丢弃的原始识别数据；不宣称统一数学AST、每个按键单独一个版本、无限历史或绕过localStorage总配额。配额错误保持当前公式与已有持久化数据，并提示历史空间不足。用户的实际交互验收仍待反馈。
- 下一候选：A15 — 源码语言与renderer解耦，先复核既有实现及原表BROKEN证据是否过时；本轮不开始。

#### A27 History快照覆盖排版设置

- 当前状态：**COMPLETE**（等待用户体验，未推送）。
- 旧透明/scale/displayMode/mathFont遗漏已在前轮修复，本轮验证后保留。新增统一字段清单覆盖size/padding/scale/color/backgroundColor/preamble/typstPreamble/displayMode/mathFont及兼容transparent，捕获/去重/恢复共用。
- 复现并修复：恢复Bonum快照时state/UI为bonum而实际MathJax仍Newcm；共享restore现在加载真实字体，并将异步恢复结果传递到project/SVG/favorite/History事务。
- 测试：history-settings检查全部字段签名、三编辑模式Undo/Redo、project/favorite/version还原及MathJax字体类型、History持久化重载。42组编辑器回归通过。
- 用户追加：输入A+/A−只改textarea大小，绘制层仍16px；applyEditorZoom同步刷新绘制层。editor-zoom-paint覆盖LaTeX/Typst可见字号、可视化独立字号、选区/历史/导出字号不变、重启与760/1120/1440。
- 原生：正常备份安装启动（20261015-152546）；打开临时mathforge验证Bonum/38pt/20px/红色/蓝背景/600DPI并Undo回原值；源码A+图形检查后恢复原缩放和可视化模式。原源码/模式/设置/收藏匹配。
- 无schema迁移/模型操作/资产删除。新批次累计1/5。
- 下一项A13：原生测试另发现inline模式MathJax多SVG片段只提取首个，源码完整但预览残缺；记入A13处理，不混淆设置快照状态。

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

- 当前状态：**COMPLETE**，2026-10-15 A31.1/A31.2/A31.3技术验收完成，等待用户体验。
- 范围：文档、资产、偏好、运行时命令入口已分类和收敛；context/metadata/错误刷新；收藏/导入、验证后设置/字体/模式别名、批量scope、工具栏、历史资产、配置及OCR桥接适配。
- 证据：38组回归、OCR单图/多结果/文档/取消/错误专项、真实Mac批量保存取消后完整state恢复；见 `docs/audit/2026-10-15/a31/runtime/README.md`。
- 内部适配例外：输入/IME/MathLive事件、渲染/初始化/Undo恢复、焦点/选择、OCR进度等不逐事件命令化，边界见 `docs/COMMAND_MUTATION_CONTRACT.md`。
- 不宣称A25统一历史所有权、通用异步串行/回滚或全部用户资产Undo完成；这些范围保留在对应A项。

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

- 当前状态：**PARTIAL**。A40.1/.2既有能力保留，本轮补齐 macOS 重启身份与保存保护的自动验证及必要修复；不把自动验证等同于用户本机体验验收。
- 选择依据：A16内容契约→A31命令→A25撤销→A27设置快照→A13同步已完成；A40是A26持久化历史和A01/A33流程闭环的前置状态边界。
- 初始证据：文件URL/摘要重启代码已存在，但测试仅覆盖摘要工具；state.json与document-session.json分开写入，可能恢复不匹配的草稿/文件身份。实际native saveProject方法测试复现旧Save As面板在换文档后仍写文件。
- 修改：单条state消息携带内容及dirty身份，native将草稿、id、savedSignature及host拥有的URL/摘要原子写入同一会话记录；保存成功在回复前写入同一记录。老的分离记录保留，但不再用其路径绑定无法确认配对的草稿；保留state.json兼容读取，因此升级首次保存可能需要选址。
- 文件保护：Save As确认时再次检查documentID；打开文件的摘要来自实际读取字节，避免回调期间外部改动被误当作基线；失败token清理。外部修改/删除阻止原位保存；取消/失败不把前端标为已保存。
- 对象连续性：当前编辑表示纳入dirty签名；重新打开visual文件恢复仍可编辑的占位符树。原精确源码、FormulaContent双表示/来源字段、排版设置均随文件保存；不修改OCR环境、转换器、History政策或工具栏布局。
- 自动验证：document-roundtrip浏览器+真实临时文件覆盖保存→新页面重启→新建→重新打开→编辑→Undo/Redo、Typst中的原始LaTeX、背景、visual占位符及无效草稿。native-document-save使用实际生产Swift方法、实际文件IO和两个独立Swift进程，覆盖取消/失败/重启原位保存/外部冲突/旧面板保护/读取摘要/token及旧记录身份隔离；只模拟文件面板确认回调，不创建App bundle或触碰用户数据。
- 回归：21个相关套件最终通过；首次selection-transforms/template-generated-source因迁移目录缺失被忽略的LaTeXLive离线资源而超时，复用既有正式App资源后原断言重测通过（126模板），未削弱测试。另native摘要测试通过；web构建及当前Swift编译通过，保留两处既有allowedFileTypes弃用警告。
- 部署：按用户要求原位更新同一/Applications/Formula.app至1.6.1（build21），不新建DEV/测试/临时bundle；应用退出后更换可执行文件与资源，保留正式ID及用户数据/model路径。具体签名、启动与状态核对结果见本轮证据。
- 后续增量：Windows的saveProject、原位保存/另存为、Open token和成对启动恢复桥接已补齐，9套相关测试通过；见docs/audit/2026-10-15/a40/WINDOWS_SAVE.md。后续在Windows CI 38740469562已实际启动生成的正式Formula.exe，前端/IPC/文件IO/退出重启/原位Ctrl+S/Open/占位符链路均通过（原生面板选择由测试提供），打包发布成功。用户明确回复Mac尚未测试，整项仍PARTIAL；见docs/audit/2026-10-15/a40/WINDOWS_RUNTIME.md。未保证断电时尚在JS/native异步队列中的输入持久化，也未声称抵御不协作进程在摘要核验后立即并发覆写。不能将A40整项标COMPLETE。
- 下一候选：A40剩余跨平台/人工验收闭环；Mac本轮确认后可评估A26 — 可查看的自动编辑History。不自动开始。
- 证据：docs/audit/2026-10-15/a40/RESTART_SAVE.md、对应测试输出。其他39项状态未更改。

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
- A27 History快照覆盖排版设置：已于2026-10-15验证并修复，详见原表和A27证据。

## G. ARCHITECTURE RISKS

- A16 统一内容与双源码模型：并非简单字符串替换库，但应用层仍依赖字符串双转，不能承诺无损。
- A25 Undo / Redo 统一所有权：已于2026-10-15完成A25.1/.2并通过阶段回归；保留此条作为原始风险的处理记录。
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


## P. 收尾交互优化（本地，待体验）

- 高级子级使用共享 `--settings-indent`，三角标、标题、内容共同缩进。
- 删除图片单公式/整页配置，图片选择及剪贴板图片统一请求 page 检测；默认选第一项，后续点击为互斥激活，可取消当前项，不重跑 OCR。空结果显示简洁提示。
- PDF 保留用户确认的 1/0 默认值；内部兼容 0/0，统一页范围函数将零起始值转换为第1页，并将默认范围限制在20页和实际页数内。
- 版本历史复用完整 before/after snapshot 和 MathJax，固定预览区；单击不改当前文档，双击/恢复加载 after，保留原文进入历史，操作进入撤销链。
- 新增 finish-ux 编辑器集成及 document-range 原生测试；原有 OCR 测试更新为新结果选择语义。
- 本轮未经再次授权不推送；发布版本仍为 v1.6.0，以上为后续本地修改。


### 补全候选定位

旧逻辑将 y+line 限制到 clientHeight-130，导致底部候选框被推回当前行。现通过 completion-placement.mjs 统一计算：下方可容纳则 below，上方可容纳则 above，否则取空间较大侧并限高滚动；水平位置受可视宽度约束。LaTeX/Typst 复用同一定位层，滚动、resize、ResizeObserver 和祖先样式变化触发定位，不重置候选高亮。高亮项始终滚入列表可视区。

源码着色层的 pre 继承了通用 max-height:140px，真实 WebKit 测试中末行被裁切；移除该上限，交由编辑器 paint frame 单层裁剪。补全对部分可见行采用相交判定，不错误隐藏底部候选。

新增 completion-placement.cjs 覆盖方向、当前行避让、右边界、字号、窗口、长列表滚动、LaTeX/Typst及键盘接受；source-surface 测试补充绘制层无独立滚动/高度限制断言。


### 设置折叠层级及输出选项分组补正

设置每个details的summary之后均使用统一settings-disclosure-content容器，padding-inline-start共享18px token；覆盖导言区/前置代码、批量导出、高级及其子项、最近编译日志，不再只针对高级写特例。分辨率移入右侧export-format-options，与格式选择相邻；位图可用/矢量禁用语义保留并保持占位。

settings-disclosure集成测试检查所有展开内容缩进、无横向越界、编辑区frame不变；另检查分辨率/格式同组且切换格式分组frame稳定。已跑PNG DPI、output-actions、finish-ux、ocr-layout及reference-layout相关回归。未经用户确认不推送。


### 字体/背景颜色与字号顺序

字体色默认黑，背景默认透明，替代原透明按钮；独立最近10种颜色存本地，不把Undo操作写进颜色历史。backgroundColor为背景状态，transparent保留为旧数据兼容；旧不透明背景映射白色。SVG背景矩形严格等于公式viewBox加四边padding，PNG/JPEG像素实测；native PDF以矢量绘制补背景并保持media bounds，Typst/SVG/元数据传递新颜色。Windows接线并语法检查，未Windows实机测试。背景进入保存/恢复/撤销快照。

两组字号控件只交换DOM顺序为A+、A−，共用scale-control外观和原事件。


## 历史增量记录（非第二任务清单）

2026-10-15此前曾按分组安排工作；该分组台账已撤销，全部40项保留在B表，唯一执行顺序与验收状态以B表为准。

此前已修复“未修改派生源码复制/导出重解析覆盖原LaTeX”，真实Mac与自动测试证明cfrac保留；此证据不等同于A16完整representation契约完成。A03已有设置上下文捕获/恢复改动及浏览器测试，完整验收仍留在A03，未在本轮标为完成。

本轮只处理A02；详细构建、测试、原生验证及风险见 `docs/audit/2026-10-15/a02/README.md`。完成本项后停止，下一项建议A16，尚未开始。
