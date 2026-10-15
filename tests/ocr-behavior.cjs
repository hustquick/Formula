const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.setContent('<button>图片识别</button><textarea id="source"></textarea><div id="ocr-module-controls"></div><pre id="ocr-diagnostic-log"></pre>');
 await page.evaluate(()=>{
  window.calls=[];window.imports=[];
  window.statusResponse={installed:true,busy:false,environmentExists:true,pythonAvailable:true,detectorInstalled:true,bytes:1234,engines:{pix2text:{installed:true},unimernet:{installed:true}}};
  window.FormulaImport=(...x)=>{imports.push(x);document.getElementById('source').value=x[0]||'';};
  window.FormulaNativeReply=()=>{};
  window.webkit={messageHandlers:{mathforge:{postMessage:m=>{
   calls.push(m);
   if(m.action==='ocrStatus')setTimeout(()=>FormulaNativeReply(m.id,statusResponse),0);
  }}}};
 });
 await page.evaluate(()=>{const nav=document.createElement('nav');nav.className='input-tabs';for(const b of [...document.querySelectorAll('body>button')])nav.append(b);document.body.prepend(nav);const deck=document.createElement('div');deck.className='tool-deck';document.body.append(deck)});
 await page.addScriptTag({content:fs.readFileSync('web/ocr.js','utf8')});
 await page.getByText('图片识别',{exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-recognize]').disabled);
 assert.equal(await page.locator('[data-engine] option').first().textContent(),'基础识别（Pix2Text）');
 assert.equal(await page.locator('[data-engine] option').nth(1).textContent(),'专业识别（UniMERNet Tiny）');
 await page.locator('[data-recognize]').click();
 assert.equal(await page.evaluate(()=>calls.at(-1).engine),'pix2text');
 assert.equal(await page.evaluate(()=>calls.at(-1).mode),'page');
 await page.evaluate(()=>FormulaOCRProgress(calls.at(-1).id,{message:'正在识别 JPG'}));
 assert.equal(await page.locator('[data-status]').textContent(),'正在识别 JPG');
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{error:'模型初始化失败',log:'ModuleNotFoundError: pix2text'}));
 await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('操作失败'));
 assert.equal(await page.locator('[data-log]').textContent(),'ModuleNotFoundError: pix2text');
 assert.equal(await page.locator('#formula-ocr-dialog .ocr-advanced').count(),0);
 await page.locator('[data-recognize]').click();
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{cancelled:true}));
 await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='已取消');
 await page.locator('[data-recognize]').click();
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{formulas:[{latex:'x^2'}],engine:'Pix2Text'}));
 await page.waitForFunction(()=>imports.length===1);
 assert.deepEqual(await page.evaluate(()=>imports),[['x^2','tex']]);

 // Re-open and verify enhanced engine plus full-page multi-select extraction.
 await page.waitForTimeout(550);
 await page.getByText('图片识别',{exact:true}).click();
 await page.locator('[data-engine]').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('change'));},'unimernet');
 await page.locator('[data-recognize]').click();
 assert.equal(await page.evaluate(()=>calls.at(-1).engine),'unimernet');
 assert.equal(await page.evaluate(()=>calls.at(-1).mode),'page');
 await page.evaluate(()=>FormulaNativeReply(calls.at(-1).id,{engine:'UniMERNet Tiny',formulas:[
  {latex:'a+b=c',type:'embedding',bbox:[10,20,100,50]},
  {latex:'\\int_0^1 x\\,dx',type:'isolated',bbox:[12,80,180,130]}
 ]}));
 await page.waitForFunction(()=>document.querySelectorAll('.ocr-result').length===2);
 assert.equal(await page.locator('[data-formula-index="0"]').isChecked(),true);
 assert.equal(await page.locator('.ocr-result input[type=checkbox]').count(),2);
 assert.equal(await page.locator('.ocr-result button').count(),0);

 await page.locator('.ocr-result input[type=checkbox]').first().check();
 assert.deepEqual(await page.evaluate(()=>imports.at(-1)),['a+b=c','tex']);
 assert.equal(await page.locator('#source').inputValue(),'a+b=c');

 await page.locator('.ocr-result input[type=checkbox]').nth(1).check();
 const combined=await page.evaluate(()=>imports.at(-1)[0]);
 assert.equal(combined,'\\int_0^1 x\\,dx');
 assert.equal(await page.locator('.ocr-result input[type=checkbox]').first().isChecked(),false);

 await page.locator('.ocr-result input[type=checkbox]').first().uncheck();
 assert.deepEqual(await page.evaluate(()=>imports.at(-1)),['\\int_0^1 x\\,dx','tex']);
 await page.locator('.ocr-result input[type=checkbox]').nth(1).uncheck();
 assert.equal(await page.locator('#source').inputValue(),'');
 assert.match(await page.locator('[data-status]').textContent(),/当前未选择公式/);

 // Pro installation must keep Basic recognition available and show live logs.
 await page.locator('[data-engine]').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('change'));},'pix2text');
 await page.locator('[data-pro-install]').check();
 assert.equal(await page.locator('[data-basic-install]').isChecked(),true);
 assert.equal(await page.locator('[data-basic-install]').isDisabled(),true);
 await page.locator('[data-install]').click();
 const installId=await page.evaluate(()=>calls.findLast(x=>x.action==='ocrInstall').id);
 assert.equal(await page.locator('[data-recognize]').isDisabled(),false);
 await page.evaluate(()=>{
  statusResponse.busy=true;statusResponse.installing=true;statusResponse.installingEngine='unimernet';
  statusResponse.engines.unimernet.installed=false;
  FormulaOCRInstallPhase('Downloading UniMERNet');
  FormulaOCRInstallLog('checkpoint 42%');
 });
 assert.equal(await page.locator('[data-log]').textContent(),'checkpoint 42%');
 assert.equal(await page.locator('[data-install-progress]').getAttribute('value'),'42');
 await page.locator('[data-recognize]').click();
 const basicId=await page.evaluate(()=>calls.findLast(x=>x.action==='ocrRecognize').id);
 await page.evaluate(id=>FormulaNativeReply(id,{formulas:[{latex:'a+b'}],engine:'Pix2Text'}),basicId);
 await page.waitForFunction(()=>imports.at(-1)[0]==='a+b');
 await page.waitForTimeout(550);
 assert.equal(await page.locator('#formula-ocr-dialog').isVisible(),true);
 await page.locator('[data-cancel-install]').click();
 const cancelId=await page.evaluate(()=>calls.findLast(x=>x.action==='ocrCancelInstall').id);
 await page.evaluate(id=>FormulaNativeReply(id,{cancelled:true}),cancelId);
 await page.evaluate(id=>{
  statusResponse.busy=false;statusResponse.installing=false;
  FormulaNativeReply(id,{error:'用户已取消 OCR 安装。',log:'download cancelled; staging removed'});
 },installId);
 await page.waitForFunction(()=>document.querySelector('[data-cancel-install]').hidden);
 assert.match(await page.locator('[data-status]').textContent(),/用户已取消/);
 assert.equal(await page.locator('[data-log]').textContent(),'download cancelled; staging removed');
 assert.equal(await page.locator('[data-recognize]').isDisabled(),false);
 // Pro remains unavailable after a cancelled first installation.
 await page.locator('[data-engine]').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('change'));},'unimernet');
 await page.waitForFunction(()=>document.querySelector('[data-recognize]').disabled);

 await page.evaluate(()=>FormulaNativeReply('unrelated',{ok:true}));
 await browser.close();console.log('OCR progress, tiered model selection, live checkbox page extraction, cancellation, import and reply routing OK');
})().catch(e=>{console.error(e);process.exit(1)});
