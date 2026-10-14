# Formula 产品路线与 1.5.1 审计

审计日期：2026-10-14。基线：主分支 `fcad95045d9a25ac46ae1ceaadc028f81d93fa2a`（v1.5.1）。本文件先提交审计与设计，不改变运行代码，不触发新版本发布。

## 当前真实能力

| 模块 | 实际实现 | 限制 / 验证边界 |
|---|---|---|
| 编辑 | MathLive 0.111.1、LaTeX/Typst 转换、独立源码/可视化缩放、局部样式 | 本机 Typst 文档语法不保证能转换 LaTeX |
| 内置排版 | MathJax 4.1.3、11 套离线字体、默认黑色、mhchem | 字体设置只影响内置排版 |
| 本机排版 | Swift Process 直接参数调用 LaTeX/Typst，LaTeX 禁用 shell escape，超时及日志 | 依赖用户安装外部引擎；本机宏包兼容性不能由 mock 证明 |
| 输出 | SVG/PDF/PNG/JPEG、源码、MathML、MathForge；本机增加 TIFF，EPS 需要 pdftops，LaTeX SVG 需要 dvisvgm | 跨语言转换只支持部分语法；Office/Keynote 未建立真实粘贴矩阵 |
| 恢复 / 收藏 | MathForge 保存状态；SVG/PDF 带恢复信息；收藏 SVG 图形预览 | 无文档级工作台、批量恢复与 review 状态 |
| 工具栏 | 十类快捷与模板，自定义拖拽，两行上限，固定右侧显示控件，外部点击/Esc关闭 | 窄窗口及旧布局迁移应补专项回归 |
| OCR | Pix2Text 1.1.7/MFD、独立 UniMERNet 0.2.3；Python 3.10–3.12，优先 3.11；安装 staging 与就绪检查、取消及修复 | 依赖与模型初始化测试不能代替识别质量 benchmark |
| 文档 | PDFKit 渲染 PDF，每次最多20页；DOCX 原生公式经独立 pypandoc_binary 1.17，图片交给 OCR；旧 DOC 提示换 DOCX | 提取公式，不恢复文档正文或版式；无 Windows OCR |
| 识别界面 | 图片/文档识别位于卡片内，安装与日志折叠，取消及勾选同步 | 尚无剪贴板图片候选确认流程 |
| 输入 / 输出拖拽 | 支持 Option 拖出输出文件；文件菜单导入恢复格式 | 未发现统一拖入图片/PDF/DOCX/源码路由；未发现截图 OCR |
| 更新 / 诊断 | 有编译和识别日志 | 无检查更新入口、隐私诊断导出 |

## 构建与发布现状

`npm ci` → `build-vendor.mjs` 离线资源 → catalog 同步 → Swift Cocoa/WebKit/PDFKit 编译 arm64+x86_64（部署目标 macOS12）→ lipo → app资源 → ad hoc codesign → DMG → 挂载与资源/签名/架构检查 → SHA256。

本机扫描已安装 1.5.1：仅发现 `Contents/MacOS/Formula` 为可执行文件；签名为 `adhoc`，无 TeamIdentifier，无 Hardened Runtime 标志。Python runner 为资源，Python虚拟环境及模型在应用外用户数据目录，Pandoc来自独立安装环境。后续必须在每次构建扫描 Mach-O、framework、bundle，而不是把本次扫描结论写死。

macOS workflow 在 PR 运行行为、依赖导入与 universal/DMG 检查；主分支 push 直接发布。Windows workflow 在主分支独立发布相同版本，缺少跨平台统一发布门禁。两者会创建/更新同一 Release，存在部分资产提前公开的问题。

`validate-v1.1.mjs` 实际是旧版目录/UI合约：固定 runtime 1.1标记、限定 plist 1.1–1.5，未检查 RELEASE_NOTES/Windows版本同步、notarization、launch或 Gatekeeper。保留目录回归，另增版本无关的 `validate:release`。

## 正式分发缺口与设计

Apple 官方要求 Developer ID Application、Hardened Runtime、secure timestamp；使用 notarytool，不使用 altool。参考：
- https://developer.apple.com/developer-id/
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- https://developer.apple.com/documentation/security/resolving-common-notarization-issues

1. 复用构建脚本，明确 test / official 模式。PR 仅生成未公证测试产物（如需运行可使用 ad hoc）；正式 tag 构建必须拒绝 ad hoc。版本号暂保持1.5.1，基础设施合并不应重发已有版本。
2. inside-out 签名扫描真实 Mach-O 和嵌套代码，最内层先签，再主app；签名不用 `--deep` 代替遍历，验证使用 deep/strict。检查证书类型、runtime与时间戳。
3. 初始 entitlement 不增加宽松例外。WKWebView 的 WebKit 进程与外部 Python/LaTeX/Typst/Pandoc 进程不等于主程序自行 JIT 或加载未签名库。正式签名后逐项实测，发现冲突再最小授权；不预加 disable-library-validation 或 allow-unsigned-executable-memory。
4. CI采用 App Store Connect API key。Secret：APPLE_DEVELOPER_ID_CERTIFICATE_BASE64、APPLE_DEVELOPER_ID_CERTIFICATE_PASSWORD、APPLE_TEAM_ID、APPLE_NOTARY_KEY_ID、APPLE_NOTARY_ISSUER_ID、APPLE_NOTARY_PRIVATE_KEY。临时 Keychain/私钥文件在退出清理，不输出秘密，不提交凭据。用户负责会员、协议、证书私钥及API凭据。
5. app签名验证 → zip提交notarytool并等待 → 非Accepted获取详细log并失败 → app staple/validate → DMG签名/公证/staple/validate → Gatekeeper(app与DMG) → DMG挂载/完整性 → 干净状态launch smoke → 校验文件 → 发布。最终sha必须在staple后生成。
6. 所有正式验收门禁失败均不创建公开Release。跨平台先上传workflow artifact，最终协调发布；禁止 Windows job 独自绕过macOS正式门禁。历史1.5.1仅作为临时签名历史发布，不追认公证。

