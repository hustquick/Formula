const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch();try{for(const width of [760,1120,1440]){
 const p=await b.newPage({viewport:{width,height:1000}});await p.addInitScript(()=>{window.webkit={messageHandlers:{mathforge:{postMessage:m=>{if(m.action==='ocrStatus')setTimeout(()=>FormulaNativeReply(m.id,{installed:true,engines:{pix2text:{installed:true}}}),0)}}}}});await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&document.querySelector('#preview svg'));await p.addScriptTag({content:fs.readFileSync('web/ocr.js','utf8')});
 const boxes=async()=>p.evaluate(()=>Object.fromEntries(['.tool-deck','#source','#preview'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{y:r.y,height:r.height}]})));
 assert(!await p.locator('header .logo').isVisible());assert(!await p.locator('header').isVisible());const before=await boxes();const card=await p.locator('#tools summary').first().boundingBox();assert.equal(card.height,116);assert.equal(card.y-before['.tool-deck'].y,8);assert.equal(before['.tool-deck'].height,132);assert.equal(before['#source'].height,200);assert.equal(before['#preview'].height,200);
 for(const tab of ['公式模板','收藏夹','自定义','图片识别','文档识别','快捷工具']){
  await p.getByRole('button',{name:tab,exact:true}).click();assert.deepEqual(await boxes(),before,tab+' stable anchors');
 }
 await p.locator('#input-visual').click();assert.equal((await p.locator('.visual-pane').boundingBox()).height,200);
 await p.locator('#mode-latex').click();await p.locator('#source').fill('x+y\n'.repeat(70));await p.evaluate(()=>FormulaTest.readSource());
 const scroll=await p.locator('#source').evaluate(n=>{n.scrollTop=n.scrollHeight;return n.scrollTop});assert(scroll>0);
 await p.getByRole('button',{name:'收藏夹',exact:true}).click();assert.equal(await p.locator('#source').evaluate(n=>n.scrollTop),scroll);
 console.log('PASS uniform 132px filled card shelf/200px editors, six stable tabs, visual/source height and long source scrolling at '+width);await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
