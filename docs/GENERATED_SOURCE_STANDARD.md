# 软件生成源码规范

所有软件生成路径共用web/format-latex.mjs。LaTeX简单分式保持紧凑；含复合参数、嵌套分式/根式时按层级展开；多行环境逐行缩进。Typst遵循函数参数、矩阵行与cases惯用结构。文本、注释、verbatim及不确定自定义宏参数保守保留，不为整齐修改语义。

手工源码不持续重排。可视化同步、OCR、模板插入、示例和语言转换分别在生成边界调用格式化，导出使用当前手工原文或规范生成源码。构建目录JSON与catalog.js保存规范化模板；不是仅显示修饰。

自动补全产生的环境块保持配对与缩进，不在用户键入期间整体format。单词候选无需复杂格式化。后续参数snippet须调用同一规范。

验证：generated-source测试compact/复杂结构、语义tokens、幂等与文本保护；template-generated-source覆盖126模板实际MathJax渲染；source-mode验证手工原文精确往返。Typst本机引擎实测mat/frac/cases格式化后编译通过。不能保证任意自定义宏和文档代码可重排，因此保持原样。
