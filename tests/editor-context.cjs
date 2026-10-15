const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch();try{for(const width of [760,1120,1440]){
 const p=await b.newPage({viewport:{width,height:1000}});await p.addInitScript(()=>{window.webkit={messageHandlers:{mathforge:{postMessage:m=>{if(m.action==='ocrStatus')setTimeout(()=>FormulaNativeReply(m.id,{installed:true,engines:{pix2text:{installed:true}}}),0)}}}}});
 await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());await p.addScriptTag({content:fs.readFileSync('web/ocr.js','utf8')});
 for(const mode of ['latex','typst','visual']){
  await p.evaluate(()=>FormulaCommands.execute('importContent',{text:'x+y\n'.repeat(100),ext:'tex'}));
  await p.evaluate(mode=>FormulaCommands.execute({latex:'switchLatex',typst:'switchTypst',visual:'switchToVisual'}[mode]),mode);
  await p.evaluate(()=>{const n=document.querySelector('#source');n.setSelectionRange(200,203);n.scrollTop=400;if(FormulaTest.getState().editorMode==='visual'){formula.focus();formula.select();document.querySelector('.visual-pane').scrollTop=80;}else n.focus({preventScroll:true});FormulaRevisions.flush();});
  const capture=()=>p.evaluate(()=>{const source=document.querySelector('#source'),visual=document.querySelector('.visual-pane'),r=document.querySelector('.input-editors').getBoundingClientRect();return{mode:FormulaTest.getState().editorMode,text:source.value,focus:document.activeElement.id,selection:[source.selectionStart,source.selectionEnd],scroll:[source.scrollLeft,source.scrollTop],visual:JSON.stringify(formula.selection),visualScroll:[visual.scrollLeft,visual.scrollTop],frame:[r.x+scrollX,r.y+scrollY,r.width,r.height],history:[FormulaRevisions.index,FormulaRevisions.canUndo,FormulaRevisions.canRedo]}});
  const before=await capture();
  for(const name of ['公式模板','收藏夹','自定义','图片识别','文档识别','快捷工具']){await p.getByRole('button',{name,exact:true}).click();assert.deepEqual(await capture(),before,mode+' '+name);}
  for(const command of ['palette','formulaHistory','settings']){
   // Existing public IDs are looked up below to keep the test on actual entry points.
   if(command==='palette')await p.keyboard.press('ControlOrMeta+k');else if(command==='formulaHistory')await p.getByRole('button',{name:'历史公式',exact:true}).click();else await p.keyboard.press('ControlOrMeta+,');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#tool-dialog').open===false&&document.querySelector('.command-overlay').hidden);assert.deepEqual(await capture(),before,mode+' '+command);
  }
  await p.locator('#font-menu').click();await p.keyboard.press('Escape');assert.deepEqual(await capture(),before,mode+' style Escape');
  await p.locator('.tool-group summary').first().click();await p.keyboard.press('Escape');assert.deepEqual(await capture(),before,mode+' tool Escape');
 }
 // Preview focus and scroll are preserved when visiting settings.
 await p.locator('#preview').focus();await p.keyboard.press('ControlOrMeta+,');await p.locator('#close-tools').click();await p.waitForFunction(()=>document.activeElement.id==='preview');
 console.log('PASS editor context source/Typst/visual selection, focus, scroll, six tabs, palettes/settings/Escape, history stability and preview focus '+width);await p.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
