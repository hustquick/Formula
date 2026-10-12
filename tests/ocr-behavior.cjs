const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.setContent('<button>图片识别</button><textarea id="source"></textarea>');
 await page.evaluate(()=>{
  window.calls=[];window.imports=[];
  window.FormulaImport=(...x)=>{imports.push(x);document.getElementById('source').value=x[0]||'';};
  window.FormulaNativeReply=()=>{};
  window.webkit={messageHandlers:{mathforge:{postMessage:m=>{
   calls.push(m);
   if(m.action==='ocrStatus')setTimeout(()=>FormulaNativeReply(m.id,{
    installed:true,busy:false,environmentExists:true,pythonAvailable:true,detectorInstalled:true,bytes:1234,
    engines:{pix2text:{installed:true},unimernet:{installed:true}}
   }),0);
  }}}};
 });
 await page.addScriptTag({content:fs.readFileSync('web/ocr.js','utf8')});
 await page.getByText('图片识别',{exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-recognize]').disabled);
 assert.equal(await page.locator('[data-engine] option').first().textContent(),'基础识别（Pix2Text）');
 assert.equal(await page.locator('[data-engine] option').nth(1).textContent(),'专业识别（UniMERNet Tiny）');
 await page.locator('[data-recognize]').click();
 assert.equal(await page.evaluate(()=>calls.at(-1).engine),'pix2text');
 assert.equal(await page.evaluate(()=>calls.at(-1).mode),'single');
 await page.evaluate(()=>FormulaOCRProgress(calls.at(-1).id,{message:'正在识别 JPG'}));
 assert.equal(await page.locator('[data-status]').textContent(),'正在识别 JPG');
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{error:'模型初始化失败',log:'ModuleNotFoundError: pix2text'}));
 await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='模型初始化失败');
 assert.equal(await page.locator('[data-log]').textContent(),'ModuleNotFoundError: pix2text');
 assert.equal(await page.locator('details').getAttribute('open'),'');
 await page.locator('[data-recognize]').click();
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{cancelled:true}));
 await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='已取消');
 await page.locator('[data-recognize]').click();
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{latex:'x^2',engine:'Pix2Text'}));
 await page.waitForFunction(()=>imports.length===1);
 assert.deepEqual(await page.evaluate(()=>imports),[['x^2','tex']]);

 // Re-open and verify enhanced engine plus full-page multi-select extraction.
 await page.waitForTimeout(550);
 await page.getByText('图片识别',{exact:true}).click();
 await page.locator('[data-engine]').selectOption('unimernet');
 await page.locator('[data-mode="page"]').click();
 await page.locator('[data-recognize]').click();
 assert.equal(await page.evaluate(()=>calls.at(-1).engine),'unimernet');
 assert.equal(await page.evaluate(()=>calls.at(-1).mode),'page');
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{engine:'UniMERNet Tiny',formulas:[
  {latex:'a+b=c',type:'embedding',bbox:[10,20,100,50]},
  {latex:'\\int_0^1 x\\,dx',type:'isolated',bbox:[12,80,180,130]}
 ]}));
 await page.waitForFunction(()=>document.querySelectorAll('.ocr-result').length===2);
 assert.match(await page.locator('[data-status]').textContent(),/检测到 2 个公式/);
 assert.equal(await page.locator('.ocr-result input[type=checkbox]').count(),2);
 assert.equal(await page.locator('.ocr-result button').count(),0);

 await page.locator('.ocr-result input[type=checkbox]').first().check();
 assert.deepEqual(await page.evaluate(()=>imports.at(-1)),['a+b=c','tex']);
 assert.equal(await page.locator('#source').inputValue(),'a+b=c');

 await page.locator('.ocr-result input[type=checkbox]').nth(1).check();
 const combined=await page.evaluate(()=>imports.at(-1)[0]);
 assert.match(combined,/\\begin\{gathered\}/);
 assert.match(combined,/a\+b=c/);
 assert.match(combined,/\\int_0\^1 x\\,dx/);
 assert.match(await page.locator('[data-status]').textContent(),/已选择 2 个公式/);

 await page.locator('.ocr-result input[type=checkbox]').first().uncheck();
 assert.deepEqual(await page.evaluate(()=>imports.at(-1)),['\\int_0^1 x\\,dx','tex']);
 await page.locator('.ocr-result input[type=checkbox]').nth(1).uncheck();
 assert.equal(await page.locator('#source').inputValue(),'');
 assert.match(await page.locator('[data-status]').textContent(),/当前未选择公式/);

 await page.evaluate(()=>FormulaNativeReply('unrelated',{ok:true}));
 await browser.close();console.log('OCR progress, tiered model selection, live checkbox page extraction, cancellation, import and reply routing OK');
})().catch(e=>{console.error(e);process.exit(1)});
