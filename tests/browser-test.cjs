// Uses Playwright supplied by the developer environment, or an installed playwright package.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.MATHFORGE_BROWSER ? {executablePath:process.env.MATHFORGE_BROWSER,args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  const page=await browser.newPage({viewport:{width:1180,height:960},acceptDownloads:true});
  const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1'))remote.push(r.url())});
  await page.goto(process.env.MATHFORGE_URL||'http://127.0.0.1:8765');
  const ready=()=>page.waitForFunction(()=>document.querySelector('#preview svg')&&window.FormulaTest?.getSVG());
  await ready();await page.locator('[data-tab=custom]').click();assert.equal(await page.locator('#formula').count(),1);
  for(const [input,expected] of [
    ['Q_{i n c o m e} + x ^ { 2 }','Q_{income}+x^{2}'],
    ['\\alpha x + \\sin x','\\alpha x+\\sin x'],
    ['\\frac { a + b } { c }','\\frac{a+b}{c}'],
    ['\\text{net income { per year }} + x','\\text{net income { per year }}+x'],
    ['a \\, b + c \\ d','a\\,b+c\\ d']
  ])assert.equal(await page.evaluate(input=>FormulaTest.compactVisualLatex(input),input),expected);
  // Alphabetic input stays literal; only explicit backslash commands expand.
  for(const letters of ['in','pi','alpha','sin','sqrt','int','sum']){
    await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.type(letters);
    await page.waitForFunction(letters=>document.getElementById('source').value===letters&&document.querySelector('#preview svg'),letters);
  }
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.type('Q_in');await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.getElementById('source').value.replace(/\s/g,'')==='Q_{in}'&&document.querySelector('#preview svg'));
  for(const command of ['in','pi','alpha','sin']){
    await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.type('\\'+command);await page.keyboard.press('Enter');
    await page.waitForFunction(command=>document.getElementById('source').value.trim()==='\\'+command&&document.querySelector('#preview svg'),command);
  }
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.type('\\sqrt');await page.keyboard.press('Enter');await page.keyboard.type('9');
  await page.waitForFunction(()=>/^\\sqrt(?:\{9\}|9)$/.test(document.getElementById('source').value)&&document.querySelector('#preview svg'));
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.type('\\frac');await page.keyboard.press('Enter');await page.keyboard.type('1');await page.keyboard.press('Tab');await page.keyboard.type('2');
  await page.waitForFunction(()=>['\\frac{1}{2}','\\frac12'].includes(document.getElementById('source').value)&&document.querySelector('#preview svg'));
  for(const [name,expected] of [['下标','Q_{income}'],['上标','Q^{income}']]){
    await page.evaluate(()=>{formula.focus();formula.select();});await page.keyboard.type('Qincome');
    for(let i=0;i<6;i++)await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await page.evaluate(()=>formula.getValue(formula.selection,'latex')),'income');
    await page.locator('#tools').getByRole('button',{name}).filter({visible:true}).click();await page.waitForFunction(expected=>document.getElementById('source').value===expected&&document.querySelector('#preview svg'),expected);
  }
  for(const [name,command] of [['分数','frac'],['积分','int'],['求和','sum'],['矩阵','begin{pmatrix}']]){
    await page.evaluate(()=>{formula.focus();formula.select();});await page.keyboard.type('x+1');await page.evaluate(()=>formula.select());
    await page.locator('#tools').getByRole('button',{name}).filter({visible:true}).click();await page.waitForFunction(command=>document.getElementById('source').value.includes('\\'+command)&&document.getElementById('source').value.includes('x+1')&&document.querySelector('#preview svg'),command);
  }
  // Exercise the visual editor with keyboard events, rather than only source edits.
  await page.locator('#formula').click();await page.evaluate(()=>document.getElementById('formula').select());await page.keyboard.type('x^2+1');
  await page.waitForFunction(()=>document.getElementById('source').value==='x^2+1'&&document.querySelector('#preview svg'));
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});
  await page.getByRole('button',{name:'根号'}).filter({visible:true}).click();await page.waitForFunction(()=>document.getElementById('source').value.includes('\\sqrt{x^2+1}'));
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.press('Backspace');
  await page.getByRole('button',{name:'根号'}).filter({visible:true}).click();await page.keyboard.type('9');
  await page.waitForFunction(()=>/^\\sqrt(?:\{9\}|9)$/.test(document.getElementById('source').value)&&document.querySelector('#preview svg'));
  await page.evaluate(()=>{const mf=document.getElementById('formula');mf.focus();mf.select();});await page.keyboard.press('Backspace');
  await page.getByRole('button',{name:'分数'}).filter({visible:true}).click();await page.keyboard.type('1');await page.keyboard.press('Tab');await page.keyboard.type('2');
  await page.waitForFunction(()=>['\\frac{1}{2}','\\frac12'].includes(document.getElementById('source').value)&&document.querySelector('#preview svg'));
  await page.locator('#input-source').click();await page.locator('#source').fill(String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`);await page.evaluate(()=>FormulaTest.readSource());await ready();
  await page.locator('#mode-typst').click();assert(await page.locator('#mode-typst').evaluate(el=>el.classList.contains('active')));
  const typstCases=['E = m c^2','eta = frac(Q_("useful"), Q_("solar"))','x = frac(-b plus.minus sqrt(b^2 - 4 a c), 2 a)','mat(a, b; c, d)','integral_0^1 x^2 dif x'];
  for(const src of typstCases){await page.locator('#input-source').click();await page.locator('#source').fill('$ '+src+' $');await page.evaluate(()=>FormulaTest.readSource());await ready();assert(!(await page.locator('#status').getAttribute('class')||'').includes('error'),src);}
  await page.locator('#remember').click();await page.waitForFunction(()=>document.querySelectorAll('#history button').length===2);
  await page.locator('#mode-latex').click();await page.locator('#input-source').click();await page.locator('#source').fill(String.raw`\begin{aligned}q&=-k\frac{dT}{dx}\\\eta&=\frac{Q_1}{Q_2}\end{aligned}`);await page.evaluate(()=>FormulaTest.readSource());await ready();
  await page.locator('#size').fill('40');await page.locator('#size').dispatchEvent('change');await ready();
  const svg=await page.evaluate(()=>FormulaTest.getSVG());assert(svg.includes('<path'));assert(!svg.includes('<text'));assert(svg.includes('metadata'));assert(!svg.includes('currentColor'));
  const out=process.env.MATHFORGE_TEST_OUTPUT||'/tmp/mathforge-test-output';await fs.mkdir(out,{recursive:true});
  for(const kind of ['svg','pdf','png','jpeg','project','latex','typst','mathml']){
    const download=page.waitForEvent('download');await page.evaluate(kind=>FormulaTest.exportFile(kind),kind);const d=await download;const target=path.join(out,d.suggestedFilename());await d.saveAs(target);const stat=await fs.stat(target);assert(stat.size>20,kind);console.log('EXPORT',kind,stat.size);
  }
  const project=JSON.parse(await fs.readFile(path.join(out,'equation.mathforge'),'utf8'));assert.equal(project.state.size,40);
  await page.locator('#input-source').click();await page.locator('#source').fill(String.raw`\notAValidCommand{`);await page.evaluate(()=>FormulaTest.readSource());assert.equal(await page.locator('#preview svg').count(),0);assert((await page.locator('#status').getAttribute('class')).includes('error'));
  await page.locator('[data-tab=templates]').click();await page.locator('[data-example="heat"]').click();await ready();
  await page.locator('#system-tools').click();assert(await page.locator('#tool-dialog').isVisible());await page.locator('#close-tools').click();
  await page.screenshot({path:path.join(out,'preview.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  const nativePage=await browser.newPage();
  await nativePage.addInitScript(()=>{window.webkit={messageHandlers:{mathforge:{postMessage(data){if(data.action==='render')setTimeout(()=>window.FormulaNativeReply(data.id,{error:'LaTeX 缺少宏包：example.sty',log:"! LaTeX Error: File `example.sty' not found."}),0);}}}};});
  await nativePage.goto(process.env.MATHFORGE_URL||'http://127.0.0.1:8765');await nativePage.waitForSelector('#preview svg');await nativePage.selectOption('#engine','latex');await nativePage.waitForSelector('.render-error');assert((await nativePage.locator('.render-error').innerText()).includes('example.sty'));await nativePage.getByRole('button',{name:'查看完整编译日志'}).click();assert(await nativePage.locator('#tool-dialog').isVisible());assert((await nativePage.locator('#compile-log').innerText()).includes('example.sty'));await nativePage.close();
  await browser.close();console.log('PASS: LaTeX/Typst editing, matrices, multiline equations, 8 exports, history, errors, settings, offline assets.');
})().catch(e=>{console.error(e);process.exit(1)});
