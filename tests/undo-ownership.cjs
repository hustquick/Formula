const assert=require('node:assert/strict');
const{chromium}=require('playwright');
(async()=>{
 const{RevisionHistory}=await import('../web/commands.mjs');
 let state={rawSource:'a'},active=0,maxActive=0;
 const restored=[];
 const h=new RevisionHistory(()=>({...state}),async s=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,10));state={...s};restored.push(s.rawSource);active--;});
 for(const rawSource of ['a','b','c','d']){state={rawSource};h.record();}
 await Promise.all([h.undo(),h.undo(),h.redo()]);
 assert.deepEqual(restored,['c','b','c']);assert.equal(maxActive,1);assert.equal(h.index,2);
 const restore=h.restore;let fail=true;h.restore=async s=>{if(fail){fail=false;throw Error('fixture restore failure');}return restore(s);};
 await assert.rejects(h.undo(),/fixture restore failure/);assert.equal(h.index,2);assert.equal(h.restoring,false);
 h.restore=restore;await h.undo();assert.equal(state.rawSource,'b');
 const b=await chromium.launch();try{
  const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
  const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
  await command('importContent',{text:'x',ext:'tex'});await command('switchVisual');
  const before=await p.evaluate(()=>FormulaRevisions.index);
  await p.evaluate(()=>{const m=document.querySelector('math-field');m.focus();m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));FormulaRevisions.flush();});
  assert.equal(await p.evaluate(()=>FormulaRevisions.index),before+1,'placeholder is a real visual edit');
  const visual=await p.evaluate(()=>document.querySelector('math-field').getValue('latex'));
  await command('undo');assert.equal(await p.evaluate(()=>document.querySelector('math-field').getValue('latex')),'x');
  await p.evaluate(()=>document.querySelector('math-field').executeCommand('redo'));
  await p.waitForFunction(v=>document.querySelector('math-field').getValue('latex')===v,visual);
  await p.keyboard.press('ControlOrMeta+z');await p.waitForFunction(()=>document.querySelector('math-field').getValue('latex')==='x');
  await command('redo');assert.equal(await p.evaluate(()=>document.querySelector('math-field').getValue('latex')),visual);
  await command('switchLatex');await p.locator('#source').fill('x+pending');
  await command('undo');await command('redo');assert.equal(await p.locator('#source').inputValue(),'x+pending');
  await command('switchTypst');await command('undo');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'latex');
  await command('redo');assert.equal(await p.evaluate(()=>FormulaTest.getState().editorMode),'typst');
  assert(await p.evaluate(()=>!!FormulaTest.getSVG()));
 }finally{await b.close();}
 console.log('PASS serialized rapid Undo/Redo, failed-restore recovery, visual placeholders, mixed MathLive/registry/keyboard ownership, pending source and Typst mode round trip');
})().catch(e=>{console.error(e);process.exit(1)});
