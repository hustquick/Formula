const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 await command('importContent',{text:'x+1',ext:'tex'});
 const read=()=>p.evaluate(()=>{const s=document.querySelector('#source'),paint=document.querySelector('.source-syntax pre'),state=FormulaTest.getState();return{source:getComputedStyle(s).fontSize,paint:getComputedStyle(paint).fontSize,visual:getComputedStyle(document.querySelector('math-field')).fontSize,size:state.size,raw:s.value,selection:[s.selectionStart,s.selectionEnd],index:FormulaRevisions.index,frame:document.querySelector('.input-editors').getBoundingClientRect().toJSON()};});
 let saved;
 for(const [mode,font]of [['switchLatex','17.6px'],['switchTypst','19.2px']]){
  await command(mode);await p.locator('#source').evaluate(n=>{n.focus();n.setSelectionRange(0,1);});const before=await read();
  await p.locator('#editor-size-up').click();const after=await read();assert.equal(after.source,font);assert.equal(after.paint,font,'paint changes without typing');assert.equal(after.raw,before.raw);assert.deepEqual(after.selection,before.selection);assert.deepEqual(after.frame,before.frame);assert.equal(after.index,before.index);assert.equal(after.size,before.size);assert.equal(after.visual,before.visual);
  saved=after;
 }
 await command('switchToVisual');const before=await read();await p.locator('#editor-size-up').click();const after=await read();assert.equal(after.visual,'30.8px');assert.equal(after.source,before.source);assert.equal(after.paint,before.paint);assert.equal(after.size,before.size);assert.equal(after.index,before.index);
 await command('switchLatex');await p.locator('#editor-size-down').click();assert.equal((await read()).paint,'17.6px');await p.reload();await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());const restored=await read();assert.equal(restored.paint,'17.6px');assert.equal(restored.source,'17.6px');assert.equal(restored.visual,'30.8px');
 for(const width of [760,1120,1440]){await p.setViewportSize({width,height:1000});const before=await read();await p.locator('#editor-size-up').click();const after=await read();assert.equal(after.paint,after.source);assert.deepEqual(after.frame,before.frame);await p.locator('#editor-size-down').click();}
 console.log('PASS visible source paint zoom in LaTeX/Typst, independent visual zoom, A+/A−, selection/source/history/export-size preservation, persisted zoom and stable 760/1120/1440 frames');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
