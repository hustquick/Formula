# 开发与任务流程审计

日期：2026-10-14。主分支发布基线1.5.1；当前开发分支feature/clipboard-ocr，包含PR9剪贴板/图片拖入，以及未推送的共享OCR路径、本机安装脚本、AGENTS规则。不要将开发能力写成已发布能力。实际应用名称Formula，bundle ID org.mathforge.desktop，不擅自改成Formular。

## 实现位置与差距

| 项目 | 当前实现位置 | 结论与缺口 |
|---|---|---|
| 输入 | web/app.js readSource/importContent；macos/Formula.swift importFile；web/ocr.js paste/drop | 源码、模板、MathLive、图片/PDF/DOCX已有；剪贴板及单图片拖入为开发能力；文件类型统一拖入缺失 |
| 编辑模式 | web/app.js setInputPane/switchMode，约130/406行 | 源码/可视化用户可切换，但mf.focus重写会主动切可视化；工具插入也聚焦MathLive，违背源码任务连续性 |
| 统一模型 | web/app.js state.latex/rawSource、tex2typst/typst2tex、mf.setValue | 有LaTeX规范表示和原文，但不是跨引擎无损AST；Typst文档语法存在不可转换边界，不应重写为虚假的统一AST |
| 预览 | web/app.js scheduleRender/invalidate，约58/75行 | debounce、renderID防旧结果覆盖已有；invalidate清空预览，无Last Valid Preview；原生预览与实时编辑需解耦 |
| 复制导出 | web/app.js exportFile，约165行；macos/Formula.swift copyImage，约99行 | 固定格式选择+复制/导出；每次图形复制只送所选representation，未配PNGfallback/专有恢复UTI |
| Office粘贴 | 上述copyImage与MathML文本 | Word/Pages/WPS无实际粘贴验收，不能称原生公式兼容；需区分图形清晰度和可编辑公式 |
| 模板 | web/latexlive-exact.js rebuildTemplates/rebuildShortcuts、latexlive-menus.js | 完整十类、浮动面板、方向键与Esc；无搜索、最近使用排序；插入切模式风险 |
| 收藏 | web/app.js history()约196行、remember约505行；#history | state.history其实是主动收藏，SVG自适应预览已有；无自动History，不能直接挪用旧字段，否则丢用户收藏 |
| OCR | web/ocr.js；macos/FormulaOCR.swift handleOCRRecognize/ocrInstalled；formula-ocr-runner.py | 两种模型、MFD、多公式选择、修复取消已有；文件单公式直接写入，剪贴板先候选确认，语义不统一；缺区域选择与置信度基线 |
| 文档 | macos/FormulaDocument.swift、formula-document-runner.py | PDF最多20页，DOCX原生和图片公式按顺序；不是完整文档工作台；此能力已实现，不能当未来才支持 |
| 数据 | macos/Formula.swift support/state.json、UserDefaults.standard；web/app.js persist | MathForge/state.json含收藏/设置，工具路径使用正式bundle偏好；浏览器localStorage作镜像，需明确权威与迁移 |
| 模型 | FormulaOCR.swift ocrRoot约9行、ready markers；runner root/models | 现有固定MathForge/OCR及3.5GB资源应保留；本地改为独立于support根。ready+Python检查不是全部模型hash完整性验证，启动不能凭marker声称完整 |
| 缓存/临时 | FormulaOCR.swift image/page文件、Formula.swift render临时目录/DragExports | 部分临时文件清理已有；运行资源不能迁移venv绝对路径，日志/调试可独立 |
| 系统集成 | Formula.swift makeMenu、NSDraggingSource | 标准编辑菜单与Option拖出；未实现Services/Share/统一文件拖入；更新和诊断缺失 |
| 安装 | scripts/install-local.sh（本地未推送） | 保持正式ID与模型路径，备份替换；当前复用已安装vendor，尚不是干净可重复构建；失败回滚及资源合约须加强 |

## 空间稳定与交互风险

已执行Chromium 1120×860：quick/templates/favorites/custom普通切换均tool-deck=100px，编辑区y=293、预览y=509。此结果仅证明这个窗口尺寸及路径，不证明所有系统/状态。

web/v1.1.css约100行固定100px，但custom覆盖height:auto/min-height；其grid第二行容纳options。虽现有options固定定位，后续内容变化仍存在自动高度风险。821px以下缺统一工具区高度约束；默认窗口最小宽760，属于真实可触达风险。OCR覆盖100px并滚动，Advanced/results可能在狭小范围拥挤但不应增高。

web/app.js mf.focus覆盖与Escape后mf.focus，以及latexlive-exact.js insertLatex/closeAllFloating，是焦点/模式连续性的主要风险。源码readSource持续mf.setValue可能影响结构Undo；源码textarea未实现跨操作统一undo。必须分别测原生文本和MathLive历史，不能假定都连续。

## LVSM、重复与入口

- 普通用户输入→预览→复制已短；格式能力、转换失败、粘贴目标需要更明确但不应常驻更多控件。
- 图片文件与剪贴板结果确认语义不同；文档多公式即时组合替换，丢失原编辑内容的恢复成本高。
- state.history/#history名与真实Favorites不符，容易导致自动记录与主动收藏混淆。
- 字体/局部样式已拆分，编辑显示缩放/输出字号已拆分，不应重新合并。
- 用户复用以前公式需主动收藏，缺History造成重复输入。
- 原生文件菜单FormulaAction('import')仍引用已移除#import，而Ctrl/Cmd+O走FormulaChooseImport；同一任务两条路径不一致（web/app.js约236行）。
- 设置中有旧批量导出入口，但不等于文档级批量workspace。不新增另一套重复流程。
- 键盘⌘E现为导出SVG，与提案“可视化模式”冲突；⌘⇧C现为源码复制，不应静默改义。

## LaTeXiT 对比（官方能力说明，非本机测试）

来源：https://www.chachatelier.fr/latexit/latexit-features.php?lang=en 与官方downloads/changelog。
已在能力类别上对齐：本机TeX、PDF及图形导出、部分源码恢复、手动收藏/库、前置宏包配置。尚未对齐：独立自动历史、Services、成熟跨软件拖拽/剪贴板、完整语法编辑辅助。Formula优势：LaTeX+Typst、MathLive结构编辑、离线数学字体/模板、两级OCR和PDF/DOCX公式提取。上述是功能比较，不是等价体验或准确率结论。

## 优先级与第一轮文件

P0：固定布局；禁止隐式模式切换/保留编辑上下文；Last Valid Preview和禁止导出陈旧结果；输入/输出clipboard语义及原生导入入口回归。
P1：自动History与收藏分开；历史搜索/恢复/置顶；模板/收藏搜索与近用；共享OCR完整性检查（不重复下载）；逐目标粘贴验证。
P2：补全/ghost bracket、可恢复PNG/custom UTI、Services、文档workspace、Continuity。只评估，不全塞第一轮。

第一轮准备修改：web/app.js（预览状态与上下文、导入入口）、web/v1.1.css（稳定占位）、web/latexlive-exact.js（插入与焦点）、web/ocr.js（输入确认与稳定状态）；新增tests/task-continuity.cjs、tests/last-valid-preview.cjs、tests/layout-stability.cjs。随后单独History模块web/formula-history.js及测试，不重命名或清空旧state.history。原生剪贴板改动在另一轮Formula.swift/测试中实现。每项小提交。

本轮只审计文档，不启动功能实现；既有未提交改动保留。此轮不重新构建/安装，不推送。
