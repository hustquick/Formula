const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {DocumentSession}=require('../windows/document-session.cjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-windows-session-'));
 try{
  const support=path.join(root,'support'),file=path.join(root,'saved.mathforge');
  const state={rawSource:'  \\cfrac{1}{x}\n',editorMode:'typst',formulaContent:{authority:{language:'latex',text:'  \\cfrac{1}{x}\n',origin:'ocr',recognition:{text:'\\cfrac{1}{x}',engine:'fixture'}},representations:{typst:{text:'1/x'}}},backgroundColor:'#cceeff',visualDraft:'x\\placeholder{}'};
  const status={id:'doc',name:'未命名公式',savedSignature:null,dirty:true};
  const host=new DocumentSession(support);host.record(state,status);
  const bytes=Buffer.from(JSON.stringify({format:'mathforge-equation',state}));
  const request={documentID:'doc',base64:bytes.toString('base64'),signature:'signature-1',name:'saved.mathforge',saveAs:false};
  let panels=0;
  const choose=async()=>{panels++;return {canceled:false,filePath:file};};
  assert.deepEqual(await host.save(request,choose),{saved:true,name:'saved.mathforge'});assert.equal(panels,1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')).state,state);
  const restarted=new DocumentSession(support);assert.equal(restarted.file,file);assert.equal(restarted.session.savedSignature,'signature-1');assert.deepEqual(restarted.launch().state,state);
  assert(!('path' in restarted.launch().identity));
  const snapshot=restarted.launch();snapshot.state.rawSource='mutated';assert.equal(restarted.state.rawSource,state.rawSource);
  await restarted.save(request,choose);assert.equal(panels,1,'ordinary Save reuses host-owned file');
  // A genuine separate Node process restores the paired host record.
  const code=`const assert=require('node:assert/strict');const{DocumentSession}=require(${JSON.stringify(path.resolve('windows/document-session.cjs'))});const h=new DocumentSession(process.argv[1]);assert.equal(h.session.id,'doc');h.save(${JSON.stringify(request)},()=>{throw Error('unexpected panel')}).then(r=>{assert(r.saved);console.log('PASS fresh-process Save');}).catch(e=>{console.error(e);process.exit(1)});`;
  assert.match(execFileSync(process.execPath,['-e',code,support],{encoding:'utf8'}),/PASS fresh-process Save/);
  const before=fs.readFileSync(file),identity=restarted.session.id;
  assert.deepEqual(await restarted.save({...request,saveAs:true},async()=>({canceled:true})),{cancelled:true});
  assert.equal(restarted.session.id,identity);assert.deepEqual(fs.readFileSync(file),before);
  const destination=path.join(root,'directory');fs.mkdirSync(destination);
  await assert.rejects(()=>restarted.save({...request,saveAs:true},async()=>({filePath:destination})));assert.equal(restarted.file,file);
  assert.deepEqual(fs.readdirSync(root).filter(name=>name.endsWith('.tmp')),[]);
  fs.writeFileSync(file,'external change');
  await assert.rejects(()=>restarted.save(request,choose),/其他程序/);assert.equal(fs.readFileSync(file,'utf8'),'external change');
  fs.unlinkSync(file);await assert.rejects(()=>restarted.save(request,choose),/其他程序/);assert(!fs.existsSync(file));
  // A delayed file panel must not save into the destination of a newer document.
  fs.writeFileSync(file,'do not overwrite');let release;
  const pending=restarted.save({...request,saveAs:true},()=>new Promise(resolve=>release=resolve));
  restarted.record({rawSource:'new'},{id:'new-doc',name:'新公式',dirty:true,path:file,digest:'forged'});
  release({filePath:file});await assert.rejects(()=>pending,/当前公式已改变/);assert.equal(fs.readFileSync(file,'utf8'),'do not overwrite');assert.equal(restarted.file,null);
  await assert.rejects(()=>restarted.save(request,choose),/状态无效/);
  // Open metadata cannot authorize a target; only the consumed native token can.
  const project=path.join(root,'open.mathforge');fs.writeFileSync(project,JSON.stringify({format:'mathforge-equation',state,path:'untrusted'}));
  const selected=restarted.prepareOpen(project);
  restarted.record(state,{id:'opened',name:selected.name,dirty:false,savedSignature:'opened-signature',path:file});
  assert.equal(restarted.file,null);assert.equal(restarted.opened('forged','opened'),false);
  fs.writeFileSync(project,'changed after reading');assert.equal(restarted.opened(selected.token,'opened'),true);
  await assert.rejects(()=>restarted.save({...request,documentID:'opened'},choose),/其他程序/);
  assert.equal(restarted.opened(selected.token,'opened'),false,'one-use token');
  const rejected=restarted.prepareOpen(file);assert.equal(rejected.token,undefined,'plain-text import has no file identity');
  fs.writeFileSync(project,JSON.stringify({format:'mathforge-equation',state}));
  const failed=restarted.prepareOpen(project);assert.equal(restarted.opened(failed.token,undefined),false);assert.equal(restarted.pending.size,0);
  // Recover a coherent pair even if the legacy compatibility file is stale.
  fs.writeFileSync(restarted.stateFile,JSON.stringify({rawSource:'stale legacy'}));assert.deepEqual(new DocumentSession(support).launch().state,state);
  fs.writeFileSync(restarted.sessionFile,JSON.stringify({id:'old-split',path:file,digest:'legacy'}));
  const legacy=new DocumentSession(support);assert.equal(legacy.file,null);assert.equal(legacy.launch().state.rawSource,'stale legacy');
  fs.writeFileSync(restarted.sessionFile,'corrupt');assert.equal(new DocumentSession(support).file,null);
  console.log('PASS Windows host actual filesystem: paired recovery, Save/Save As, new identity, cancel/error, stale panel, external edit/delete, native Open token, provenance and fresh-process Save');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});
