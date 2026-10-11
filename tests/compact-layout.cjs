const assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 for(const viewport of [{width:1440,height:900},{width:1366,height:768}]){
  await page.setViewportSize(viewport);
  await page.goto(process.env.MATHFORGE_URL||'http://127.0.0.1:8765');
  await page.waitForFunction(()=>window.FormulaCatalogInfo&&document.querySelector('#preview svg'));
  await page.locator('#remember').click();
  await page.waitForFunction(()=>document.querySelector('#history .history-item'));
  assert.equal(await page.locator('.ll-template-head').count(),0);
  const quickHeight=(await page.locator('#tools summary').first().boundingBox()).height;
  const before=await page.locator('#source').boundingBox();
  for(const tab of ['templates','favorites','custom','quick']){
   await page.locator(`.input-tabs [data-tab="${tab}"]`).click();
   assert.deepEqual(await page.locator('#source').boundingBox(),before,`${tab} must preserve editor geometry`);
   assert.equal(await page.locator('.examples').isVisible(),tab==='templates',`${tab} only shows its own panel`);
   if(tab==='favorites')assert.equal((await page.locator('.history-item').first().boundingBox()).height,quickHeight);
   if(tab==='templates')assert.equal((await page.locator('.ll-template-category').first().boundingBox()).height,quickHeight);
   const output=await page.locator('.preview-card').boundingBox();
   assert(output.y+output.height<=viewport.height,`output fits ${viewport.width}×${viewport.height}`);
  }
  await page.locator('#source').evaluate(el=>el.style.height='190px');
  const resized=await page.locator('#source').boundingBox();
  for(const tab of ['templates','favorites','custom','quick']){
   await page.locator(`.input-tabs [data-tab="${tab}"]`).click();
   assert.deepEqual(await page.locator('#source').boundingBox(),resized,`${tab} preserves manually resized input`);
  }
  await page.locator('#input-visual').click();
  const visual=await page.locator('.input-editors').boundingBox();
  for(const tab of ['templates','favorites','custom','quick']){
   await page.locator(`.input-tabs [data-tab="${tab}"]`).click();
   assert.deepEqual(await page.locator('.input-editors').boundingBox(),visual);
  }
 }
 await browser.close();console.log('compact layout passed');
})().catch(e=>{console.error(e);process.exit(1)});
