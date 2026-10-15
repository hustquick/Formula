# A02 — 焦点感知与标准复制

日期：2026-10-15。状态：COMPLETE。本轮只验收A02，当前批次1/5；未开始A16。主清单为DEVELOPMENT_AUDIT.md B表。

## 范围与修复

辅助输入原有快捷键原生编辑路由已存在，本轮验证而非重写。修复源码空选区复制会写入空字符串的问题；只读普通DOM文字选区交回原生复制；排除MathLive shadow DOM遗留隐藏选区，确保聚焦预览后仍复制图形。没有修改文档数据结构、转换、撤销模型或UI布局。

文件：web/app.js、tests/focus-copy-matrix.cjs、tests/native-clipboard-probe.swift、DEVELOPMENT_AUDIT.md及本目录证据。当前工作区有此前未发布修改，本项未混合提交；没有push/merge/release。

## 自动验证

- PASS 定向矩阵760/1120/1440：命令搜索、LaTeX导言、Typst前置、批量源码、两种公式源码选区/空选区、只读DOM文本、MathLive选区、预览图形；菜单命令与键盘路由均覆盖。
- PASS npm run test:editor：31组全部通过，包含commands、command-shortcuts、revision-history、audit-regressions、source-mode、selection-transforms、commercial-audit、output等受影响回归。完整输出editor-tests.log。
- PASS node --check web/app.js、tests/focus-copy-matrix.cjs。
- PASS build:vendor；Swift原生编译、离线资源清单、ad-hoc签名校验、安装资源与工作区bundle逐字节相同。没有专用lint/typecheck脚本，不将语法检查表述成完整类型检查。

初次验证曾失败：测试控件ID误用mode-visual；设置字段fill引起异步导言重编译重置选区。已使用实际input-visual及无事件复制夹具隔离修复。另一个真实边界是MathLive隐藏选区抢走预览复制，已修复产品判断并保留回归。最终完整套件无未解决失败。

## 真正Mac应用验证（非桥接mock）

通过CUA操作已安装Formula，Swift AppKit探针直接读取NSPasteboard；不记录用户剪贴板正文，原剪贴板多类型数据在测试后恢复。

- PASS Typst源码全选后⌘C：与当前显示的源码完全一致。
- PASS LaTeX源码⌘C：保留原始cfrac命令，不被派生转换覆盖。
- PASS 源码无选区⌘C：已有哨兵文本未改变。
- PASS 命令搜索hat选区⌘C：系统剪贴板确为hat，未写入图形。
- PASS 编辑→复制菜单：将哨兵替换为hat，原生菜单到responder实际生效。
- PASS ⌘3聚焦预览后⌘C：系统剪贴板含public.png、public.svg-image、public.tiff和org.mathforge.equation。

浏览器覆盖其余焦点矩阵；真实Mac抽测上述高风险路径。本项不证明Word/WPS/Pages粘贴或可编辑公式兼容，留在A24；不证明A25完整历史所有权。

## 安装与数据

已安装并启动/Applications/Formula.app，org.mathforge.desktop保持不变。最终备份：~/Library/Application Support/Formula-Backups/20261015-092737/Formula.app。日志install.log。安装包含当前工作区已有改动，并非声称其他审计项已验收。

测试期间用户将公式改为cfrac；未用较早备份覆盖，最后安装前后的state.json完全一致。没有修改、迁移或下载OCR模型。没有改变用户数据schema，不需要迁移。

等待用户体验：在搜索/设置文字框复制后切回预览复制；确认符合个人使用习惯。此用户体验确认独立于已执行的技术测试；GitHub尚未推送。
