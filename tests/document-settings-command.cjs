const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const{validateDocumentSetting:validate}=await import('../web/document-settings.mjs');
 for(const [key,value] of [['size',''],['size',9],['size',161],['padding',-1],['padding',true],['scale',0],['scale',Infinity],['color','red'],['backgroundColor','none'],['displayMode','other'],['mathFont','fake'],['preamble',null]])assert.throws(()=>validate(key,value),key);
 assert.equal(validate('backgroundColor','transparent'),'transparent');assert.equal(validate('size','36'),36);
 const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 await command('importContent',{text:'x+y',ext:'tex'});const original=await p.evaluate(()=>FormulaTest.getState().formulaContent.authority);
 for(const [key,value,id]of [['size',38,'size'],['padding',20,'padding'],['scale',6.25,'scale'],['color','#dc2626','color'],['backgroundColor','#2563eb','backgroundColor'],['preamble','% fixture preamble','preamble'],['typstPreamble','// fixture prelude','typst-preamble'],['displayMode','inline','display-mode'],['mathFont','bonum','math-font']]){
  const before=await p.evaluate(key=>({value:FormulaTest.getState()[key],index:FormulaRevisions.index}),key);
  await command('setDocumentSetting',{key,value});assert.equal(await p.evaluate(key=>FormulaTest.getState()[key],key),value);assert.equal(await p.evaluate(()=>FormulaRevisions.index),before.index+1,key+' one transaction');
  await command('undo');assert.equal(await p.evaluate(key=>FormulaTest.getState()[key],key),before.value,key+' undo');await command('redo');assert.equal(await p.evaluate(key=>FormulaTest.getState()[key],key),value,key+' redo');await command('undo');
  assert.deepEqual(await p.evaluate(()=>FormulaTest.getState().formulaContent.authority),original);
 }
 const snapshot=await p.evaluate(()=>({state:FormulaTest.getState(),index:FormulaRevisions.index}));
 for(const value of ['',-1,1000,'NaN'])await assert.rejects(()=>command('setDocumentSetting',{key:'size',value}));
 assert.equal(await p.evaluate(()=>FormulaRevisions.index),snapshot.index);assert.equal(await p.evaluate(()=>FormulaTest.getState().size),snapshot.state.size);assert.equal(await p.locator('#size').inputValue(),String(snapshot.state.size));
 // UI controls must delegate once; invalid UI changes restore the last valid value.
 await p.evaluate(()=>{window.settingCalls=0;const r=FormulaCommands,old=r.execute.bind(r);r.execute=(id,args)=>{if(id==='setDocumentSetting')window.settingCalls++;return old(id,args)};});
 await p.locator('#size').fill('40');await p.locator('#size').dispatchEvent('change');await p.waitForFunction(()=>FormulaTest.getState().size===40);assert.equal(await p.evaluate(()=>settingCalls),1);
 await p.locator('#size').fill('999');await p.locator('#size').dispatchEvent('change');await p.waitForFunction(()=>document.querySelector('#size').value==='40');assert.equal(await p.evaluate(()=>FormulaTest.getState().size),40);
 // Font loader failures do not leave a new font or phantom Undo revision.
 const fontBefore=await p.evaluate(()=>({font:FormulaTest.getState().mathFont,index:FormulaRevisions.index}));await p.evaluate(()=>{window.originalFontLoad=MathJax.loader.load;MathJax.loader.load=()=>Promise.reject(Error('fixture load error'));});
 await assert.rejects(()=>command('setDocumentSetting',{key:'mathFont',value:'asana'}),/fixture load error/);assert.deepEqual(await p.evaluate(()=>({font:FormulaTest.getState().mathFont,index:FormulaRevisions.index})),fontBefore);await p.evaluate(()=>MathJax.loader.load=window.originalFontLoad);
 const index=await p.evaluate(()=>FormulaRevisions.index);await p.locator('#editor-size-up').click();assert.equal(await p.evaluate(()=>FormulaRevisions.index),index);assert.equal(await p.evaluate(()=>FormulaTest.getState().sourceZoom),1.1);
 // Shortcut/view aliases use the same mode command as the visible segmented control.
 await command('workspace2');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'visual');await command('workspace1');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'latex');await command('undo');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'visual');await command('redo');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'latex');
 console.log('PASS validated settings, single transactions, every setting Undo/Redo, source authority, invalid-input rollback, font failure, UI dispatch, preference zoom and mode aliases');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
