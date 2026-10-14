# 任务驱动迭代 TODO

- [x] Phase1：生成DEVELOPMENT_AUDIT.md（实现定位、能力边界、LVSM差距）。
- [x] Phase2：生成PRODUCT_UX_SPEC.md（场景、布局、连续性、数据兼容、验收）。
- [ ] 向用户汇报审查结果后开始增量实现；不推送。
- [ ] P0：跨窗口稳定frames回归、修复隐式切可视化、修复原生导入入口。
- [ ] P0：Last Valid Preview状态机与禁止陈旧结果输出。
- [ ] P0：clipboard目标软件兼容性，原文本/选区复制回归。
- [ ] P1：独立History模型与轻量搜索/恢复/pin；旧收藏不迁移丢失。
- [ ] P1：共享OCR完整性检查、install-local回滚与真实模型复用验收。
- [ ] P1：模板/收藏/历史共享检索与最近使用。
- [ ] P2：补全/ghost bracket、恢复UTI/PNG、Services/Continuity评估。
- [ ] 每个实现小阶段：构建、自动检查、备份安装正式ID、启动、用户验收；未授权不GitHub写入。

## 第一批P0执行记录（2026-10-14）

- 已实施：上一有效预览保留/失效输出保护、760/1120窗口工具区占位、源码模板插入不切可视化、原生导入入口修复。
- 实际通过：source-mode、output-actions、clipboard-ocr、last-valid-preview。类型/运行编译由install-local完成；签名校验通过。
- 已备份替换/Applications/Formula.app并确认进程启动，正式ID与MathForge/OCR不变；未新建Dev环境。
- 尚待：本机用户验收、完整焦点/Undo跨路径回归、真实目标软件粘贴、History。
- 审查文档已授权推送；本批功能改动仅本地，等待用户确认。

- 可视化生成LaTeX源码已接入多行格式化；visual-format测试选区/焦点与切换保留通过，源码/OCR/独立缩放回归通过。本机安装启动，未推送，等待体验。

- 源码辅助第一批：LaTeX/Typst前缀补全、未闭合括号提示（不自动写入）、Tab接受、右括号跳过、IME保护；source-assist验证补全/接受/Undo。尚待多候选/fuzzy/近用/收藏snippet、光标处ghost与完整环境配对。未推送。

- 已补多候选（最多6项）、前缀优先/子序列模糊匹配、上下键与Enter/Tab选择、光标处不入源码ghost、Esc关闭与IME保护。source-candidates/source-assist/source-mode及Typst、多行ghost位置测试通过；备份本机安装启动，未推送。

- 对标LaTeX Workshop：已固定MIT许可数据版本475476b5，接入macros/environments；begin上下文补全配对环境，end栈匹配含嵌套/已有右括号/Undo已测试。已本机备份安装启动，未推送。参数snippet/占位导航仍待实现，不能称完整VSCode体验。

- Typst新增math/sym/#上下文及函数词条，真实浏览器候选接受测试通过；本轮安装被Mac锁屏阻止，等待解锁，不推送。代码指令仅本机Typst能编译，不承诺内置转换支持。

- 修复高公式居中导致顶部不可滚动的问题：auto margins溢出归零，首末行可达且frame不变。preview-overflow/native-preview-size通过；本机备份安装，Typst更新一起部署，未推送。

- 统一生成源码：format-latex.mjs提供LaTeX/Typst规范；OCR/可视化/模板/快捷示例/语言转换与源码导出接入，构建时存储格式化模板。126模板解析渲染及幂等通过，Typst mat/frac/cases真实编译通过；手工源码往返精确回归通过。本机备份安装启动，待验收，未推送。
