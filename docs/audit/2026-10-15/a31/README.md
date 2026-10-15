# A31.1 — 命令契约、收藏和导入入口

2026-10-15。子项COMPLETE，A31主项PARTIAL。只处理本A项，不启动A25或其他A项。本批完整项计数仍3/5。

## 原问题

Registry.context定义未执行；收藏恢复与删除、浏览器文件导入绕过Registry；恢复收藏不形成统一文档事务；收藏保存重复解析未修改的派生Typst，可能覆盖原始LaTeX；导入safe包装吞掉异常使命令误判成功。

## 修改

enabled(id,args)同时检查enabled/context，拒绝不合法索引；execute失败仍刷新状态但保留异常。命令列表暴露mutation类别，既有文档命令标document。收藏restoreFavorite走现有editTransaction，可撤销；rememberFormula/removeFavorite标asset，不增加当前文档Undo；保存未改源码不反向解析。浏览器文件导入与native/OCR统一importContent命令；处理器直接调用实现并传播失败，外部原生回调经onError显示错误。

新增docs/COMMAND_MUTATION_CONTRACT.md实际入口清单和剩余范围，不另建40项列表。剩余：A31.2排版/前置代码/模式别名/编辑器适配边界；A31.3批量临时状态、工具栏/History资产与原生配置边界。它们未完成，因此不将A31主项勾完。完整回滚、异步串行化及A25历史所有权不在本子项宣称范围。

文件：web/commands.mjs、web/app.js、tests/command-mutation-contract.cjs、scripts/test-editor.cjs、docs/COMMAND_MUTATION_CONTRACT.md、DEVELOPMENT_AUDIT.md及本证据目录。

## 验证

PASS 新定向测试：context合法/拒绝、metadata、异常后状态刷新；收藏精确保留cfrac；资产保存/删除不消耗文档Undo；收藏恢复Undo/Redo；错误索引no-op；无效导入抛出且原文/历史不变；真实浏览器filechooser导入走一次Registry且可撤销。
PASS npm run test:editor全部36组，完整日志editor-tests.log，含Visual/LaTeX/Typst/Undo/Redo/History、三种宽度上下文、选区变换、颜色/输出/源格式化、OCR布局等回归。
PASS build:vendor、Swift原生编译、资源清单、签名验证、node --check web/app.js/web/commands.mjs、git diff --check。无独立lint/typecheck脚本，未冒称运行。

PASS 真实Mac：收藏夹点击原有E=mc²，源码及预览恢复、字号22/颜色红/288DPI按收藏恢复；源码聚焦CmdZ恢复原公式/字号36/黑色/150DPI；ShiftCmdZ再次恢复收藏；CmdZ最终恢复用户原文及设置。未删除或新增用户收藏；磁盘数据核对rawSource/latex/editorMode/size/padding/color/background/scale/history与安装前全部一致。不是Office验收，不涉及OCR推理。

## 部署与风险

已安装并启动/Applications/Formula.app；org.mathforge.desktop保持，备份~/Library/Application Support/Formula-Backups/20261015-142443/Formula.app。安装bundle与工作区构建逐字节相同。用户模型/路径未动，没有schema变化或迁移。收藏恢复的Undo是本轮有意修正的行为，不宣称资产删除已有Undo。

等待用户体验收藏恢复后撤销、跨语言收藏原文保留。GitHub未推送/合并/发布；工作区仍有此前改动，未混合提交。下一步建议A31.2，尚未开始。
