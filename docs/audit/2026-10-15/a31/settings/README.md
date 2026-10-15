# A31.2 — 排版设置与编辑适配入口

2026-10-15。子项COMPLETE；A31主项PARTIAL，仅剩A31.3入口范围，本批完整A项仍3/5。

## 原问题及修复

原change监听先改state再验证，非法字号可能写入状态和历史；字体异步加载与独立历史监听时机错开。各设置直接修改状态，模式快捷键别名与按钮的事务行为不一致。

新增document-settings.mjs字段白名单与类型/范围验证，统一setDocumentSetting；字号/留白/DPI/字体色/背景色/导言/Typst前置/displayMode/font共用入口。非法输入恢复控件，不改变state/Undo；相同值不生成历史。移除直接修改和并行record监听。同步设置仅在状态提交期间持有事务，随后等待渲染，避免全程吞输入事件。

字体先成功加载，再经事务提交；加载失败保持旧字体与历史。Undo恢复字体直接调用渲染适配，不再次执行用户命令。独立缩放走setEditorZoom preference命令，不消耗文档Undo。模式别名委托switchLatex/switchVisual，鼠标/键盘共用事务。原生typing/IME/缩进/MathLive输入仍使用原有RevisionHistory调度适配；没有把每次按键变成Registry命令，也不提前宣称A25所有权验收。

文件：web/app.js、web/document-settings.mjs、tests/document-settings-command.cjs、scripts/test-editor.cjs、docs/COMMAND_MUTATION_CONTRACT.md、DEVELOPMENT_AUDIT.md和本证据目录。没有UI布局更改。

## 实际测试

PASS document-settings-command：非法数值/范围/颜色/字体/类型；每个设置单事务与Undo/Redo；source authority不变；UI只分发一次；字体加载失败不生成空revision；缩放不占文档历史；模式别名Undo/Redo。
PASS test:editor全部37组，见editor-tests.log（最后白名单布尔拒绝和别名metadata补充后，重新构建并重跑定向测试通过）。覆盖Visual/LaTeX/Typst/Undo/Redo/History、760/1120/1440布局与上下文。
PASS 额外font-controls、font-native-reload、editor-zoom：字体菜单与样式/边界、旧native snapshot情况下保留编辑原文、双缩放持久化。
PASS build:vendor、Swift编译、离线清单与签名验证；node --check app.js/document-settings.mjs；git diff --check。项目无单独lint/typecheck脚本。

PASS 原生CUA：输出A+将36→38，预览761×149→803×156；源码聚焦CmdZ→36、ShiftCmdZ→38、CmdZ→36；字号输入999后Tab拒绝并恢复36，预览原样。最后恢复正常预览状态。磁盘数据比对rawSource/latex/editorMode/size/padding/color/background/scale/history/mathFont与安装前全部一致；没有新增/删除用户收藏。

## 部署与边界

已备份安装并启动/Applications/Formula.app；备份~/Library/Application Support/Formula-Backups/20261015-143226/Formula.app。安装bundle与工作区逐字节一致。模型/路径未动，数据schema未变，无迁移或下载。

保留现有转换、渲染与错误提示。没有声称所有并发字体/异步命令已经串行化；事务完整所有权仍属于A25。批量、工具栏、History资产及运行时配置留A31.3，不在本轮顺手扩展。

等待用户体验：设置后一步撤销、字体失败保留原状态、模式快捷键与按钮一致。GitHub未推送/合并/发布，未将当前历史脏工作区混合提交。下一项建议A31.3，尚未开始。
