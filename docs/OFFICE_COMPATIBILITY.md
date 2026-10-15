# Office compatibility matrix

审计日期：2026-10-15。对象：Formula v1.6.0 Mac + 后续本地优化。**未验证不是失败，也不能标为支持。** 当前只确认 Formula 写出了相应 payload；没有证据证明目标软件实际接收为矢量或可编辑数学对象。

| App / version | Paste | Vector | Native editable | Print | Save/reopen | Recommended path |
|---|---|---|---|---|---|---|
| Word / 未取得 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 待验证；不承诺原生公式粘贴 |
| PowerPoint / 未取得 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 单独于Word验证 |
| Pages / 未取得 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 公式对话框LaTeX/MathML是研究入口，非已验收路径 |
| Keynote / 未取得 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 分别验证公式对话框与图形粘贴 |
| WPS 12.1.29166 Mac | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 历史自动化不可观察，需人工辅助实测 |

本机标准应用路径及Spotlight未找到前四款应用；不据此断言它们在任意磁盘均不存在。WPS版本来自应用Info.plist，未启动/修改用户Office文档。历史审计也没有合格的保存再开证据。

## 已确认的 Formula 输出事实

真实编辑器桥接探针 `audit/2026-10-15/commercial/probe.json` 观测 SVG复制发送 `svg, png, equation`。Swift将其写为 public.svg-image、public.png、org.mathforge.equation；这是payload/代码证据，不是目标App验收。

其他图形格式按所选payload写入；MathML、LaTeX、Typst目前走纯文本。没有专用OMML对象写入，没有消费内部UTI的粘贴恢复。浏览器默认通常仅支持可写ClipboardItem类型，不能直接等同Mac/Windows能力。

## 下一阶段真实验证协议

每个App建立新的专用测试文档，不改用户文档，记录App版本/macOS版本/Formula提交和签名。使用自建分式、多行、矩阵、希腊字母、单位、长公式、包含元数据的公式各一例。

分别验证：PNG、PDF、SVG、MathML文本、LaTeX文本、未来多representation一次复制；默认粘贴与可用的选择性粘贴。记录实际pasteboard types以及目标实际选择的数据，不以缩放截图证明矢量：需保存后检查对象/资源，或原生对象证据。可编辑要求能修改分子/下标后重新排版，不能把调整图片大小称为数学编辑。

执行粘贴→编辑→保存→退出测试文档→重开→打印到PDF；检查对象、位置、清晰度、原始公式关联、失败fallback。对不支持路径明确标fail并保留安全图形路径。跨App复制回来再验证Formula能否恢复文档。

每行pass必须关联证据包：输入公式、实际types、目标对象类型、编辑结果、重开文件、打印PDF、截图及人工复核记录。未满足时维持未验证，不在主界面增加“复制到Word”承诺。

## 官方研究入口（不是剪贴板实测）

- [Microsoft 365 Math](https://learn.microsoft.com/en-us/office/math/)：文档中存储OMML，支持MathML/LaTeX。
- [Apple LaTeX / MathML support](https://support.apple.com/en-gb/102138)及[Keynote equation dialog](https://support.apple.com/en-au/guide/keynote/tan72a69d01f/mac)：公式对话框接受相应语法。

这些文档未证明 macOS Office 默认粘贴某个UTType就生成可编辑公式；不能套用Windows剪贴板规则。
