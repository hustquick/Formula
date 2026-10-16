# WPS → Formula 原生反向粘贴

## 范围与保真定义

目标为 Writer、Presentation、Spreadsheet 原生公式对象进入同一个 FormulaObject，保留数学结构、原始载荷及来源。不能从 WPS 对象凭空恢复其没有保存的原始 LaTeX 宏写法；编辑器源码是结构化数学的派生表示。当前实现不承诺任意 OMML 的通用无损或跨字体像素一致。

原始 package 字节以 base64 保存在 FormulaObject.nativeMath，原始 OMML 数学树及派生 LaTeX、kind、pasteboardType、sourceRevision 同时保存。未改内容时复制回 WPS 走保留 OMML，不经派生源码重建数学树；XML 前缀/序列化可改变，结构/属性不改。实际编辑使该保留表示失效，之后复制以编辑后的源码重新生成，原生往返保留不扩展到编辑后任意语法。

## 实现位置

- macos/formula-wps-import.py：读取 bounded ZIP 的 word/document.xml 或 clipboard/drawings/drawing1.xml；只接受一个 oMath；无公式的 WPS 普通文档回到原生粘贴。严格识别分式、上下标、根式、大运算符、定界符、矩阵、eqArr、函数、上下限、常见重音和字符样式。不支持结构明确报错，不拼接子字符冒充转换。解析数学 Unicode 字形，以及 Writer 的 nor + w:i 字体语义。
- macos/FormulaDocument.swift/readNativeEquation：Carbon 读取 WPS 私有类型，快照核对，后台解析，不修改剪贴板；优先 Writer 结构化包，否则共享 GVML。离线环境缺失、解析失败明确报告。
- web/app.js/pasteNativeMath：Command+V/注册的编辑菜单粘贴先检查原生数学，普通文本保持 nativeEdit。辅助输入不拦截。候选弹窗经用户明确确认后以一个可撤销事务替换当前公式；候选读取/确认期间编辑变化时停止，不自动切换模式。失败不落入 OCR。
- web/formula-object.mjs：nativeMath 来源记录随 snapshot/项目持久化；未编辑内容复制时传 originalOMML。源码变化失效；Undo/Redo 恢复对应记录。commands/lifecycle/history 签名计入 nativeMath，避免只改来源记录时漏记脏状态。
- macos/formula-latex-ooxml.py：接受经确认的保留 OMML，用于未编辑内容的原生再导出；原有源码转换保持。
- 本机/DMG 脚本增加 importer 文件。未改 UI 工作区布局或 OCR，未添加自动识别模型。

## 实际自动验证

- tests/wps-native-import.py：3 方法通过，包含三个真实 WPS fixture；必需 12 组公式在 Writer/GVML 两条路径的导入/再导出（24 子用例），验证保留 OMML 树相等、package 字节保留；未知结构/实体声明拒绝、普通 WPS 文本不拦截。
- tests/wps-native-paste.cjs：实际生产转换器接入浏览器桥，确认/取消、原生记录、原公式源码、模式保持、原生 OMML 再复制、Undo/Redo、编辑失效、普通文本 nativeEdit 与解析错误不降级均通过；LaTeX/可视化/Typst 下验证模式及预览 frame 稳定。
- 统一对象单元/编辑测试、equation-clipboard、equation-upright、focus-copy-matrix（3 尺寸）、command-shortcuts、source-equation-race、universal-pasteboard、Python 既有源码导出测试通过。快捷键测试因粘贴新增异步原生检查而改为等待 nativeEdit 完成，不立即断言。
- 前端 bundle 与完整原生 Swift 应用构建通过；既有弃用 API 警告仍在。

## 已知限制与人工门禁

支持一个原生数学对象；超过 1 MiB 的 package、过大解压体、重复 ZIP 部件、实体声明、未知数学结构等明确拒绝。图形包装的布局、字体、颜色等全部原始信息保存在 nativeMath 中，但编辑器预览使用 Formula 字体设置，不承诺原字体像素一致。负间距/部分复杂字体原有导出限制未消除。右键原生 WebKit 粘贴入口未单独实测，本轮以 Command+V 和注册编辑菜单为验收入口。

尚需用户分别验证 Writer/Slides/Sheets → Formula → 对应 WPS 的实际对象、分式/上标/根式布局、编辑和 Undo。自动测试不是宿主人工验收。未进行本轮 GitHub 写入，既有推送授权不用于跳过本轮验收。

部署完成：scripts/install-local.sh 原生编译、前端构建、资源核对和 ad-hoc 签名验证通过。已安装并确认启动 /Applications/Formula.app，备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-192442/Formula.app。用户数据与模型保持原路径。正在等待 Writer 首轮实际导入/再复制验收，随后验收 Slides/Sheets。

## Writer nobar 失败样本修复

用户提供二项式定理样例，导入报“不支持的分式布局 nobar”。真实原生样本保存在 tests/fixtures/WPS/writer/nobar-failure，确认 fPr/type 为 lowercase nobar，且系数外已有独立圆括号 d。

修复接受 noBar/nobar。只有圆括号 d 唯一包裹无横线分式时生成一个 binom，避免重复括号；独立无横线堆叠以无定界符 genfrac 表示。源码导出针对 texmath 不接受空 genfrac 定界符的限制进行内部转换，移除 null delimiter 的点值；保留原始源码和未编辑 OMML。没有将所有无横线分式一律变成 binom。

真实失败样本 Python 回归、保留 OMML 往返、编辑后重新生成、noBar/nobar 独立堆叠和无重复括号断言通过；以真实样本运行完整 browser 粘贴/确认/取消/Undo/Redo/模式及预览 frame 回归通过。源码导出公式集、equation-clipboard、universal-pasteboard 再验证通过。

2026-10-16 本次安装完成：scripts/install-local.sh 构建、资源核验、ad-hoc 签名校验通过，安装并确认启动 /Applications/Formula.app；备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-233623/Formula.app。数据/模型保持原路径。等待该 Writer 失败公式的用户复验；反向整体功能仍未全部验收，未进行本轮 GitHub 推送。

Writer nobar 修复人工验收：用户从 Writer 重新复制失败的二项式定理，导入 Formula 后再复制回 Writer，明确确认“导入与往返均正确且可编辑”。该真实失败样本本轮验收通过；不推广为全部反向公式无损。Slides/Sheets 反向实际链路仍待分别验收。未推送 GitHub，未取得本轮推送授权。

## Slides/Sheets 反向与往返人工验收

用户分别从 WPS Slides、Sheets 复制含 Greek、上下标、根号的分式，导入 Formula 并检查结构，再复制回原宿主进入编辑，明确确认“均正确且可编辑”。这两条实际应用链路本轮验收通过。

结合已确认的 Writer 二项式定理样例，Writer/Slides/Sheets 三类宿主的反向导入和往返均获得本轮用户验收。范围限于已测公式及当前 WPS 版本；原始载荷/OMML 保留不等于任意语法、任意编辑后或像素外观通用无损。未知结构拒绝、普通文本原生粘贴、单公式及体积等限制保持。

最终交付状态：代码实现、构建与相关自动测试通过；已安装并启动 /Applications/Formula.app；上述三条反向/往返链路用户确认正确且可编辑。未执行本轮 GitHub push/PR/远程标签/Release；上轮授权不替代本轮明确推送授权。
