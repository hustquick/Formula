const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const{documentSettingControls,documentSnapshotSettingKeys:keys,captureDocumentSettings:pick}=await import('../web/document-settings.mjs');
 const{RevisionHistory}=await import('../web/commands.mjs');
 assert.deepEqual(new Set(keys),new Set([...Object.keys(documentSettingControls),'transparent']));
 const values={size:38,padding:20,scale:6.25,color:'#dc2626',backgroundColor:'#2563eb',transparent:false,preamble:'% history preamble',typstPreamble:'// history prelude',displayMode:'inline',mathFont:'bonum'};
 const h=new RevisionHistory(()=>{},()=>{});for(const key of keys)assert.notEqual(h.signature({rawSource:'x'}),h.signature({rawSource:'x',[key]:values[key]}),key+' participates in signature');
 const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 const settings=()=>p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,FormulaTest.getState()[k]])),keys);
 for(const mode of ['switchLatex','switchToVisual','switchTypst']){
  await command('importContent',{text:'x+y',ext:'tex'});await command(mode);
  for(const [key,value]of Object.entries(values).filter(([k])=>k!=='transparent')){
   const before=await settings();await command('setDocumentSetting',{key,value});
   const after=await settings();assert.equal(after[key],value);if(key==='backgroundColor')assert.equal(after.transparent,false);
   const snapshot=await p.evaluate(()=>FormulaRevisions.entries[FormulaRevisions.index].snapshot);
   assert.deepEqual(pick(snapshot),after,key+' captured');await command('undo');assert.deepEqual(await settings(),before,key+' undo');await command('redo');assert.deepEqual(await settings(),after,key+' redo');await command('undo');
  }
 }
 // Capture a complete non-default snapshot; restoration must update the actual
 // MathJax font as well as state/UI, for project, favorite and History paths.
 await command('switchLatex');for(const [key,value]of Object.entries(values).filter(([k])=>k!=='transparent'))await command('setDocumentSetting',{key,value});
 const target=await settings(),saved=await p.evaluate(()=>JSON.parse(JSON.stringify(FormulaTest.getState())));
 const font=()=>p.evaluate(()=>MathJax.startup.document.outputJax.font.constructor.NAME);
 assert.equal(await font(),'MathJaxBonum');
 await command('rememberFormula');
 await command('setDocumentSetting',{key:'mathFont',value:'newcm'});await command('setDocumentSetting',{key:'backgroundColor',value:'transparent'});
 const baseline=await settings();
 for(const kind of ['project','favorite','version']){
  if(kind==='project')await command('importContent',{text:JSON.stringify({format:'mathforge-equation',state:saved}),ext:'mathforge'});
  if(kind==='favorite')await command('restoreFavorite',{index:0});
  if(kind==='version'){
   await p.evaluate(saved=>FormulaDocumentHistory.versions.push({id:'settings-fixture',before:{rawSource:'z',latex:'z'},after:saved,title:'settings fixture',time:Date.now()}),saved);
   await command('restoreFormulaVersion',{id:'settings-fixture'});
  }
  assert.deepEqual(await settings(),target,kind+' full settings');assert.equal(await font(),'MathJaxBonum',kind+' renderer font');
  await command('undo');assert.deepEqual(await settings(),baseline);assert.equal(await font(),'MathJaxNewcm');
  await command('redo');assert.deepEqual(await settings(),target);assert.equal(await font(),'MathJaxBonum');await command('undo');
 }
 await command('redo');
 await p.waitForFunction(()=>FormulaDocumentHistory.formulas.some(f=>f.snapshot.mathFont==='bonum'&&f.snapshot.backgroundColor==='#2563eb'));
 await p.reload();await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG()&&window.FormulaMathFont==='bonum');assert.deepEqual(await settings(),target);assert.equal(await font(),'MathJaxBonum');
 await p.evaluate(()=>FormulaRevisions.go(FormulaRevisions.index-1));assert.deepEqual(await settings(),baseline);assert.equal(await font(),'MathJaxNewcm');
 console.log('PASS all layout snapshot fields, Visual/LaTeX/Typst Undo/Redo, project/favorite/History actual-font restoration, full setting round trip and persisted history reload');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
