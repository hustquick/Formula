const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const result=await p.evaluate(async()=>{
  await FormulaCommands.execute('importContent',{text:'x',ext:'tex'});
  const initial=FormulaRevisions.index,source=document.querySelector('#source');
  let release;const gate=new Promise(r=>release=r);
  const edit=FormulaCommands.execute('sourceAccept',{execute:async()=>{source.value='x+1';source.dispatchEvent(new Event('input',{bubbles:true}));await FormulaTest.readSource();await gate;}});
  await new Promise(r=>setTimeout(r,30));
  const undo=FormulaCommands.execute('undo');release();await Promise.all([edit,undo]);
  const afterUndo=source.value;await FormulaCommands.execute('redo');
  return {initial,afterUndo,afterRedo:source.value};
 });assert.equal(result.afterUndo,'x');assert.equal(result.afterRedo,'x+1');

 // A failed document command rolls back content, context and the redo branch.
 const rollback=await p.evaluate(async()=>{
  await FormulaCommands.execute('undo');
  const source=document.querySelector('#source');source.focus();source.setSelectionRange(0,1);
  const before={source:source.value,index:FormulaRevisions.index,length:FormulaRevisions.entries.length,redo:FormulaRevisions.canRedo};
  let error;
  try{await FormulaCommands.execute('sourceAccept',{execute:async()=>{source.value='broken+2';await FormulaTest.readSource();throw Error('fixture edit failure');}});}catch(e){error=e.message;}
  return {before,after:{source:source.value,index:FormulaRevisions.index,length:FormulaRevisions.entries.length,redo:FormulaRevisions.canRedo},error,selection:[source.selectionStart,source.selectionEnd],inert:document.querySelector('.input-editors').inert};
 });assert.deepEqual(rollback.after,rollback.before);assert.match(rollback.error,/fixture edit failure/);assert.deepEqual(rollback.selection,[0,1]);assert.equal(rollback.inert,false);
 await p.evaluate(()=>FormulaCommands.execute('redo'));assert.equal(await p.locator('#source').inputValue(),'x+1');
 // Two queued settings must use state at execution time, including a return to
 // the old value while a previous change is pending.
 await p.evaluate(async()=>{
  const before=FormulaTest.getState().size;
  let release;const gate=new Promise(r=>release=r);
  const edit=FormulaCommands.execute('sourceAccept',{execute:()=>gate});
  const a=FormulaCommands.execute('setDocumentSetting',{key:'size',value:40});
  const b=FormulaCommands.execute('setDocumentSetting',{key:'size',value:before});
  release();await Promise.all([edit,a,b]);if(FormulaTest.getState().size!==before)throw Error('queued setting lost');
 });
 // Font loading belongs to the same transaction as its commit. Source typing
 // is protected for that interval and Undo is queued instead of racing it.
 const font=await p.evaluate(async()=>{
  let release;const gate=new Promise(r=>release=r),original=MathJax.loader.load;
  MathJax.loader.load=async(...args)=>{await gate;return original.apply(MathJax.loader,args);};
  const before=FormulaTest.getState().mathFont;
  const edit=FormulaCommands.execute('setDocumentSetting',{key:'mathFont',value:'bonum'});
  await new Promise(r=>setTimeout(r,10));const protectedInput=document.querySelector('.input-editors').inert;
  const undo=FormulaCommands.execute('undo');release();await Promise.all([edit,undo]);
  MathJax.loader.load=original;
  return {before,after:FormulaTest.getState().mathFont,protectedInput};
 });assert.equal(font.after,font.before);assert.equal(font.protectedInput,true);
 // A mode command's focus request must survive an async inert interval even
 // when the initiating segmented button retains browser focus.
 await p.locator('#mode-typst').click();await p.waitForFunction(()=>document.activeElement===document.querySelector('#source')&&!FormulaRevisions.busy);
 await p.locator('#input-visual').click();await p.waitForFunction(()=>document.activeElement===document.querySelector('math-field')&&!FormulaRevisions.busy);
 // Explicit nested work shares one owner; unrelated async events queue.
 const {RevisionHistory}=await import('../web/commands.mjs');let state={rawSource:'a'};
 const h=new RevisionHistory(()=>({...state}),async s=>state={...s});h.record();
 await h.transaction('parent',async context=>{state.rawSource='b';await context.run(async()=>{state.rawSource='c';});});
 assert.equal(h.entries.length,2);assert.equal(h.entries[1].title,'parent');await h.undo();assert.equal(state.rawSource,'a');await h.redo();assert.equal(state.rawSource,'c');
 const savedIndex=h.index;await assert.rejects(h.transaction('failed nested',context=>context.run(()=>{state.rawSource='bad';throw Error('nested failure');})),/nested failure/);assert.equal(state.rawSource,'c');assert.equal(h.index,savedIndex);assert.equal(h.busy,false);
 h.restore=async()=>{throw Error('restore unavailable');};await assert.rejects(h.undo(),e=>e instanceof AggregateError&&e.errors.length===2);assert.equal(h.index,savedIndex);assert.equal(h.restoring,false);assert.equal(h.busy,false);
 console.log('PASS async document/Undo ordering, failed-edit rollback and redo preservation, selection/inert release, queued settings, delayed font commit/Undo and explicit nested transaction');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
