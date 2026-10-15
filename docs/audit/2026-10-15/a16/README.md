# A16 — 统一内容与双源码模型

日期：2026-10-15。技术验收状态：COMPLETE；等待用户实际体验，未发布。原40项审计主表继续为唯一任务清单；本轮仅A16，累计2/5。下一项建议A31，未开始。

## 原问题与实现

此前rawSource/latex/editorMode缺乏表示来源与版本；未修改派生Typst在重载/恢复时可能反向解析，覆盖原始LaTeX。新增FormulaContent权威原文/双表示契约，明确revision、origin、sourceLanguage、original/derived、exact/unverified、转换可用性/错误。见docs/FORMULA_CONTENT_CONTRACT.md。

切换、备用源码和输出共用表示缓存；实际编辑使旧缓存失效；未编辑可视化不会把规范化结果当新原文。输入错误保留原文，失败转换记录诊断。新建、模板、导入、可视化/源码修改、保存、快照与恢复接入同一契约。Undo签名纳入authority，避免同一派生字符串掩盖不同原文。

旧数据按当前语言/原文增量采用；旧LaTeX缓存不无条件信任。保留既有pre-1.4.1语言错配修复。旧字段继续作为兼容投影供renderer/native使用，不把它们当两份独立文档。新增schema，不移动/删除任何用户文件，不下载模型。

## 文件

web/formula-content.mjs；web/app.js；web/commands.mjs；tests/formula-content.cjs；tests/formula-content-editor.cjs；scripts/test-editor.cjs；docs/FORMULA_CONTENT_CONTRACT.md；DEVELOPMENT_AUDIT.md及本目录证据。

## 实际测试

- PASS 单元：权威源、来源/版本、缓存失效、持久化、失败转换、无效语言、Undo签名。
- PASS 真实浏览器编辑链：原文含空白；LaTeX→Typst→reload→LaTeX保留cfrac；无编辑Visual往返；编辑Typst使旧LaTeX失效；Undo/Redo恢复正确authority；History携带模型；项目保存快照/导入；无效输入阻止破坏性切换。
- PASS 定向集成附加760/1120/1440宽度：四次模式切换，核心编辑区y/height不变，原文仍精确保留。
- PASS npm run test:editor：33组全部通过，完整输出editor-tests.log。包含A02焦点复制、源码/补全/格式化/选区结构、commands/revisions、History、输出与OCR布局等已有回归。
- PASS node --check web/app.js、web/formula-content.mjs、web/commands.mjs；git diff --check。项目没有独立lint/typecheck脚本。
- PASS build:vendor、Swift原生编译、资源清单和签名校验；已安装bundle与工作区逐字节相同。

初次定向测试发现旧版语言错配修复顺序被新缓存提前执行阻断，已将旧修复移到模型采用前，source-mode完整通过。History初次断言早于既有1800ms自动记录，改为等待真实记录，不改变产品节奏。最终无未解决失败。

## 本机与边界

安装并启动/Applications/Formula.app，org.mathforge.desktop不变。备份~/Library/Application Support/Formula-Backups/20261015-094004/Formula.app，日志install.log。

CUA真实原生验证：旧版cfrac公式启动；切Typst显示1/x；正常退出、重启后仍为Typst；返回LaTeX显示原始cfrac；输出预览状态正常。磁盘state.json确实携带两个同版本表示及原始authority。公式、模式及size/padding/color/background/scale与安装前一致。后续可视化原生点击遇到用户界面变化保护，未强行操作；可视化/Undo/Redo/History证据来自真实浏览器集成，未冒充全部原生实测。

这不是数学AST，派生保真标记为unverified，不能保证现有转换器的全部数学语义；复杂语言覆盖留A14/A17。文档身份/恢复留A40，事务所有权留A31/A25，History策略留A26。本项为明确representation契约并集成，不把这些任务提前标完成。

GitHub未推送/未合并/未发布。本地工作区仍包含此前未发布改动，未将不相关项混合提交。等待用户体验跨语言切换、重启后的原文保留与继续编辑。
