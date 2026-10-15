# A03.1 — 等高工作区

2026-10-15。用户指定优先调整本子项；未改变原40项清单。卡片工作区由100px增至200px；源码/可视化和输出统一200px，使用共享CSS变量。所有标签固定占位，长内容内部滚动。自定义右侧工具组同步高度；保留既有两行自定义按钮上限。OCR复用已有2px真实/不确定进度线及右侧竖排工具区，不新增重叠进度面板。

源码独立拖动高度关闭，以遵循本次三处等高要求。小窗口允许页面滚动，不再保证全部区域强塞进一屏。增高后颜色弹层遇到自动滚动的连带问题已修复：滚动时跟随按钮定位，按钮离开可视区才关闭。

修改：web/v1.1.css、web/ocr.js、web/color-picker.mjs、tests/workspace-height.cjs、tests/compact-layout.cjs、tests/completion-placement.cjs、tests/output-colors.cjs、scripts/test-editor.cjs、DEVELOPMENT_AUDIT.md。

测试：760/1120/1440等高、六标签frame稳定、长源码滚动保留；compact-layout、ocr-layout、preview-overflow、custom-toolbar、output-colors、output-color-export、completion-placement。PASS 最终完整34组编辑器回归，新增定向与完整输出见editor-tests.log。

测试初次失败如实记录：OCR夹具未注入本机bridge导致按钮不可用，已补夹具；compact-layout第二轮继承visual模式导致源码box为空，已显式初始化；补全测试将光标放在可视区外，已滚动到光标；颜色frame测试把页面滚动误认为布局位移，改为文档坐标比较。颜色面板真实滚动关闭问题修于产品，并保留小窗口测试。没有通过扩大测试窗口掩盖失败。

构建成功：离线UI打包、Swift编译（既有allowedFileTypes弃用警告）。安装首次因进程未结束安全拒绝，无强退；确认退出后成功备份替换/Applications/Formula.app并启动。备份~/Library/Application Support/Formula-Backups/20261015-132436/Formula.app。原生截图已确认工作区增高和用户最新kappa公式保留；安装资源逐字节匹配。未修改模型或用户schema；GitHub未推送。

A03主项保留PARTIAL：本次等高子项完成；完整跨面板焦点/原生长内容上下文矩阵仍应在A03主项后续验收，不把布局子项当整个A03完成。建议下一步继续A03余项，不自动开始。
