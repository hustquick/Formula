# A03 OCR 工具区反馈修正

2026-10-15，延续现有A03 UI问题，不另建主任务。识别期间原生progress在定制样式下静态呈线，改为明确运动的短条；120×4px轨道，仅busy可见。没有真实百分比，因此使用indeterminate动画，不伪造百分比。结束/失败/取消均通过finally移除busy并visibility:hidden，保留布局占位。

缩略图最大148×72px，填满148px右侧工具区，object-fit:contain/right top，保持原比例；文档名宽度规则不变。120px为进度条宽度，不是缩略图宽度。减少动态效果偏好下停止扫描动画，保留busy提示。

文件：web/ocr.js、tests/ocr-layout.cjs、DEVELOPMENT_AUDIT.md与本证据目录。

PASS ocr-layout（实际动画背景位置变化、空闲隐藏、处理显示、结束隐藏、148×72约束与frame稳定）、ocr-behavior、document-behavior、clipboard-ocr（含单图/多候选、文档、取消/错误/桥接路由）。PASS全部35组编辑器回归，最终全宽样式后另重跑ocr-layout通过。build:vendor成功，node --check与diff --check通过。未修改OCR模型/识别器/用户数据，无迁移或下载。GitHub未推送。

A03主项仍PARTIAL：本子项代码和测试完成，不替代原生全上下文验收。等待用户确认移动进度和缩略图宽度。

已安装并启动最终全宽版/Applications/Formula.app，备份Formula-Backups/20261015-134015。已安装ocr.js与工作区逐字节一致。原生AX确认应用启动且用户正在选择图片，未接管用户文件选择；动态反馈实际体验等待用户确认。
