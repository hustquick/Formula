> 最新验收（2026-10-15）：A03已补齐剩余原生验证并更新为COMPLETE，见verification-20261015.md。下文PARTIAL说明为此前阶段记录。

# A03 — 编辑上下文与布局稳定

2026-10-15。本轮延续A03，不开始下一A项。用户在进行中进一步要求收紧工具区、填满卡片、移除顶部品牌栏、隐藏OCR空闲横线，均纳入同一布局项。

## 修改

新增独立于公式/Undo的captureEditorContext/restoreEditorContext：保存源码和可视化选区、源码/可视化/预览滚动、页面滚动、焦点及模式。关闭设置、命令/历史面板和工具/style菜单时恢复；如果面板内实际改了公式/模式，不套用旧选区。标签指针激活保留编辑焦点；历史按钮避免提前抢走焦点。没有重写内容模型或历史所有权。

工具区132px，快捷工具/公式模板卡片116px，上下8px正常边距；源码/可视化和输出仍200px。各标签固定占位，窄屏多行使用内部滚动。自定义继续原有两行上限。移除顶部品牌栏全部图案/标题/副标题；OCR空闲进度线opacity0，识别中opacity1，保持占位不跳动。

文件：web/app.js、web/v1.1.css、web/ocr.js、tests/editor-context.cjs、tests/workspace-height.cjs、tests/compact-layout.cjs、tests/ocr-layout.cjs、scripts/test-editor.cjs、DEVELOPMENT_AUDIT.md。本工作区还含前轮变更，未混合提交或推送。

## 自动验证

PASS 新editor-context矩阵760/1120/1440，LaTeX/Typst/visual各100行内容：六标签、命令/历史/settings关闭、快捷工具/style Escape、选区/scroll/focus/history/frame相等；另预览焦点设置关闭恢复。
PASS 132/116工具区填充、顶部品牌不可见、200编辑/预览、长源码滚动、六标签稳定。
PASS OCR空闲进度线隐藏、工作状态显示及布局占位不变。
PASS npm run test:editor全部35组，输出editor-tests.log；node语法检查及git diff --check。
首次新矩阵发现历史按钮在可视化时抢焦点，已在实际产品修复；最终测试无未解决失败。

本项不代表A25统一Undo所有权、A26历史产品能力或A33完整应用工作流已完成。未变更用户数据schema，无需迁移/模型下载。下一项建议A31事务入口，尚未开始。

## 本机交付与剩余验收

已备份安装并启动/Applications/Formula.app；备份~/Library/Application Support/Formula-Backups/20261015-133337/Formula.app，详见install.log。真实AX确认品牌栏移除、用户最新源码/收藏保留；选中源码→打开命令面板→Escape保留完整选区；切换公式模板选区仍在。设置返回进一步测试被用户界面变化保护中止，未强行操作，不能声称完整原生矩阵通过。A03保持PARTIAL，下一步继续本项原生长内容/设置/可视化上下文验收；不自动开始A31。

安装成功不等于用户验收；等待用户体验工具区填充、品牌栏移除及焦点连续性。没有推送GitHub。
