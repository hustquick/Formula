const {chromium}=require('playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage();await page.goto('file://'+path.resolve('web/index.html'));
 await page.waitForFunction(()=>window.FormulaTest);
 const original=String.raw`K_{\mathrm{x}}=K\frac{(1+i)^{n_0+n}-1}{(1+i)^n-1}+F-R\sum_{\tau=1}^n\frac{(1+i)^{n-\tau}-1}{(1+i)^n-1}`;
 await page.locator('#source').fill(original);await page.evaluate(()=>FormulaTest.readSource());
 for(let i=0;i<3;i++){
 await page.locator('#mode-typst').click();await page.waitForFunction(()=>FormulaTest.getState().editorMode==='typst');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mathforge')));
 assert.equal(saved.rawSource,await page.locator('#source').inputValue());
 await page.locator('#mode-latex').click();await page.waitForFunction(()=>FormulaTest.getState().editorMode==='latex');
 assert.equal(await page.locator('#source').inputValue(),original,'untouched round trip must retain exact LaTeX');
 }
 await page.locator('#mode-typst').click();await page.waitForFunction(()=>FormulaTest.getState().editorMode==='typst');
 await page.locator('#source').fill('x + y = 2');await page.locator('#mode-latex').click();
 await page.waitForFunction(()=>FormulaTest.getState().editorMode==='latex');
 assert.match(await page.locator('#source').inputValue(),/x\s*\+\s*y\s*=\s*2/);
 await page.reload();await page.waitForFunction(()=>window.FormulaTest);
 assert.equal(await page.locator('#source').getAttribute('aria-label'),'latex 公式源码');
 assert.match(await page.locator('#source').inputValue(),/x\s*\+\s*y\s*=\s*2/);
 await page.evaluate(()=>localStorage.setItem('mathforge',JSON.stringify({mode:'latex',latex:'x+y=2',rawSource:'x + y = 2'})));
 await page.reload();await page.waitForFunction(()=>window.FormulaTest);
 assert.equal(await page.locator('#source').inputValue(),'x+y=2','repair legacy source/language mismatch');
 console.log('PASS source mode: exact LaTeX round trips, edited Typst conversion, saved language/source and reload');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
