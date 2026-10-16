# Pages 剪贴板实测

## 范围与环境

2026-10-16，在用户 Mac 上通过 Pages 的 Untitled 2 测试文档执行实际粘贴。未修改 Formula 应用代码、未构建或部署新版本，未推送 GitHub。保留此前 WPS 修改。

## 原生对象协议

原生公式样本：`\sin\cos x+\arctan\frac{x}{y}`。
完整采样位于 `build/pasteboard-audit/pages-native-equation-01`。

主要数据类型：

- `com.apple.iWork.TSPNativeData`：4248 字节，二进制对象数据，内含 LaTeX 源字符串。
- `com.apple.iWork.TSPNativeMetadata`：163 字节。
- `com.apple.iWork.TSPData.25`：34907 字节 PDF。
- `com.apple.iWork.TSPDescription`：382 字节二进制 plist，含 TSWPEquationInfo 描述。
- 多个零字节 `com.apple.iWork.pasteboardState.*` 标记，包括 hasNativeEquation、hasNativeTypes、hasNativeDrawables、对象数量与元素种类。

完整快照跨进程重放后，Pages 插入了整体公式；双击打开 Edit Equation，显示原始 LaTeX。仅保留全部 `com.apple.iWork.*` 类型也成功插入公式附件，无需 RTF、RTFD 或普通文本。

仅四个主要数据类型粘贴无内容；四个数据类型加 hasNativeTypes 标记也无内容。尚未确定必需标记的最小集合。

## 当前 Formula 输出

从当前安装的 Formula 点击预览并 Command+C，未编辑其原内容。采样位于 `build/pasteboard-audit/pages-current-formula-01`。

测试公式：`\frac{{\alpha }_{1}^{2}+\sqrt{y}}{a+b}`。

完整输出含 WPS Writer OOXML、GVML、OMML、MathML、HTML、LaTeX、Typst、Formula Entity、SVG、PDF、PNG 与普通文本。

实际粘贴到 Pages 后，公式被展开为多行字符，未创建原生公式对象。撤销后，仅提供四个 MathML 类型（两种注册格式对应动态 UTI、org.w3.mathml、public.mathml），实际粘贴没有内容。此次不能据此判定 Pages 对所有 MathML 载荷均不支持。

## 结论与限制

当前 Formula → Pages 直接复制粘贴未通过可编辑公式验收。Pages 原生快照重放通过，说明需要继续研究 iWork 原生对象包及状态标记。尚未实现任意 LaTeX → TSP 原生包生成；源字符串可见不代表可安全替换二进制对象图。不能用 PDF、PNG 或展开文本宣称完成。

此前 Pages Insert → Equation 的 LaTeX 输入路径可创建可编辑对象，但存在额外操作，不满足直接 Command+C → Command+V 目标。

测试结束恢复了测试前保存的剪贴板（`pages-resume-original-clipboard`）。本轮没有应用修改，因此未执行构建、自动测试或安装；结果来自实际 Pages UI 操作和剪贴板字节校验。

## 后续协议实验

已解析原生数据为不经 Snappy 压缩的 ArchiveInfo/MessageInfo + payload 消息流。类型 3005 的公式节点中，字段 100 和 103 均为原始 LaTeX，字段 11 引用独立 PDF 数据。对象图清单保存为 `build/pasteboard-audit/pages-object-graph.json`。

新增研究工具 `tools/pages-source-probe.py`：保留完整样本对象图与未知字段，重建两份源码及消息长度，仅输出实验采样目录，不修改系统剪贴板。它不是独立对象包生成器。

实际 Pages 验证：

1. 把原正弦样本的两份源码改为 `\frac{x+7}{y}`，Pages 直接粘贴后自动重绘成新分式；双击显示新源码。无需先打开插入公式界面。
2. 改为 `\int\frac{1}{1+x^2}\mathrm{d}x=\arctan x+C`，显示正确的新积分；双击源字符串与输入一致。把 C 改为 D 后点击 Update 成功，正文附件描述同步为 D。
3. 两项实验仍保留原生样本外壳和旧 PDF，不证明能够独立生成任意公式包；但 UI 已显示 Pages 按新源码重绘，而非只显示旧 PDF。

另一个仅自行生成五个节点、移除完整样式/附件依赖的最小包失败，并触发 Pages SIGSEGV（报告 `~/Library/Logs/DiagnosticReports/Pages-2026-10-16-235502.ips`）。失败载荷在 `pages-generated-minimal-01`；生成器 `tools/pages-equation-probe.py` 已标记已知崩溃并要求显式危险实验参数，未接入应用。Pages 已重新启动，Untitled 2 已重新打开，先前公式保留。不得把该最小包用于产品。

`python3 tests/pages-source-probe.py`：3 项通过，覆盖长 UTF-8 源码引起的长度变化、未知字段保留、截断与多个公式拒绝、真实样本原源码重建字节一致。没有执行 Formula 应用构建或安装，既有 WPS 和其他输出路径未改。GitHub 未推送；等待用户检查当前 Pages 积分实验。继续生成完整可靠对象图仍是产品接入前的必要工作。

协议研究参考：[iWork protobuf 消息定义](https://github.com/m-tymchyk/apple-iwork-protos)、[SVG2Keynote 剪贴板格式说明](https://github.com/eth-siplab/SVG2Keynote-lib/blob/main/format_documentation/format_documentation.md)。实际公式字段与重绘行为以本机样本解析及 UI 实测为依据。

用户已明确确认上述积分实验“符合预期”。随后保留 36 对象图、移除公式 PDF 引用/外部 PDF、TSPDescription 和 documentId 标记，并重建精简 Metadata 的组合实验没有插入内容，未再次崩溃；样本 `pages-complete-no-pdf-01`。这是组合实验，尚不能单独归因于 PDF 缺失。需分别隔离 Metadata、描述及资源依赖，才能决定产品模板的安全边界。
