const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-roundtrip-')),browser=await chromium.launch();
 try{
  const setup=async(saved)=>{
   const page=await browser.newPage();
   await page.addInitScript(saved=>{
    if(saved){window.FormulaSavedState=saved.state;window.FormulaSavedLifecycle=saved.identity;}
    window.calls=[];
    window.webkit={messageHandlers:{mathforge:{postMessage:message=>{
     calls.push(JSON.parse(JSON.stringify(message)));
     if(message.action==='saveProject')setTimeout(()=>FormulaNativeReply(message.id,{saved:true,name:'roundtrip.mathforge'}),0);
    }}}};
   },saved);
   await page.goto('file://'+process.cwd()+'/web/index.html');
   await page.waitForFunction(()=>window.FormulaCommands);
   return page;
  };
  const command=(p,id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
  const state=p=>p.evaluate(()=>JSON.parse(JSON.stringify(FormulaTest.getState())));
  const identity=p=>p.evaluate(()=>FormulaDocumentLifecycle.getStatus(FormulaTest.getState()));
  let p=await setup();
  const original='  '+String.raw`\cfrac{1}{x}`+'\n';
  await command(p,'importContent',{text:original,ext:'tex'});
  await command(p,'setDocumentSetting',{key:'backgroundColor',value:'#cceeff'});
  await command(p,'switchTypst');
  await command(p,'saveFormula');assert.equal((await identity(p)).dirty,false);
  const save=await p.evaluate(()=>calls.findLast(m=>m.action==='saveProject'));
  const file=path.join(root,'roundtrip.mathforge');fs.writeFileSync(file,Buffer.from(save.base64,'base64'));
  const onDisk=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(onDisk.state.formulaContent.authority.text,original);
  assert.equal(onDisk.state.editorMode,'typst');assert.equal(onDisk.state.backgroundColor,'#cceeff');
  assert.deepEqual(onDisk.state.formulaContent,(await state(p)).formulaContent);
  const savedIdentity=await identity(p);
  await p.close();
  p=await setup({state:onDisk.state,identity:savedIdentity});
  assert.equal((await identity(p)).id,savedIdentity.id);
  await p.waitForFunction(()=>FormulaTest.getSVG());
  assert.equal((await identity(p)).dirty,false);
  await command(p,'switchLatex');assert.equal(await p.locator('#source').inputValue(),original);
  assert.equal((await identity(p)).dirty,true,'representation form is part of the saved document');
  await command(p,'undo');assert.equal((await identity(p)).dirty,false);
  await command(p,'redo');assert.equal((await identity(p)).dirty,true);
  await command(p,'newFormula');const newID=(await identity(p)).id;
  await p.evaluate(text=>FormulaImport(text,'mathforge','roundtrip.mathforge','open-token'),fs.readFileSync(file,'utf8'));
  assert.notEqual((await identity(p)).id,newID);assert.equal((await identity(p)).dirty,false);
  assert.equal((await state(p)).formulaContent.authority.text,original);
  assert.equal((await state(p)).editorMode,'typst');
  await command(p,'switchLatex');await p.locator('#source').fill(original.trim()+'+1');
  await p.evaluate(()=>FormulaTest.readSource());await command(p,'undo');
  assert.equal((await state(p)).formulaContent.authority.text,original);
  await command(p,'redo');assert.match((await state(p)).formulaContent.authority.text,/\+1$/);
  // Reopen the actual saved visual placeholder tree, not just normalized LaTeX.
  await command(p,'importContent',{text:'x',ext:'tex'});await command(p,'switchToVisual');
  await p.evaluate(()=>{const m=document.querySelector('math-field');m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));});
  await command(p,'saveFormula');
  const visualSave=await p.evaluate(()=>calls.findLast(m=>m.action==='saveProject'));
  const visual=JSON.parse(Buffer.from(visualSave.base64,'base64').toString('utf8'));
  assert.match(visual.state.visualDraft,/placeholder/);
  await command(p,'newFormula');
  await p.evaluate(text=>FormulaImport(text,'mathforge','visual.mathforge','visual-token'),JSON.stringify(visual));
  assert.equal(await p.locator('math-field').evaluate(m=>m.getValue('latex')),visual.state.visualDraft);
  assert.equal((await identity(p)).dirty,false);
  // Invalid exact source remains a saveable draft; reopening cannot reuse old math.
  await command(p,'switchLatex');const unfinished='  \\frac{unfinished\n';
  await p.locator('#source').fill(unfinished);await command(p,'saveFormula');
  const last=await p.evaluate(()=>calls.findLast(m=>m.action==='state'));
  assert.equal(last.state.formulaContent.authority.text,unfinished);
  assert.equal(last.document.id,(await identity(p)).id);
  const q=await setup({state:last.state,identity:last.document});
  assert.equal(await q.locator('#source').inputValue(),unfinished);
  assert.equal((await identity(q)).dirty,false);
  await q.close();await p.close();
  console.log('PASS file save/restart/open/edit/Undo/Redo, exact LaTeX authority in Typst, settings, representation dirty state, visual placeholders and invalid drafts');
 }finally{await browser.close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});