## 1.6 工作流设计

- 剪贴板：原生检查图片representation；普通文本保持系统粘贴。图片送现有OCR桥，候选确认后才插入，失败保留编辑内容。系统截图复制到剪贴板后走同一入口，不自行开发截图工具。
- 拖入：原生文件类型路由（图片→OCR；PDF/DOCX→文档；tex/typ/mathforge→恢复）；单一确认与明确来源，不多个模式弹窗。
- 复制：保留显式格式选择；评估可选的多representation（SVG/PDF/PNG+恢复元数据），不能声称目标软件实际兼容。Word/PowerPoint/Keynote需真实版本粘贴、编辑/打印检查。
- 诊断：Help导出JSON，版本、系统/架构、引擎状态、依赖版本、脱敏错误类型。默认不包含公式或原始日志；路径、token、key等脱敏采用白名单结构，不仅靠正则删敏感字段。
- 更新：先做只读检查GitHub latest、语义版本比较与打开Release页。暂不引入安装更新框架，待签名稳定再评估成熟方案。

## 1.7 批量工作台

独立窗口/入口，不扩张单公式主界面。版本化workspace包含ID、来源页/段落、原始表示、识别源码、编辑源码、render/review/export状态；review为未检查/已检查/需修改/识别失败。原始数据不可被样式操作覆盖。

选中/全部统一样式先预览再应用，以事务快照支持undo。导出formula_001等稳定文件名+manifest.json，保存来源、原/最终源码、路径、样式与失败原因，部分失败明确报告；导入manifest恢复工作区。先模型/序列化测试，再独立UI、样式事务、导出PR。

## 1.8 Inspector 与质量基线

规则检查先覆盖微分正体、函数算子、单位、括号、编译失败；e/i/j/向量/下标依赖语境，只提示不自动改。检查结果包含位置、理由、建议与用户确认，不能以启发式分数冒充模型置信度。

建立tests/ocr_benchmark，带有授权来源/预期标注的印刷、低清、扫描、中文教材/PDF等样例，覆盖分式、根式、积分、求和、极限、矩阵、分段、上下标、希腊/物理/化学。记录exact/normalized match、compile success、人工修改计数、运行时间；渲染等价单独记录并注明判定方法。现有集成测试不是benchmark，不编造基线分数。

## 验证记录与兼容性矩阵

本次实际执行通过：validate:v1.1、source-mode、output-actions、ocr-behavior、document-behavior。后四项为浏览器/桥接行为回归，不是重新执行完整模型推理。此前1.5.1 CI成功及DMG校验不替代本次正式签名测试。

| 环境 | 目前证据 | 尚需 |
|---|---|---|
| 本机Apple Silicon | 1.5.1实际安装、行为检查；本次读取签名/扫描可执行文件 | 正式签名后启动/引擎/OCR实测 |
| macOS15 CI | universal编译与既有测试 | 正式签名与Gatekeeper流水线 |
| Intel | x86_64可编译 | requires physical verification：启动、OCR、外部引擎 |
| macOS12/13/14 | 部署目标12，不能证明运行 | requires physical verification，各系统分别记录 |
| Windows | portable构建 | 实际GUI及Office粘贴，不包含本地OCR |

## 推荐 PR 顺序与验收

0. 本审计路线文档（不改运行代码）。
1. Release signing infrastructure：bundle扫描、inside-out签名、test/official模式、最小entitlement；mock签名顺序与缺凭据拒绝测试、本机test构建。真实Developer ID需用户证书。
2. Notarization + release validation：notarytool/log/staple/Gatekeeper/launch、版本合约、tag与跨平台发布门禁、APPLE_DISTRIBUTION.md；故障路径单测和CI测试产物。凭据缺失阻止官方发布。
3. Clipboard and drag-drop input：图片候选确认与文件路由、普通文本粘贴回归、取消保护。
4. Screenshot workflow：复用系统截图剪贴板，说明权限与原生操作验证；不重复实现截图UI。
5. Office / Keynote export：多representation、来源恢复；公布逐应用真实验证结果。
6. Diagnostics and compatibility：隐私导出、更新检查、benchmark骨架、物理验证矩阵。

每个PR记录 implemented / tested / CI verified / real hardware verified / requires user credential / requires physical verification。1.6只有实际验收完成才能发布；1.7/1.8依次迭代，不塞进同一大PR。2.0必须具备成熟正式分发、更新、批量、benchmark和Inspector证据。
