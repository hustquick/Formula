# Formula 验证记录

## v1.1.0 发布标准

v1.1.0 不以“界面看起来接近”为验收标准，而以完整数据、稳定交互、布局不变、离线运行和可发布 DMG 五项同时满足为准。

### 1. LaTeX Live 数据完整性

发布构建从 LaTeX Live 官方仓库同步 `json/map_input.json`，并校验快捷工具与公式模板的 layer1 / layer2 结构。

快捷工具必须严格包含 10 类：

1. 常用符号
2. 希腊字母
3. 分数微分
4. 根式角标
5. 极限对数
6. 三角函数
7. 积分运算
8. 大型运算
9. 括号取整
10. 数组矩阵

公式模板必须严格包含 10 类：

1. 代数
2. 几何
3. 不等式
4. 积分
5. 矩阵
6. 三角
7. 统计
8. 数列
9. 物理
10. 化学

`npm run validate:v1.1` 还检查二级项目总量，防止上游结构变化或同步异常导致“只有第一页”式的不完整目录被发布。

### 2. 完全离线目录

构建时同时生成：

- `web/vendor/latexlive/map_input.json`
- `web/vendor/latexlive/catalog.js`

第二个文件用于 macOS WKWebView 的 `file://` 场景，避免应用运行时依赖远端 HTTP 请求。DMG 挂载后再次验证这两个文件确实存在于最终应用包。

### 3. 二级菜单与主窗口布局

以下功能必须使用浮动 palette，不得打开后把主输入区、源码区或输出区向下撑开：

- 10 类快捷工具的全部二级内容
- 符号
- 希腊字母
- 分数 / 微分 / 导数
- 根式 / 角标
- 极限 / 对数
- 三角函数
- 积分
- 大型运算
- 括号
- 矩阵与多行公式
- 10 类公式模板及其二级内容

浮动面板必须：

- 使用固定定位；
- 根据触发按钮定位；
- 自动避让窗口右侧、底部边缘；
- 支持点击空白处关闭；
- 支持 Esc 关闭；
- 支持方向键、Home、End 在菜单项目间导航。

`tests/v1.1.cjs` 会在打开快捷二级菜单和模板二级菜单前后比较 `.input-editors` 的 bounding box，验证主编辑区域几何尺寸不变。

### 4. 矩阵与多行编辑

LaTeX Live 数据中的矩阵“…”示意项不会直接插入。Formula 将其映射成 MathLive 可编辑占位结构，并提供：

- 上方加行
- 下方加行
- 删除行
- 左侧加列
- 右侧加列
- 删除列

已有 `tests/visual-tools.cjs` 继续覆盖分段公式、矩阵、多行、字体、标记和选区结构操作。

### 5. Finder 风格自定义工具栏

`tests/custom-toolbar.cjs` 覆盖：

- 拖入工具栏；
- 工具栏内排序；
- 拖到移除区；
- 配置持久化；
- 恢复默认。

v1.1.0 额外保留“图标＋文字 / 仅图标 / 仅文字”三种显示模式，并在自定义状态显示独立的可用工具 palette 与移除区。

数字键盘不得重新出现；Formula 保留 MathLive 编辑区自身的输入能力，避免右侧功能重复。

### 6. 编辑、排版和导出回归

既有自动测试继续覆盖：

- LaTeX / Typst 输入；
- 可视化与源码双向同步；
- 显式反斜杠数学命令；
- 选区套用结构；
- 分段 / 矩阵 / 多行；
- 无效公式错误处理；
- 收藏与设置；
- SVG / PDF / PNG / JPEG；
- LaTeX / Typst / MathML；
- `.mathforge` 可恢复文件。

本机排版支持 XeLaTeX / pdfLaTeX / LuaLaTeX 与 Typst；dvisvgm 用于 SVG，pdftops 用于 EPS。LaTeX 进程使用 `-no-shell-escape`。

### 7. macOS DMG 发布门槛

GitHub Actions 的发布顺序为：

1. `npm ci`
2. `npm run build:vendor`
3. `npm run sync:latexlive`
4. `npm run validate:v1.1`
5. `bash scripts/build-dmg.sh`
6. 上传 DMG 与 SHA-256
7. 创建 / 更新 `v1.1.0` Release

`build-dmg.sh` 必须验证：

- arm64 和 x86_64 均成功编译；
- `lipo` 合并后的程序同时包含两个架构；
- 临时签名通过 `codesign --verify --deep --strict`；
- DMG 通过 `hdiutil verify`；
- 挂载后应用可执行；
- `Applications` 快捷链接正确；
- 完整 LaTeX Live JSON、file-safe catalog 和 `v1.1.css` 均进入最终 `.app`。

原生 About 窗口版本在构建时从 `Info.plist` 同步，因此发布包内版本信息不会与 DMG 文件名不一致。

## 自动测试入口

- `tests/browser-test.cjs`：编辑、排版、错误、收藏、导出综合回归。
- `tests/visual-tools.cjs`：结构化公式工具。
- `tests/custom-toolbar.cjs`：工具栏拖拽与持久化。
- `tests/reference-layout.cjs`：10 分类、源码 / 可视化切换、浮动菜单布局。
- `tests/v1.1.cjs`：完整目录、浮动菜单、模板、键盘导航、自定义工具栏与数字键盘移除。
- `scripts/validate-v1.1.mjs`：发布前静态硬门槛。

## 尚需区分的验证范围

GitHub Actions 能证明 macOS 编译、Universal Binary、代码签名验证、DMG 创建和包内容完整性；浏览器测试能证明前端交互逻辑。由于应用目前采用临时签名且未 Apple 公证，Finder 首次启动时的 Gatekeeper 体验、不同 macOS 版本上的系统剪贴板 / 文件拖出手感仍属于实机体验验收，而不是 CI 可以完全替代的项目。
