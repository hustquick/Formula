# 原始 LaTeX → OOXML 转换方案验证

本轮目标：寻找成熟源码转换路径，替代应用当前自写 MathLive MathML → OMML；不承诺任意 LaTeX 的通用无损。

## 方案比较

- Pandoc/texmath：直接解析 TeX/AMS 数学及宏到结构模型并输出 OMML，已有本机离线运行环境，无新增下载。上游 https://github.com/jgm/texmath 。本机实测版本 Pandoc 3.9。用于本轮候选。
- libtex2omml：https://github.com/renwuxun/libtex2omml ，独立 TEX→OMML 库，需要另外评估语法覆盖、维护和本机集成，未执行测试，不宣称比 texmath 更保真。
- node-latex-to-omml：https://github.com/JaredYe04/node-latex-to-omml ，需另评估其 LaTeX/MathML/OMML 转换依赖；未执行测试，不凭项目名承诺源码无损。

## 实验产物

`tools/latex-ooxml-probe.py` 通过既有 venv-document 的 pypandoc/Pandoc 构造单个 Math AST 节点，直接输入原始源码，输出 DOCX；不将公式当 LaTeX 文档执行、不运行 TeX。开启 sandbox 与 fail-if-warnings，转换警告或没有单个原生数学对象即拒绝。超时限制 20 秒。此工具不写剪贴板。

保留 source.tex、原始 pandoc-original.docx、original.omml、候选 candidate.omml/candidate.docx 与含转换器版本/源码哈希/变更列表的 manifest。候选沿用已验证的自有三部件 OOXML 封装，无用户文档依赖。

原始 texmath 输出保留了积分、分式、上标与直立 d，但将积分和运算符也标记为 plain。候选仅移除非字母 run 的冗余 plain 样式，并在有限条件下将已识别的函数名和紧随参数转为 m:func。函数归组仍属本项目的有限规则，不能宣称完全由成熟转换器保证全部语义或任意函数参数范围。

测试公式：积分 1/(1+x²) 的直立 d 微分，等于 arctan x+C。候选中 d/arctan 为 plain，变量无额外样式；分式和上标结构存在，没有 U+2062 字符或新增文本空格。candidate.docx 980 字节，经现有 replay 工具作为唯一 WPS flavor 写入并字节核对成功，等待 WPS 人工显示/间距/编辑验收。

重要限制：Pandoc 从该 OMML 反向导出 LaTeX 时省略了 mathrm{d}，即使源 OMML 中仍有 d 的 plain 标记。因此未验证源码往返无损，不能把反向导出的宏拼写作为唯一判据。原始源码必须独立保留；图形、样式和数学结构要分别验收。

## 验证与交付状态

命令：`~/Library/Application Support/MathForge/OCR/venv-document/bin/python3 tests/latex-ooxml-probe.py`（执行时路径需 shell 引号）。3 项测试通过：用户完整积分结构/样式/无新增空白及源码保留；指数根、分式、求和、矩阵与字形转换；未知命令拒绝而非 fallback。ZIP CRC、XML 与回读校验通过。

本轮未修改应用链路，未新增应用构建、安装或启动；当前已安装版仍为前轮版本。本轮交付是可复现实验工具与候选，不是最终方案已验收。复用现有文档转换环境，未删除数据/模型或下载组件。未写入 GitHub，未获本轮推送授权。

## 用户验收与应用接入

用户明确反馈候选公式“显示和间距正确，且整体可编辑”。这仅证明当前测试公式，不能扩展为所有 LaTeX 无损转换。

已将候选转换器移入 macos/formula-latex-ooxml.py；tools 入口调用同一实现。Mac 通过显式宿主能力标记启用 prepareEquation 请求，读取统一对象解析出的 latex 字段，复用现有 venv-document。后台完成转换并返回 OMML；网页核对返回源码与捕获源码一致，再核对公式身份、revision 以及未提交源码输入，之后才执行同 item 多表示复制。转换错误、组件缺失或公式变化不会执行剪贴板提交。未设置隐式 MathML fallback。

macos/FormulaDocument.swift 增加后台准备接口；macos/Formula.swift 注册宿主能力与请求；web/app.js 接入异步准备与版本核对。安装/DMG 脚本打包 Python 转换器。Windows/浏览器没有该能力标记，保留既有复制路径。本机已有 Word 离线组件，无新增下载；其他机器需要先安装该组件，缺失会明确说明。

验证：原生应用完整 Swift 构建、前端 bundle 构建通过；Python 源码转换 3 项测试通过；equation-upright、equation-clipboard 通过且桥接到真实生产转换器；focus-copy-matrix 三种宽度与 command-shortcuts 通过；source-equation-race 证明未提交源码变化及转换失败均不触发 copyEquation；universal-pasteboard 精确字节与 ZIP/XML 验证通过。

准备部署新链路，尚待应用自身 Command+C → WPS 人工复验；没有 GitHub 写入，未获本轮推送授权。

源码转换版已部署：scripts/install-local.sh 完整构建、资源核对、ad-hoc 签名验证成功，安装并确认启动 /Applications/Formula.app。备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-183107/Formula.app。数据和模型保持原路径，未删除或下载。等待应用自身的积分复制 WPS 验收；未推送 GitHub。

## 应用最终链路人工验收

用户在源码转换版 Formula 使用原积分公式，执行预览 Command+C → WPS Command+V 后，明确反馈“显示和间距正确，整体可编辑”。本轮应用实际链路验收通过，覆盖当前积分样例的直立微分字母、函数名、间距及整体原生编辑状态。不能推广为任意 LaTeX、任意 WPS 版本、Word 或 Pages 的通用无损保证。

最终状态：源码转换已接入，构建与相关自动测试通过，已备份安装到 /Applications/Formula.app 并确认启动，本轮用户验收通过。依赖本机已安装的离线 Word/Pandoc 组件；不支持的命令/转换警告明确失败，原源码保留。不进行 GitHub 写入，仍未获得明确推送授权。
