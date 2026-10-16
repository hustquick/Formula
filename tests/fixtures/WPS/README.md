# WPS 原生公式剪贴板样本

目标公式：`\frac{x^2+y^2}{a+b}`。

分别采集 Writer、Presentation、Spreadsheet 中选中整个原生公式对象的 Command+C，不使用 Formula 生成数据代替原生 fixture。每个目录保留 manifest（完整类型、字节长度、SHA256、读取状态、item 边界）及原始二进制载荷。

当前状态：等待用户采集三组同公式原生样本；尚未确认 Presentation/Spreadsheet codec，也没有新增对应 exporter。先前 Writer 样本公式不同，不能冒充本组对照。

已知人工实验事实（用户提供）：Writer→Writer 可编辑，Writer→Slides/Sheets 为图片；Slides/Sheets 互通可编辑，且均可被 Writer 导入为其原生公式。这些是实验依据，尚不是当前 Formula 对三类宿主的验收结果。

本机版本：WPS 12.1.29166，主 bundle `com.kingsoft.wpsoffice.mac`。已安装包内未发现独立 Writer/Presentation/Spreadsheet app bundle；不能仅凭主 bundle identifier 区分文档类型。还需运行时窗口/文档上下文证据；复制发生于 Formula 前台，不能把当时 frontmost app 当作目标粘贴宿主。

优先验证同 item 多种结构化表示共存，只有实际发现冲突才引入宿主选择。未知宿主不得声称识别成功。禁止把图片、字符扁平化或源码粘贴计为可编辑公式通过。

## 首批采样结果

Presentation 与 Spreadsheet 样本已采集（manifest 的 changeCount 稳定）。两者均含 `com.trolltech.anymime.Art::GVML ClipFormat` 的 ZIP 包及 `WPS Drawing Shape Format` 二进制。

- Slides GVML 9405 字节，含 drawing1.xml、drawingEx.xml、预览图片、theme/customXml。
- Sheets GVML 4997 字节，含 drawing1.xml、theme/customXml，没有 drawingEx.xml 或 media 图片。
- 两者 drawing1.xml 内均为 DrawingML shape/text body → a14:m → OMML oMath，含一个分式、两处 sSup，与目标公式一致。
- Sheets 额外发布 Et Internal Shape、WPS Spreadsheets 6.0 Format；Slides 额外发布 Chromium custom data、Kingsoft Data Descriptor。
- 当前没有证据证明这些附加类型必要，也没有证明 GVML 单项已足够；待剔除重放实测。尚不能宣称共享 codec 已验证。

Writer 同公式样本已采集，关键载荷 `Kingsoft WPS 9.0 Format` 7296 字节，ZIP 内 word/document.xml 含一处 OMML 分式和两处上标；不含 GVML。其余关键类型有 Object Descriptor、空 Embed Source、Kingsoft Image Data、RTF、HTML、文本。

Presentation/Spreadsheet 的 GVML 根关系均指向 clipboard/drawings/drawing1.xml，类型为 Office drawing；两者均以 a:graphic/lockedCanvas 包装 shape，数学区为 a14:m 内的 OMML。两者都有相同内容的 WPS customXml 空 extobjs 与 theme 关系。Slides 另有 drawingEx 兼容包装及图片 fallback，Sheets 不依赖这些部件发布公式。数学 XML 不是逐字相同，尚需归一化区分字形与样式差异。

首轮剔除实验：从已保存的 Sheets 样本只重放 Art::GVML ClipFormat（4997 字节），不包含图片、文本、WPS Drawing Shape Format、Et Internal Shape 或 Spreadsheet 私有包。写后字节核对通过，等待用户分别在 Writer/Slides/Sheets 粘贴并进入公式编辑的反馈。

## 单项 GVML 人工验收

用户确认：仅 Sheets GVML 载荷时，Writer 无法粘贴（无内容），Slides 和 Sheets 均可编辑。由此确认当前样本 GVML 单一表示足以支持 Slides/Sheets；无法推出 Writer 可直接导入单项 GVML。用户此前完整 Slides/Sheets→Writer 的成功依赖其他类型或组合，仍未定位。

## 同 item 双原生表示冲突实验

build/pasteboard-audit/wps-dual-native-01 组合相同公式的原始 Writer OOXML（7296 字节）及 Sheets GVML（4997 字节），不改载荷内容、不带图片/文本。通过 Carbon 写入一个 item，独立采样进程 wps-dual-native-verified-01 确认仅有这两种表示且 changeCount 稳定。等待三宿主真人粘贴编辑结果。尚未新增产品 exporter，不宣称产品修复完成。

## 用户更正（优先于先前反馈）

用户明确更正：单项 Sheets GVML 在 Writer 中也可编辑。因此当前正确结果是 Writer、Slides、Sheets 三者均可编辑；此前“Writer 无内容”结论撤销。双原生表示的组合实验尚未收到独立明确反馈，不混同两次实验。

下一阶段 tools/wps-gvml-probe.py 从原始 Formula 源码转换得到的 OMML 生成自有三部件 GVML 包：Content Types、根 drawing 关系、DrawingML lockedCanvas/shape/txBody/a14:m。无样本模板、theme/customXml、图片或额外私有二进制依赖。新公式为带 Greek/上下标/根号的分式，包 1336 字节，经单项 GVML 回读核对。等待三宿主人工验收，不宣称产品已接入。

## 自有最小 GVML 人工结果

用户确认：1336 字节自有 GVML 包在 Writer 无内容，在 Slides/Sheets 可编辑。因此原生 GVML 三宿主成功不等于最小 GVML 也能被 Writer 接受；Writer 对原生 GVML 的额外依赖尚未定位，不推测为 OMML 内容本身有损。

已准备同 item 自有双表示实验 dual-generated-01：同一 Greek/上下标/根号分式，Writer OOXML 966 字节＋GVML 1336 字节，均由统一源码/OMML 分别封装，没有 Writer XML → Slides XML 转换，也没有图片/文本。独立进程 dual-generated-verified-01 核对仅这两种表示。等待真人三宿主结果，决定路线 A 是否可靠。
