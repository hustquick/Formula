const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 await page.goto('file://'+path.resolve('web/index.html'));
 await page.waitForFunction(()=>window.MathJax?.tex2svgPromise);
 await page.evaluate(()=>{
  window.webkit={messageHandlers:{mathforge:{postMessage:m=>setTimeout(()=>FormulaNativeReply(m.id,m.action==='ocrStatus'?{documentInstalled:true,detectorInstalled:true,engines:{pix2text:{installed:true}}}:{formulas:[{latex:'\\mathrm{x}+\\mathrm{y}=2',source:'第 1 页'}]}),0)}}};
 });
 await page.addScriptTag({content:fs.readFileSync('web/ocr.js','utf8')});
 await page.getByText('文档识别',{exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-recognize]').disabled);
 await page.locator('[data-recognize]').click();
 await page.waitForFunction(()=>document.querySelector('.ocr-formula-preview mjx-container'));
 const count=await page.locator('.ocr-formula-preview svg').count();
 assert.ok(count>1,'fixture must exercise MathJax fragmented inline output');
 assert.ok(await page.locator('.ocr-formula-preview [data-latex="+"]').count());
 assert.ok(await page.locator('.ocr-formula-preview [data-latex="="]').count());
 assert.ok(await page.locator('.ocr-formula-preview [data-latex="2"]').count());
 await browser.close();console.log('Bundled MathJax OCR preview preserves every inline SVG fragment (+, = and final number)');
})().catch(e=>{console.error(e);process.exit(1)});
