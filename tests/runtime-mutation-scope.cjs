const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage();await p.addInitScript(()=>{window.calls=[];window.pendingSave=null;window.webkit={messageHandlers:{mathforge:{postMessage:m=>{calls.push(m);if(m.action==='save'){if(window.holdSave)window.pendingSave=m;else setTimeout(()=>FormulaNativeReply(m.id,window.saveError?{error:'fixture save error'}:{cancelled:!!window.cancelSave}),0);}}}}};});await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 await command('importContent',{text:String.raw`\cfrac{1}{x}`,ext:'tex'});await command('switchTypst');
 const snapshot=()=>p.evaluate(()=>({state:JSON.stringify(FormulaTest.getState()),entries:JSON.stringify(FormulaRevisions.entries),index:FormulaRevisions.index,source:document.querySelector('#source').value,authority:FormulaTest.getState().formulaContent.authority}));
 for(const outcome of ['success','cancel','error']){
  const before=await snapshot();await p.evaluate(outcome=>{calls.length=0;window.cancelSave=outcome==='cancel';window.saveError=outcome==='error';},outcome);
  const run=()=>command('batchExport',{kind:'svg',text:'x+1\ny+2'});if(outcome==='error')await assert.rejects(run,/fixture save error/);else await run();
  assert.deepEqual(await snapshot(),before,outcome+' restores document and revision entries');
  const saved=await p.evaluate(()=>calls.filter(m=>m.action==='save').length);assert.equal(saved,outcome==='success'?2:1);
  assert(await p.evaluate(()=>calls.filter(m=>m.action==='state').every(m=>m.state.rawSource==='1/x')),'never persist batch item');
 }
 await p.evaluate(()=>{FormulaCommands.register({id:'fixturePending',title:'Pending',mutation:'document',execute:()=>new Promise(resolve=>window.releasePending=resolve)});window.pendingCommand=FormulaCommands.execute('fixturePending');});
 await assert.rejects(()=>command('batchExport',{kind:'svg',text:'a+1'}),/当前操作/);await p.evaluate(()=>{releasePending();return pendingCommand;});assert.equal(await p.evaluate(()=>FormulaCommands.executions.size),0);
 // A held native save makes the runtime scope observable: no conflicting commands.
 await p.evaluate(()=>{calls.length=0;window.holdSave=true;window.cancelSave=false;window.saveError=false;});
 await p.evaluate(()=>{window.batchPromise=FormulaCommands.execute('batchExport',{kind:'svg',text:'x+1\ny+2'});});await p.waitForFunction(()=>window.pendingSave);
 assert.equal(await command('setDocumentSetting',{key:'size',value:50}),false);assert.equal(await command('importContent',{text:'lost',ext:'tex'}),false);assert(await p.locator('.editor-card').evaluate(n=>n.inert));
 await p.evaluate(()=>{holdSave=false;FormulaNativeReply(pendingSave.id,{cancelled:true});});await p.evaluate(()=>batchPromise);assert(!await p.locator('.editor-card').evaluate(n=>n.inert));assert.equal(await p.evaluate(()=>FormulaCommands.enabled('undo')),true);
 // Invalid current source keeps its own last-valid preview, not a batch preview.
 await command('switchLatex');await p.locator('#source').fill('\\frac{');await p.evaluate(()=>FormulaTest.readSource());const invalid=await p.locator('#preview').innerHTML();await command('batchExport',{kind:'svg',text:'a+1'});assert.equal(await p.locator('#source').inputValue(),'\\frac{');assert.equal(await p.locator('#preview').innerHTML(),invalid);
 await command('importContent',{text:'x',ext:'tex'});await command('switchToVisual');await command('superscript');const visual=await p.locator('math-field').evaluate(n=>n.getValue('latex'));await command('batchExport',{kind:'svg',text:'a+1'});assert.equal(await p.locator('math-field').evaluate(n=>n.getValue('latex')),visual,'visual placeholders survive runtime scope');
 // Preference and asset commands never consume document history.
 const before=await snapshot();await command('setToolbarDisplay',{mode:'text'});await command('resetToolbar');
 await command('importContent',{text:JSON.stringify({format:'mathforge-library',history:['a+b']}),ext:'mathforge'});
 assert.equal(await p.evaluate(()=>FormulaTest.getState().history.length),1);assert.equal(await p.evaluate(()=>FormulaRevisions.index),before.index);assert.equal(await p.locator('#source').inputValue(),before.source);
 const docIndex=await p.evaluate(()=>FormulaRevisions.index);await command('clearFormulaHistory');assert.equal(await p.evaluate(()=>FormulaDocumentHistory.formulas.length),0);assert.equal(await p.evaluate(()=>FormulaRevisions.index),docIndex);
 assert.equal(await command('chooseLocalTool',{tool:'unexpected'}),false);await command('scanLocalTools');assert(await p.evaluate(()=>calls.some(m=>m.action==='scanTools')));
 console.log('PASS batch success/cancel/failure exact restoration, no temporary persistence/history, conflict gate/inert release, preference/assets isolation and validated runtime bridge');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
