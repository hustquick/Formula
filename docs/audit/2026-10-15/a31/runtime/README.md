# A31.3 — Runtime / preference / asset mutation boundaries

2026-10-15。子项COMPLETE，连同A31.1/.2完成A31技术验收。用户实际体验仍待确认；GitHub未推送。A31范围是入口分类/契约/分发，不把A25历史所有权/A26History策略提前验收。

## 修改与根因

批量导出原本直接替换源码、渲染并在finally恢复；渲染会persist，临时公式可能写入用户state；保存取消不停止循环。现由batchExport命令建立隔离scope：检查其他in-flight命令；flush待提交输入；by-value保存state/content/UI/visual占位符/runtime及原预览；关闭冲突命令并inert编辑/设置；禁止临时persist与formula/Undo输入历史记录；取消停止循环；所有结果finally恢复并只保存原state。失败源/最后有效预览和visual占位符也恢复。

Toolbar增删/拖拽/重排/reset/display进入preference命令，原两行约束保留；History资产清空/删除和版本恢复命名分发；收藏库导入/备份区分asset/output，不消耗文档Undo。本机路径选择/检测委托配置命令；OCR入口增加runtime/preference适配，不重写识别器或安装流程。内部渲染、启动迁移、Undo恢复、选择/焦点/进度仍是明确内部适配边界，详见docs/COMMAND_MUTATION_CONTRACT.md。

文件：web/app.js、web/commands.mjs、web/ocr.js、tests/runtime-mutation-scope.cjs、scripts/test-editor.cjs、docs/COMMAND_MUTATION_CONTRACT.md、DEVELOPMENT_AUDIT.md及本证据目录。

## 实际执行测试

PASS runtime-mutation-scope：批量成功2项/首项取消/保存错误，state、source authority、revision entries/index精确恢复；只持久化原源码；held save期间阻止设置/import且编辑surface inert，结束释放；先前命令未结束拒绝批量；原无效输入的last-valid preview恢复；可视化占位符保留；工具栏偏好、资产import/clear不消耗文档Undo；本机tool key验证。
PASS test:editor全部38组，见editor-tests.log；包含Visual/LaTeX/Typst/Undo/Redo/History、三窗口宽度、设置、选区、输出、OCR布局、真实工具栏拖拽等。
PASS 额外ocr-behavior/document-behavior/clipboard-ocr：单图、多公式结果、文档、取消/错误/导入及桥接路由、文本粘贴保留。没有实际安装/下载OCR模块；已有原生推理环境未动。
PASS build:vendor、Swift编译、资源清单与签名、node --check app/commands/ocr、git diff --check。最终“有任意其他Registry命令运行均拒绝批量”收紧后重新构建，并重跑runtime-scope和三项OCR测试通过。

## 实际Mac

已安装并启动/Applications/Formula.app，备份~/Library/Application Support/Formula-Backups/20261015-144532/Formula.app。安装资源逐字节匹配工作区。保持org.mathforge.desktop、用户模型路径，未动模型。

CUA：设置→批量导出，输入x+1/y+2→批量SVG→真实NSSavePanel。取消首个保存后回设置，没有第二次保存；清空临时批量输入并完成关闭设置；原源码、字号36、留白8、黑色/透明、150DPI及761×149预览恢复，状态“已取消批量导出”，source重新获得焦点。state.json与安装前备份整个JSON完全相同。未保存测试文件。

无schema变化或数据迁移。批量导出期间不可编辑是有意隔离；此项不实现通用命令并发队列，也不证明所有历史嵌套事务/A25已解决。没有把OCR桥接测试当Office或准确率验收。

本轮结束。主表完整A项累计4/5（A02/A16/A03/A31）；A31子项不重复计数。下一项建议A25，完成后按用户要求做第五项阶段回归；本轮没有开始A25或Stage Regression。
