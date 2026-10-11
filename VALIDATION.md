# 验证记录

- 离线页面直接从 file:// 运行，无需本地服务器；无外部 HTTP / HTTPS 请求。
- 自动测试通过 LaTeX 与 Typst 双向输入、矩阵、多行公式、无效公式、收藏与设置。
- 实际导出并读取 SVG、PDF、PNG、JPEG、LaTeX、Typst、MathML 与可恢复公式 JSON。
- PDF 检查：单页，公式为矢量内容，图像 XObject 数量为 0。
- PNG 检查：RGBA，透明区域 alpha 为 0；JPEG 背景为白色。
- LaTeX 原生模板使用 pdfLaTeX 实际编译成功，单页、自动裁切。
- Typst 0.15.1 使用原生模板实际生成 PDF 与 SVG；SVG 包含字形路径。
- pdftops 实际将 LaTeX PDF 转为 EPS 成功。
- 两个 Mac 启动 / 构建脚本通过 bash 语法检查；Info.plist 可解析。
- Swift 的 Cocoa / WebKit / PDFKit 原生部分、启动包装器、系统路径检测、Mac 剪贴板、文件拖出与 Gatekeeper 未在 macOS 上编译或实机验证。首次启动会在用户的 Mac 上构建；构建错误写入 Application Support/Formula/build.log。

测试入口：tests/browser-test.cjs。浏览器验证覆盖最新交付包；不能替代 Mac 实机验收。

## 1.0.1 兼容修复

- 缺少 standalone.cls 时，普通公式使用 article 公式盒裁切回退。该模板在 pdfLaTeX、XeLaTeX、LuaLaTeX 三种引擎上实际生成单页、裁切正确的 PDF。
- 预览区显示本机排版的具体错误，并支持查看 / 复制完整日志和重试；前端原生桥模拟错误测试通过。
- 用户截图没有包含编译日志，因此尚不能确认其 Mac 上此次失败的实际原因。

## 1.0.2 打包修复

- 修复 1.0.1 启动包装器在复制时变为 644 的权限错误。
- 使用统一的 package-mac.py 入口，在所有复制完成后设置 755，并检查 ZIP 内启动器、构建脚本的权限及 shebang。

## 1.0.3 双向编辑修复

- 修复 HTML 工具栏命令多余的反斜杠，根号与分数按钮插入真实公式结构。
- 可视化输入、删除和工具栏修改同步到源码，并使旧导出结果失效、更新预览；补充焦点、输入法及 WebKit 重绘同步处理。
- 实际浏览器键盘测试：输入 x^2+1、选中后添加根号、空根号输入 9、分数输入 1 和 2；每步检查源码及 SVG 预览。
- 完整离线测试通过，包括 LaTeX / Typst、矩阵、多行公式、8 种导出、收藏、错误与设置。
- 本次前端修复在 Chromium 中验证，未在本机 macOS WebKit 上执行。
