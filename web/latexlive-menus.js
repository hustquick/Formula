(() => {
  const q = (s, root=document) => root.querySelector(s);
  const qa = (s, root=document) => [...root.querySelectorAll(s)];
  const wait = (fn, timeout=10000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const value = fn();
      if (value) return resolve(value);
      if (Date.now() - start > timeout) return reject(new Error('Formula UI init timeout'));
      setTimeout(tick, 30);
    };
    tick();
  });

  const item = (label, latex, preview=latex) => ({label, latex, preview});
  const divider = label => ({divider: label});

  const shortcuts = {
    '常用符号': [
      divider('二元运算符 Binary operations'),
      item('加', '+'), item('减', '-'), item('乘', '\\times '), item('除', '\\div '), item('点乘', '\\cdot '), item('加减', '\\pm '), item('减加', '\\mp '),
      item('并集', '\\cup '), item('交集', '\\cap '), item('平方并', '\\sqcup '), item('平方交', '\\sqcap '), item('逻辑或', '\\vee '), item('逻辑与', '\\wedge '), item('圆运算', '\\circ '), item('星号', '\\ast '), item('星', '\\star '), item('菱形', '\\diamond '), item('大圆点', '\\bullet '), item('张量积', '\\otimes '), item('直和', '\\oplus '), item('圈减', '\\ominus '), item('圈除', '\\oslash '), item('圈点', '\\odot '),
      divider('关系符 Binary relations'),
      item('等于', '='), item('不等于', '\\ne '), item('小于', '<'), item('大于', '>'), item('小于等于', '\\leq '), item('大于等于', '\\geq '), item('约等于', '\\approx '), item('相似', '\\sim '), item('渐近', '\\simeq '), item('恒等', '\\equiv '), item('正比', '\\propto '), item('平行', '\\parallel '), item('不平行', '\\nparallel '), item('垂直', '\\perp '), item('属于', '\\in '), item('不属于', '\\notin '), item('包含', '\\ni '), item('子集', '\\subset '), item('真子集', '\\subsetneq '), item('子集或等于', '\\subseteq '), item('超集', '\\supset '), item('超集或等于', '\\supseteq '), item('远小于', '\\ll '), item('远大于', '\\gg '),
      divider('逻辑与集合 Logic & sets'),
      item('任意', '\\forall '), item('存在', '\\exists '), item('不存在', '\\nexists '), item('非', '\\neg '), item('因为', '\\because '), item('所以', '\\therefore '), item('空集', '\\varnothing '), item('无穷', '\\infty '), item('实数集', '\\mathbb{R} '), item('自然数集', '\\mathbb{N} '), item('整数集', '\\mathbb{Z} '), item('有理数集', '\\mathbb{Q} '), item('复数集', '\\mathbb{C} '),
      divider('箭头 Arrows'),
      item('右箭头', '\\rightarrow '), item('左箭头', '\\leftarrow '), item('双向箭头', '\\leftrightarrow '), item('推出', '\\Rightarrow '), item('推出(左)', '\\Leftarrow '), item('等价', '\\Leftrightarrow '), item('映射', '\\mapsto '), item('长右箭头', '\\longrightarrow '), item('长推出', '\\Longrightarrow '), item('上箭头', '\\uparrow '), item('下箭头', '\\downarrow '), item('双上箭头', '\\Uparrow '), item('双下箭头', '\\Downarrow '),
      divider('其他 Symbols'),
      item('省略号', '\\cdots '), item('低省略号', '\\ldots '), item('竖省略号', '\\vdots '), item('斜省略号', '\\ddots '), item('角', '\\angle '), item('度', '^{\\circ}'), item('撇', '\\prime '), item('偏导符', '\\partial '), item('Nabla', '\\nabla '), item('Aleph', '\\aleph '), item('hbar', '\\hbar '), item('ell', '\\ell ')
    ],
    '希腊字母': [
      divider('小写 Lowercase'),
      ...[['alpha','α'],['beta','β'],['gamma','γ'],['delta','δ'],['epsilon','ε'],['varepsilon','ϵ'],['zeta','ζ'],['eta','η'],['theta','θ'],['vartheta','ϑ'],['iota','ι'],['kappa','κ'],['lambda','λ'],['mu','μ'],['nu','ν'],['xi','ξ'],['omicron','ο'],['pi','π'],['varpi','ϖ'],['rho','ρ'],['varrho','ϱ'],['sigma','σ'],['varsigma','ς'],['tau','τ'],['upsilon','υ'],['phi','ϕ'],['varphi','φ'],['chi','χ'],['psi','ψ'],['omega','ω']].map(([c,l])=>item(l,`\\${c} `)),
      divider('大写 Uppercase'),
      ...[['Gamma','Γ'],['Delta','Δ'],['Theta','Θ'],['Lambda','Λ'],['Xi','Ξ'],['Pi','Π'],['Sigma','Σ'],['Upsilon','Υ'],['Phi','Φ'],['Psi','Ψ'],['Omega','Ω']].map(([c,l])=>item(l,`\\${c} `)),
      divider('常用字体 Math alphabets'),
      item('黑板体', '\\mathbb{#?}', '\\mathbb{R}'), item('花体', '\\mathcal{#?}', '\\mathcal{A}'), item('Fraktur', '\\mathfrak{#?}', '\\mathfrak{A}'), item('正体', '\\mathrm{#?}', '\\mathrm{ABC}'), item('粗体', '\\mathbf{#?}', '\\mathbf{ABC}')
    ],
    '分数微分': [
      divider('分数 Fractions'),
      item('分数', '\\frac{#@}{#?}', '\\frac{x}{y}'), item('小分数', '\\tfrac{#@}{#?}', '\\tfrac{x}{y}'), item('大分数', '\\dfrac{#@}{#?}', '\\dfrac{x}{y}'), item('连分数', '\\cfrac{#@}{#?}', '\\cfrac{1}{x+1}'),
      divider('微分 Differentials'),
      item('微分 d t', '\\mathrm{d}t '), item('一阶导数', '\\frac{\\mathrm{d} #@}{\\mathrm{d} #?}', '\\frac{\\mathrm{d}y}{\\mathrm{d}x}'), item('偏微分', '\\frac{\\partial #@}{\\partial #?}', '\\frac{\\partial y}{\\partial x}'), item('二阶偏导', '\\frac{\\partial^2 #@}{\\partial #?^2}', '\\frac{\\partial^2 y}{\\partial x^2}'), item('混合偏导', '\\frac{\\partial^2 #@}{\\partial #?\\partial #?}', '\\frac{\\partial^2 y}{\\partial x_1\\partial x_2}'), item('梯度', '\\nabla #@', '\\nabla\\psi'), item('拉普拉斯', '\\nabla^2 #@', '\\nabla^2\\psi'),
      divider('导数 Derivatives'),
      item('点导数', '\\dot{#@}', '\\dot{x}'), item('二阶点导数', '\\ddot{#@}', '\\ddot{x}'), item('一撇', "#@'", "f'"), item('二撇', "#@''", "f''"), item('n阶导数', '#@^{(#?)}', 'f^{(n)}'),
      divider('模算术 Modular arithmetic'),
      item('mod', '\\bmod '), item('pmod', '\\pmod{#?}', '\\pmod n'), item('mod 文本', '\\mod{#?}', '\\mod n'), item('gcd', '\\gcd(#@,#?)', '\\gcd(a,b)')
    ],
    '根式角标': [
      divider('根式 Radicals'),
      item('平方根', '\\sqrt{#@}', '\\sqrt{x}'), item('n次根', '\\sqrt[#?]{#@}', '\\sqrt[n]{x}'), item('立方根', '\\sqrt[3]{#@}', '\\sqrt[3]{x}'),
      divider('上下标 Scripts'),
      item('上标', '#@^{#?}', 'x^2'), item('下标', '#@_{#?}', 'x_1'), item('上下标', '#@_{#?}^{#?}', 'x_i^2'), item('左上标', '{}^{#?}#@', '{}^n x'), item('左下标', '{}_{#?}#@', '{}_n x'),
      divider('顶部/底部标记 Accents'),
      item('帽号', '\\hat{#@}', '\\hat{x}'), item('宽帽', '\\widehat{#@}', '\\widehat{ABC}'), item('波浪', '\\tilde{#@}', '\\tilde{x}'), item('宽波浪', '\\widetilde{#@}', '\\widetilde{ABC}'), item('上划线', '\\overline{#@}', '\\overline{AB}'), item('下划线', '\\underline{#@}', '\\underline{AB}'), item('向量', '\\vec{#@}', '\\vec{a}'), item('上花括号', '\\overbrace{#@}^{#?}', '\\overbrace{a+b}^{n}'), item('下花括号', '\\underbrace{#@}_{#?}', '\\underbrace{a+b}_{n}')
    ],
    '极限对数': [
      divider('极限 Limits'),
      item('极限', '\\lim_{#?}#@', '\\lim_{x\\to0}f(x)'), item('趋于无穷', '\\lim_{#?\\to\\infty}#@', '\\lim_{n\\to\\infty}a_n'), item('左极限', '\\lim_{#?\\to#?^-}#@', '\\lim_{x\\to0^-}f(x)'), item('右极限', '\\lim_{#?\\to#?^+}#@', '\\lim_{x\\to0^+}f(x)'), item('上极限', '\\limsup_{#?}#@', '\\limsup_{n\\to\\infty}a_n'), item('下极限', '\\liminf_{#?}#@', '\\liminf_{n\\to\\infty}a_n'),
      divider('对数指数 Logs & exponentials'),
      item('ln', '\\ln #@', '\\ln x'), item('log', '\\log #@', '\\log x'), item('带底log', '\\log_{#?}#@', '\\log_a x'), item('lg', '\\lg #@', '\\lg x'), item('exp', '\\exp(#@)', '\\exp(x)'), item('e指数', 'e^{#@}', 'e^x'),
      divider('界限与投影 Bounds'),
      item('max', '\\max_{#?}#@', '\\max_{x}f(x)'), item('min', '\\min_{#?}#@', '\\min_{x}f(x)'), item('sup', '\\sup_{#?}#@', '\\sup_{x}f(x)'), item('inf', '\\inf_{#?}#@', '\\inf_{x}f(x)')
    ],
    '三角函数': [
      divider('三角函数 Trigonometric'),
      ...['sin','cos','tan','cot','sec','csc'].map(c=>item(c,`\\${c} #@`, `\\${c} x`)),
      divider('反三角 Inverse'),
      ...['arcsin','arccos','arctan'].map(c=>item(c,`\\${c} #@`, `\\${c} x`)),
      item('arccot', '\\operatorname{arccot} #@', '\\operatorname{arccot}x'), item('arcsec', '\\operatorname{arcsec} #@', '\\operatorname{arcsec}x'), item('arccsc', '\\operatorname{arccsc} #@', '\\operatorname{arccsc}x'),
      divider('双曲函数 Hyperbolic'),
      ...['sinh','cosh','tanh','coth'].map(c=>item(c,`\\${c} #@`, `\\${c} x`))
    ],
    '积分运算': [
      divider('积分 Integrals'),
      item('不定积分', '\\int #@\\,\\mathrm{d}#?', '\\int f(x)\\,\\mathrm{d}x'), item('定积分', '\\int_{#?}^{#?}#@\\,\\mathrm{d}#?', '\\int_a^b f(x)\\,\\mathrm{d}x'), item('二重积分', '\\iint_{#?}#@\\,\\mathrm{d}#?', '\\iint_D f\\,\\mathrm{d}A'), item('三重积分', '\\iiint_{#?}#@\\,\\mathrm{d}#?', '\\iiint_V f\\,\\mathrm{d}V'), item('闭合积分', '\\oint_{#?}#@\\,\\mathrm{d}#?', '\\oint_C f\\,\\mathrm{d}s'), item('二重闭合积分', '\\oiint_{#?}#@', '\\oiint_S'),
      divider('常用积分式'),
      item('高斯积分', '\\int_{-\\infty}^{\\infty}e^{-x^2}\\,\\mathrm{d}x=\\sqrt{\\pi}'), item('积分中值', '\\int_a^b f(x)\\,\\mathrm{d}x=f(\\xi)(b-a)')
    ],
    '大型运算': [
      divider('求和与乘积 Large operators'),
      item('求和', '\\sum_{#?}^{#?}#@', '\\sum_{i=1}^{n}a_i'), item('连乘', '\\prod_{#?}^{#?}#@', '\\prod_{i=1}^{n}a_i'), item('余积', '\\coprod_{#?}^{#?}#@', '\\coprod_{i=1}^{n}A_i'), item('大并集', '\\bigcup_{#?}#@', '\\bigcup_{i=1}^{n}A_i'), item('大交集', '\\bigcap_{#?}#@', '\\bigcap_{i=1}^{n}A_i'), item('大平方并', '\\bigsqcup_{#?}#@', '\\bigsqcup_i A_i'), item('大逻辑或', '\\bigvee_{#?}#@', '\\bigvee_i A_i'), item('大逻辑与', '\\bigwedge_{#?}#@', '\\bigwedge_i A_i'), item('大直和', '\\bigoplus_{#?}#@', '\\bigoplus_i V_i'), item('大张量积', '\\bigotimes_{#?}#@', '\\bigotimes_i V_i'),
      divider('上下限位置'),
      item('limits', '\\sum\\limits_{#?}^{#?}#@', '\\sum\\limits_{i=1}^{n}a_i'), item('nolimits', '\\sum\\nolimits_{#?}^{#?}#@', '\\sum\\nolimits_{i=1}^{n}a_i')
    ],
    '括号取整': [
      divider('括号 Brackets'),
      item('圆括号', '\\left(#@\\right)', '\\left(x\\right)'), item('方括号', '\\left[#@\\right]', '\\left[x\\right]'), item('花括号', '\\left\\{#@\\right\\}', '\\left\\{x\\right\\}'), item('角括号', '\\left\\langle#@\\right\\rangle', '\\langle x\\rangle'), item('绝对值', '\\left|#@\\right|', '|x|'), item('范数', '\\left\\lVert#@\\right\\rVert', '\\lVert x\\rVert'), item('向下取整', '\\left\\lfloor#@\\right\\rfloor', '\\lfloor x\\rfloor'), item('向上取整', '\\left\\lceil#@\\right\\rceil', '\\lceil x\\rceil'),
      divider('常用 Commons'),
      item('二项式', '\\binom{#@}{#?}', '\\binom{n}{k}'), item('小二项式', '\\tbinom{#@}{#?}', '\\tbinom{n}{k}'), item('大二项式', '\\dbinom{#@}{#?}', '\\dbinom{n}{k}'), item('半开区间', '\\left[#@,#?\\right)', '[0,1)'), item('bra', '\\left\\langle#@\\right|', '\\langle\\psi|'), item('ket', '\\left|#@\\right\\rangle', '|\\psi\\rangle'), item('内积', '\\left\\langle#@\\middle|#?\\right\\rangle', '\\langle\\psi|\\phi\\rangle')
    ],
    '数组矩阵': [
      divider('矩阵 Matrices'),
      item('无括号矩阵', '\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}', '\\begin{matrix}a&b\\\\c&d\\end{matrix}'), item('方括号矩阵', '\\begin{bmatrix}#@&#?\\\\#?&#?\\end{bmatrix}', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'), item('圆括号矩阵', '\\begin{pmatrix}#@&#?\\\\#?&#?\\end{pmatrix}', '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'), item('花括号矩阵', '\\begin{Bmatrix}#@&#?\\\\#?&#?\\end{Bmatrix}', '\\begin{Bmatrix}a&b\\\\c&d\\end{Bmatrix}'), item('行列式', '\\begin{vmatrix}#@&#?\\\\#?&#?\\end{vmatrix}', '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}'), item('双竖线矩阵', '\\begin{Vmatrix}#@&#?\\\\#?&#?\\end{Vmatrix}', '\\begin{Vmatrix}a&b\\\\c&d\\end{Vmatrix}'), item('小矩阵', '\\begin{smallmatrix}#@&#?\\\\#?&#?\\end{smallmatrix}', '\\bigl(\\begin{smallmatrix}a&b\\\\c&d\\end{smallmatrix}\\bigr)'),
      divider('多行与条件 Multiline'),
      item('条件等式', '\\begin{cases}#@,&#?\\\\#?,&#?\\end{cases}', '\\begin{cases}x,&x>0\\\\-x,&x<0\\end{cases}'), item('多行对齐', '\\begin{aligned}#@&#?\\\\#?&#?\\end{aligned}', '\\begin{aligned}f(x)&=a+b\\\\&=c+d\\end{aligned}'), item('gathered', '\\begin{gathered}#@\\\\#?\\end{gathered}', '\\begin{gathered}a=b\\\\c=d\\end{gathered}'), item('array', '\\begin{array}{cc}#@&#?\\\\#?&#?\\end{array}', '\\begin{array}{cc}a&b\\\\c&d\\end{array}'),
      divider('矩阵编辑 Matrix editing'),
      {command:'addRowBefore', label:'上方加行'}, {command:'addRowAfter', label:'下方加行'}, {command:'removeRow', label:'删除行'}, {command:'addColumnBefore', label:'左侧加列'}, {command:'addColumnAfter', label:'右侧加列'}, {command:'removeColumn', label:'删除列'}
    ]
  };

  const templates = {
    '代数': [
      item('因式分解', '\\left(x-1\\right)\\left(x+3\\right)'), item('勾股式', '\\sqrt{a^2+b^2}'), item('幂的商', '\\left(\\frac{a}{b}\\right)^n=\\frac{a^n}{b^n}'), item('分式加减', '\\frac{a}{b}\\pm\\frac{c}{d}=\\frac{ad\\pm bc}{bd}'), item('双曲线', '\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1'), item('根式有理化', '\\frac{1}{\\sqrt a}=\\frac{\\sqrt a}{a}'), item('n次根', '\\sqrt[n]{a^n}=\\left(\\sqrt[n]{a}\\right)^n'), item('一元二次求根', 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'), item('点斜式', 'y-y_1=k(x-x_1)'), item('圆参数方程', '\\begin{cases}x=a+r\\cos\\theta\\\\y=b+r\\sin\\theta\\end{cases}'), item('韦达定理', '\\begin{aligned}x_1+x_2&=-\\frac ba\\\\x_1x_2&=\\frac ca\\end{aligned}')
    ],
    '几何': [
      item('圆', 'x^2+y^2=r^2'), item('圆一般式', '(x-a)^2+(y-b)^2=r^2'), item('椭圆', '\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1'), item('抛物线', 'y^2=2px'), item('两点距离', 'd=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}'), item('中点', 'M\\left(\\frac{x_1+x_2}{2},\\frac{y_1+y_2}{2}\\right)'), item('三角形面积', 'S=\\frac12 ab\\sin C'), item('余弦定理', 'c^2=a^2+b^2-2ab\\cos C'), item('正弦定理', '\\frac a{\\sin A}=\\frac b{\\sin B}=\\frac c{\\sin C}=2R'), item('海伦公式', 'S=\\sqrt{p(p-a)(p-b)(p-c)}')
    ],
    '不等式': [
      item('传递性', 'a>b,\\ b>c\\Rightarrow a>c'), item('同向相加', 'a>b,c>d\\Rightarrow a+c>b+d'), item('绝对值下界', '|a-b|\\geq||a|-|b||'), item('绝对值夹逼', '-|a|\\leq a\\leq|a|'), item('三角不等式', '|a+b|\\leq|a|+|b|'), item('Cauchy-Schwarz', '\\left(\\sum_{k=1}^n a_kb_k\\right)^2\\leq\\left(\\sum_{k=1}^n a_k^2\\right)\\left(\\sum_{k=1}^n b_k^2\\right)'), item('算术几何均值', '\\frac{a+b}{2}\\geq\\sqrt{ab}'), item('平方不等式', 'a^2+b^2\\geq2ab')
    ],
    '积分': [
      item('幂函数导数', '\\frac{\\mathrm d}{\\mathrm dx}x^n=nx^{n-1}'), item('指数导数', '\\frac{\\mathrm d}{\\mathrm dx}e^{ax}=ae^{ax}'), item('对数导数', '\\frac{\\mathrm d}{\\mathrm dx}\\ln x=\\frac1x'), item('正弦导数', '\\frac{\\mathrm d}{\\mathrm dx}\\sin x=\\cos x'), item('余弦导数', '\\frac{\\mathrm d}{\\mathrm dx}\\cos x=-\\sin x'), item('乘积求导', '(uv)\' =u\'v+uv\''), item('商求导', '\\left(\\frac uv\\right)\'=\\frac{u\'v-uv\'}{v^2}'), item('分部积分', '\\int u\\,\\mathrm dv=uv-\\int v\\,\\mathrm du'), item('牛顿-莱布尼茨', '\\int_a^b f(x)\\,\\mathrm dx=F(b)-F(a)'), item('高斯积分', '\\int_{-\\infty}^{\\infty}e^{-x^2}\\,\\mathrm dx=\\sqrt\\pi')
    ],
    '矩阵': [
      item('二阶矩阵', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'), item('单位矩阵', 'I=\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}'), item('三阶单位阵', 'I_3=\\begin{bmatrix}1&0&0\\\\0&1&0\\\\0&0&1\\end{bmatrix}'), item('行列式', '\\det A=\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}=ad-bc'), item('逆矩阵', 'A^{-1}=\\frac1{ad-bc}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}'), item('线性方程组', '\\begin{cases}a_{11}x_1+a_{12}x_2=b_1\\\\a_{21}x_1+a_{22}x_2=b_2\\end{cases}'), item('特征方程', '\\det(A-\\lambda I)=0')
    ],
    '三角': [
      item('平方和', '\\sin^2x+\\cos^2x=1'), item('正切关系', '\\tan x=\\frac{\\sin x}{\\cos x}'), item('和角正弦', '\\sin(\\alpha+\\beta)=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta'), item('和角余弦', '\\cos(\\alpha+\\beta)=\\cos\\alpha\\cos\\beta-\\sin\\alpha\\sin\\beta'), item('二倍角正弦', '\\sin2x=2\\sin x\\cos x'), item('二倍角余弦', '\\cos2x=\\cos^2x-\\sin^2x'), item('半角正弦', '\\sin^2\\frac x2=\\frac{1-\\cos x}{2}'), item('积化和差', '2\\sin A\\cos B=\\sin(A+B)+\\sin(A-B)')
    ],
    '统计': [
      item('均值', '\\bar{x}=\\frac1n\\sum_{i=1}^n x_i'), item('方差', 's^2=\\frac1{n-1}\\sum_{i=1}^n(x_i-\\bar{x})^2'), item('标准差', 's=\\sqrt{\\frac1{n-1}\\sum_{i=1}^n(x_i-\\bar{x})^2}'), item('协方差', '\\operatorname{cov}(X,Y)=E[(X-E X)(Y-E Y)]'), item('相关系数', '\\rho_{XY}=\\frac{\\operatorname{cov}(X,Y)}{\\sigma_X\\sigma_Y}'), item('正态分布', 'f(x)=\\frac1{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}'), item('二项分布', 'P(X=k)=\\binom nk p^k(1-p)^{n-k}'), item('贝叶斯公式', 'P(A_i|B)=\\frac{P(B|A_i)P(A_i)}{\\sum_jP(B|A_j)P(A_j)}')
    ],
    '数列': [
      item('等差通项', 'a_n=a_1+(n-1)d'), item('等差求和', 'S_n=\\frac n2[2a_1+(n-1)d]'), item('等比通项', 'a_n=a_1q^{n-1}'), item('等比求和', 'S_n=a_1\\frac{1-q^n}{1-q}'), item('裂项', '\\frac1{4n^2-1}=\\frac12\\left(\\frac1{2n-1}-\\frac1{2n+1}\\right)'), item('二项式定理', '(1+x)^n=1+\\frac{nx}{1!}+\\frac{n(n-1)x^2}{2!}+\\cdots'), item('递推', 'a_{n+1}=f(a_n)')
    ],
    '物理': [
      item('牛顿第二定律', '\\vec F=m\\vec a=m\\frac{\\mathrm d^2\\vec r}{\\mathrm dt^2}'), item('万有引力势能', 'E_p=-\\frac{GMm}{r}'), item('库仑定律', '\\vec F=k\\frac{Qq}{r^2}\\hat r'), item('安培力', '\\mathrm d\\vec F=I\\,\\mathrm d\\vec l\\times\\vec B'), item('法拉第定律', '\\mathcal E=-\\frac{\\mathrm d\\Phi_B}{\\mathrm dt}'), item('高斯定律', '\\oint_S\\vec E\\cdot\\mathrm d\\vec S=\\frac{Q_{\\rm enc}}{\\varepsilon_0}'), item('焦耳热', 'Q=I^2Rt'), item('质能方程', 'E=mc^2'), item('薛定谔方程', 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi=\\hat H\\Psi'), item('理想气体', 'pV=nRT')
    ],
    '化学': [
      item('反应方程式', '\\mathrm{2H_2+O_2\\rightarrow2H_2O}'), item('平衡反应', '\\mathrm{N_2+3H_2\\rightleftharpoons2NH_3}'), item('质量分数', 'w=\\frac{m_{\\rm solute}}{m_{\\rm solution}}'), item('物质的量浓度', 'c=\\frac nV'), item('理想气体摩尔体积', 'pV=nRT'), item('pH', '\\mathrm{pH}=-\\log_{10}[\\mathrm H^+]'), item('平衡常数', 'K_c=\\frac{[C]^c[D]^d}{[A]^a[B]^b}')
    ]
  };

  function buttonFor(entry, className='ll-item') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.title = entry.label;
    b.dataset.llLatex = entry.latex;
    const art = document.createElement('span');
    art.className = 'll-preview';
    art.textContent = entry.preview || entry.latex;
    const label = document.createElement('span');
    label.className = 'll-label';
    label.textContent = entry.label;
    b.append(art, label);
    return b;
  }

  async function renderMath(root=document) {
    if (!window.MathJax?.tex2svgPromise) return;
    const nodes = qa('.ll-preview:not([data-rendered])', root);
    for (const node of nodes) {
      const latex = node.textContent;
      try {
        const svg = await MathJax.tex2svgPromise('\\displaystyle ' + latex.replaceAll('#@','x').replaceAll('#?','y'), {display:false});
        node.replaceChildren(svg);
        node.dataset.rendered = '1';
      } catch {
        node.dataset.rendered = 'error';
      }
    }
  }

  function insertLatex(latex) {
    const mf = q('#editor-mount math-field');
    if (!mf || mf.readOnly) return;
    mf.focus();
    try {
      mf.insert(latex, {mode:'math', format:'latex', insertionMode:'replaceSelection', selectionMode:'placeholder', focus:true});
      mf.dispatchEvent(new Event('input', {bubbles:true}));
      q('#input-visual')?.click();
    } catch (e) {
      console.error(e);
    }
  }

  function command(command) {
    const mf = q('#editor-mount math-field');
    if (!mf || mf.readOnly) return;
    mf.focus();
    mf.executeCommand(command);
    mf.dispatchEvent(new Event('input', {bubbles:true}));
  }

  function upgradeShortcutMenus(tools) {
    const groups = qa(':scope > .tool-group', tools);
    for (const group of groups) {
      const name = q('summary', group)?.getAttribute('aria-label') || q('summary', group)?.textContent.trim();
      const entries = shortcuts[name];
      if (!entries) continue;
      const panel = q(':scope > div', group);
      panel.replaceChildren();
      panel.classList.add('ll-popup-grid');
      for (const entry of entries) {
        if (entry.divider) {
          const h = document.createElement('div');
          h.className = 'll-divider';
          h.textContent = entry.divider;
          panel.append(h);
        } else if (entry.command) {
          const b = document.createElement('button');
          b.type = 'button'; b.className='ll-item ll-command'; b.textContent=entry.label; b.dataset.llCommand=entry.command; panel.append(b);
        } else panel.append(buttonFor(entry));
      }
    }
  }

  function buildTemplateBrowser(examples) {
    examples.className = 'examples ll-template-browser';
    examples.replaceChildren();
    const nav = document.createElement('div'); nav.className='ll-template-nav'; examples.append(nav);
    const panel = document.createElement('div'); panel.className='ll-template-panel'; panel.hidden=true; examples.append(panel);
    let active = '';
    for (const [name, entries] of Object.entries(templates)) {
      const b = document.createElement('button'); b.type='button'; b.className='ll-template-category'; b.dataset.category=name;
      const art = document.createElement('span'); art.className='ll-category-art ll-preview'; art.textContent=entries[0]?.preview || entries[0]?.latex || name;
      const label = document.createElement('span'); label.textContent=name;
      const arrow = document.createElement('span'); arrow.className='ll-category-arrow'; arrow.textContent='⌄';
      b.append(art,label,arrow); nav.append(b);
      b.onclick = async () => {
        if (active === name && !panel.hidden) { panel.hidden=true; active=''; b.classList.remove('active'); return; }
        qa('.ll-template-category', nav).forEach(x=>x.classList.toggle('active', x===b));
        active=name; panel.hidden=false; panel.replaceChildren();
        const title=document.createElement('div'); title.className='ll-panel-title'; title.innerHTML=`<strong>${name}</strong><span>${entries.length} 个模板</span>`; panel.append(title);
        const grid=document.createElement('div'); grid.className='ll-template-grid'; panel.append(grid);
        for (const entry of entries) grid.append(buttonFor(entry,'ll-template-item'));
        await renderMath(panel);
      };
    }
    renderMath(nav);
  }

  function wireEvents() {
    document.addEventListener('click', e => {
      const latexButton = e.target.closest('[data-ll-latex]');
      if (latexButton) { e.preventDefault(); insertLatex(latexButton.dataset.llLatex); return; }
      const commandButton = e.target.closest('[data-ll-command]');
      if (commandButton) { e.preventDefault(); command(commandButton.dataset.llCommand); }
    });
  }

  Promise.all([
    wait(() => q('#tools')),
    wait(() => q('.examples')),
    wait(() => q('#editor-mount math-field'))
  ]).then(async ([tools, examples]) => {
    upgradeShortcutMenus(tools);
    buildTemplateBrowser(examples);
    wireEvents();
    await renderMath(tools);
    document.documentElement.dataset.latexLiveMenus = 'ready';
  }).catch(console.error);
})();
