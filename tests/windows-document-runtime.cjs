// Run only on the disposable Windows CI host, against the normal packaged app.
// Real Electron, frontend, IPC, process restarts and filesystem; native panel
// choices are supplied programmatically. No screenshots or additional app copies.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
if(process.platform!=='win32'||process.env.CI!=='true')throw Error('This runtime test requires disposable Windows CI; it must not run against a user profile.');
const { _electron:electron }=require('playwright');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-runtime-files-'));
 const executable=path.resolve('dist/Formula-Windows-x64/Formula.exe');
 const expectedApp=path.resolve('dist/Formula-Windows-x64/resources/app');
 const saved=path.join(root,'roundtrip.mathforge'),copy=path.join(root,'copy.mathforge');
 let application,page,userData;
 const launch=async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({executablePath:executable,env,timeout:60000});
  const actual=await application.evaluate(({app})=>({directory:app.getAppPath(),userData:app.getPath('userData'),version:app.getVersion()}));
  assert.equal(path.normalize(actual.directory).toLowerCase(),expectedApp.toLowerCase());
  assert.equal(actual.version,JSON.parse(fs.readFileSync('windows/package.json','utf8')).version);
  if(userData)assert.equal(actual.userData,userData);userData=actual.userData;
  page=await application.firstWindow({timeout:30000});
  await page.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
  await application.evaluate(({dialog})=>{
   dialog._formulaSaveCalls=0;dialog._formulaSaveResult={canceled:true};dialog._formulaOpenResult={canceled:true};
   dialog.showSaveDialog=async()=>{dialog._formulaSaveCalls++;return dialog._formulaSaveResult;};
   dialog.showOpenDialog=async()=>dialog._formulaOpenResult;
  });
 };
 const command=(id,args)=>page.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 const identity=()=>page.evaluate(()=>FormulaDocumentLifecycle.getStatus(FormulaTest.getState()));
 const chooseSave=result=>application.evaluate(({dialog},result)=>dialog._formulaSaveResult=result,result);
 const saveCalls=()=>application.evaluate(({dialog})=>dialog._formulaSaveCalls);
 const source=text=>page.locator('#source').fill(text);
 const close=async()=>{await application.close();application=null;};
 try{
  await launch();
  const original='  '+String.raw`\cfrac{1}{x}`+'\n';
  await command('importContent',{text:original,ext:'tex'});
  await command('setDocumentSetting',{key:'backgroundColor',value:'#cceeff'});
  await command('switchTypst');
  await chooseSave({filePath:saved,canceled:false});await command('saveFormula');
  assert.equal(await saveCalls(),1);assert.equal((await identity()).dirty,false);
  const disk=JSON.parse(fs.readFileSync(saved,'utf8'));assert.equal(disk.state.formulaContent.authority.text,original);assert.equal(disk.state.editorMode,'typst');assert.equal(disk.state.backgroundColor,'#cceeff');
  const firstID=(await identity()).id;
  console.log('PASS packaged app first Save: exact LaTeX authority retained under Typst and layout settings written');
  await close();await launch();
  assert.equal((await identity()).id,firstID);assert.equal((await identity()).dirty,false);
  assert.equal(await page.evaluate(()=>FormulaTest.getState().editorMode),'typst');
  await command('switchLatex');assert.equal(await page.locator('#source').inputValue(),original);
  const edited='  '+String.raw`\cfrac{2}{x}`+'\n';await source(edited);
  // Actual Windows keyboard route through the loaded production registry.
  await page.keyboard.press('Control+s');await page.waitForFunction(()=>!FormulaDocumentLifecycle.getStatus(FormulaTest.getState()).dirty);
  assert.equal(await saveCalls(),0,'Save after restart must not reopen the panel');
  assert.equal(JSON.parse(fs.readFileSync(saved,'utf8')).state.formulaContent.authority.text,edited);
  await page.waitForFunction(()=>!FormulaRevisions.timer);
  console.log('PASS real process restart: same identity and in-place Ctrl+S without another file panel');
  await source(edited.trim()+'+1');await page.evaluate(()=>FormulaTest.readSource());
  await command('undo');assert.equal(await page.locator('#source').inputValue(),edited);
  await command('redo');assert.match(await page.locator('#source').inputValue(),/\+1$/);
  const dirty=await identity();await command('saveAs');assert.equal((await identity()).id,dirty.id);assert.equal((await identity()).dirty,true);
  const external='external change';fs.writeFileSync(saved,external);
  await assert.rejects(()=>command('saveFormula'),/其他程序/);assert.equal(fs.readFileSync(saved,'utf8'),external);
  await chooseSave({filePath:copy,canceled:false});await command('saveAs');assert.equal((await identity()).dirty,false);
  assert.equal(fs.readFileSync(saved,'utf8'),external);assert.match(JSON.parse(fs.readFileSync(copy,'utf8')).state.formulaContent.authority.text,/\+1$/);
  await command('newFormula');const newID=(await identity()).id;
  await application.evaluate(({dialog},file)=>dialog._formulaOpenResult={filePaths:[file],canceled:false},copy);
  await command('openFormula');await page.waitForFunction(()=>FormulaDocumentLifecycle.name==='copy.mathforge');
  assert.notEqual((await identity()).id,newID);assert.equal((await identity()).dirty,false);
  const session=JSON.parse(fs.readFileSync(path.join(userData,'document-session.json'),'utf8'));assert.equal(session.path,copy);
  console.log('PASS packaged app Undo/Redo, cancellation, external conflict, SaveAs copy and native Open acknowledgement');
  await command('importContent',{text:'x',ext:'tex'});await command('switchToVisual');
  await page.evaluate(()=>{const m=document.querySelector('math-field');m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));});
  await command('saveFormula');const visual=JSON.parse(fs.readFileSync(copy,'utf8')).state.visualDraft;assert.match(visual,/placeholder/);
  const visualID=(await identity()).id;await close();await launch();
  assert.equal((await identity()).id,visualID);assert.equal(await page.locator('math-field').evaluate(m=>m.getValue('latex')),visual);assert.equal((await identity()).dirty,false);
  console.log('PASS packaged Windows Formula: real launch, exact authority/settings in Typst, Save, quit/restart/in-place Ctrl+S, edit/Undo/Redo, SaveAs cancel, external conflict, native Open token adoption and visual placeholder restart');
 }finally{if(application)await application.close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});
