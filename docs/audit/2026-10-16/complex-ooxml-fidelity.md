# 复杂公式保真回归

## 审计与最小修改

本轮重新阅读项目 AGENTS.md 及两份在线设计/交付基线。只修改 macos/formula-latex-ooxml.py 及测试，不改布局、编辑模式、文本复制入口或用户数据。

确认连续函数归组缺陷：原实现把 sin cos x 转为 sin 的参数是 cos 字母，x 留在函数外。本次改为由右向左归组，每次重新读取父节点的邻接关系，允许参数为已有 m:func，实现 sin(cos(x)) 嵌套结构。未知/非相邻参数仍不推测跨运算符归组。

进一步核实：eqArr 中的 & 本来就是 OOXML 的对齐点，不是需要删掉的可见错误。保持原标记，通过结构测试，仍需宿主实际验证。官方规范说明：https://learn.microsoft.com/en-au/dotnet/api/documentformat.openxml.math.equationarray?view=openxml-2.9.1 。

确认上游限制：本机 Pandoc 3.9 把 mathbf{A} 输出为 m:sty bi（粗斜体），并将负间距命令转换为 U+200B 零宽字符。这两项尚无已验证的保真修正。因此本轮控制序列扫描器在转换前明确拒绝 mathbf 与负薄间距控制符，避免静默误报成功；扫描尊重注释和转义反斜杠。它不是任意 LaTeX 的完整保真检测器，其他未测试语法仍可能有损。不将原生复制失败算作功能完成。

显式 LaTeX、Typst、MathML、SVG、PNG 复制入口不变。拒绝影响原生/智能复制，原源码与既有剪贴板保留。boldsymbol 不等价于 mathbf，不能建议用户用它替换来冒充保真支持。

## 实际验证

`tests/latex-ooxml-probe.py`：5 个测试方法通过，包括 7 组复杂结构子用例。新增对连续嵌套函数、带幂/定界符/分式函数参数、积分上下限、分段二维结构、多行对齐点、黑板体/花体/无衬线/粗斜体属性和正间距 Unicode 序列的断言。另确认已知有损命令在产物生成前拒绝。

原积分 equation-upright、equation-clipboard、source-equation-race 和 universal-pasteboard 全部通过；前端离线 bundle 构建通过。这些是源码/OOXML/剪贴板回归证据，不是 WPS 显示验收。

## 本轮 WPS 人工验收输入

分别在 Formula 源码输入以下表达式，点击预览 Command+C，再在 WPS 空段落 Command+V：

连续函数：

```latex
\sin\cos x+\arctan\frac{x}{y}
```

核对函数没有漏字、额外空白或错误参数范围，并可整体进入编辑。

分段：

```latex
f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}
```

核对左大括号、两行两列和条件；确认其为整体可编辑公式。

积分上下限：

```latex
\int_0^\infty e^{-x}\,\mathrm{d}x=1
```

核对上下限、指数、直立 d、主动指定的薄间距。

当前仍未进行 Word/Pages 及跨 WPS 版本验证。mathbf 与负间距是已知技术限制，待进一步研究，不能宣称全部复杂公式无损。未推送 GitHub，未获本轮推送授权。

部署状态：scripts/install-local.sh 构建、离线资源核验、ad-hoc 签名校验通过，已安装并确认启动 /Applications/Formula.app。备份 /Users/hustquick/Library/Application Support/Formula-Backups/20261016-183655/Formula.app。数据和模型未删除/重复下载。等待上述复杂样例的本轮 WPS 人工验收。

## 本轮用户实际验收

用户在已部署版本使用连续函数 sin(cos x)+arctan(x/y) 与分段函数两条测试公式，通过 Formula 预览 Command+C → WPS Command+V 后，明确确认“两条均正确且整体可编辑”。这两项本轮人工验收通过，包含连续函数归组与分段结构；不扩展为全部复杂公式、其他宿主或版本的兼容保证。积分上下限等本轮新增结构仅有自动测试证据，尚未获得本轮对应人工确认。

代码修改、构建、自动测试、安装启动及两项用户验收已分别记录。mathbf 和负间距仍是明确阻塞的语法，未宣称解决。未推送 GitHub，尚未获得明确推送授权。
