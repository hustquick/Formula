// Load the real Electron entry points with only Electron UI/IPC surfaces simulated.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'formula-windows-bridge-'));
 try{
  const ipc=new Map(),renderer=new Map(),messages=[],windows=[];
  let ready;
  const dialog={saveResult:{canceled:true},openResult:{canceled:true},saveCalls:[],async showSaveDialog(_window,options){this.saveCalls.push(options);return this.saveResult;},async showOpenDialog(){return this.openResult;}};
  class BrowserWindow{
   constructor(){windows.push(this);this.webContents={setWindowOpenHandler(){},on(){},once(){},send:(channel,...args)=>{messages.push({channel,args});renderer.get(channel)?.({},...args);}};}
   isDestroyed(){return false;}loadFile(){}setTitle(title){this.title=title;}
  }
  const electron={app:{getPath:()=>root,getVersion:()=> '1.6.1',whenReady:()=>({then:fn=>ready=fn}),on(){}},BrowserWindow,ipcMain:{on:(name,fn)=>ipc.set(name,fn)},dialog,clipboard:{},nativeImage:{},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}}};
  const file=path.resolve('windows/main.cjs'),realRequire=createRequire(file);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:name=>name==='electron'?electron:name==='sharp'?()=>{}:realRequire(name),__dirname:path.dirname(file),process,Buffer,console},{filename:file});
  ready();
  const sync=(channel)=>{const event={};ipc.get(channel)(event);return event.returnValue;};
  const state={rawSource:'x+1',editorMode:'latex',formulaContent:{authority:{text:'x+1',language:'latex',origin:'import'}}};
  const document={id:'doc',name:'未命名公式',savedSignature:null,dirty:true};
  const dispatch=data=>ipc.get('formula-native')({},data);
  await dispatch({action:'state',state,document});assert.match(windows[0].title,/^\* /);
  const window={};let receivedImport,receivedReply;
  window.FormulaImport=(...args)=>receivedImport=args;
  window.FormulaNativeReply=(...args)=>receivedReply=args;
  const preload=path.resolve('windows/preload.cjs');
  vm.runInNewContext(fs.readFileSync(preload,'utf8'),{window,require:()=>({ipcRenderer:{sendSync:sync,send:(_channel,data)=>dispatch(data),on:(channel,fn)=>renderer.set(channel,fn)}})},{filename:preload});
  assert.equal(window.FormulaSavedState.rawSource,'x+1');assert.equal(window.FormulaSavedLifecycle.id,'doc');
  const saved=path.join(root,'equation.mathforge');
  const payload=Buffer.from(JSON.stringify({format:'mathforge-equation',state})).toString('base64');
  const request={action:'saveProject',id:'save-id',documentID:'doc',base64:payload,signature:'sig',name:'equation.mathforge'};
  dialog.saveResult={filePath:saved,canceled:false};await dispatch(request);
  assert.equal(receivedReply[0],'save-id');assert.equal(receivedReply[1].saved,true);assert.equal(fs.readFileSync(saved,'utf8'),Buffer.from(payload,'base64').toString('utf8'));
  assert.deepEqual(Array.from(dialog.saveCalls[0].filters[0].extensions),['mathforge']);
  const panelCount=dialog.saveCalls.length;
  await dispatch({...request,id:'second-save'});assert.equal(dialog.saveCalls.length,panelCount);assert.equal(receivedReply[1].saved,true);
  assert(!('path' in sync('formula-load-session').identity));
  // The actual preload forwards both native Open name and one-use token.
  dialog.openResult={filePaths:[saved],canceled:false};await dispatch({action:'import'});
  assert.equal(receivedImport[0],fs.readFileSync(saved,'utf8'));assert.equal(receivedImport[1],'mathforge');assert.equal(receivedImport[2],'equation.mathforge');assert.equal(typeof receivedImport[3],'string');
  await dispatch({action:'state',state,document:{...document,id:'opened',name:'equation.mathforge',dirty:false,savedSignature:'open-sig'}});
  await dispatch({action:'documentOpened',token:receivedImport[3],documentID:'opened'});
  await dispatch({...request,id:'after-open',documentID:'opened'});assert.equal(receivedReply[1].saved,true);assert.equal(dialog.saveCalls.length,panelCount);
  fs.writeFileSync(saved,'external');await dispatch({...request,id:'conflict',documentID:'opened'});assert.match(receivedReply[1].error,/其他程序/);assert.equal(fs.readFileSync(saved,'utf8'),'external');
  // Graphics export is a separate target and leaves Formula's identity intact.
  const exported=path.join(root,'equation.png');dialog.saveResult={filePath:exported,canceled:false};
  await dispatch({action:'save',id:'export',name:'equation.png',base64:Buffer.from('fixture-image').toString('base64')});
  assert.equal(fs.readFileSync(exported,'utf8'),'fixture-image');assert.equal(sync('formula-load-session').identity.id,'opened');
  const session=JSON.parse(fs.readFileSync(path.join(root,'document-session.json'),'utf8'));assert.equal(session.path,saved);
  const before=fs.readFileSync(saved,'utf8');let resolvePanel;dialog.saveResult=new Promise(resolve=>resolvePanel=resolve);
  const pending=dispatch({...request,id:'old-panel',documentID:'opened',saveAs:true});
  await dispatch({action:'state',state:{rawSource:''},document:{id:'new-doc',name:'未命名公式',dirty:true}});
  resolvePanel({filePath:saved,canceled:false});await pending;
  assert.match(receivedReply[1].error,/当前公式已改变/);assert.equal(fs.readFileSync(saved,'utf8'),before);
  const build=fs.readFileSync('Build-Windows.ps1','utf8');assert.match(build,/Copy-Item windows\/document-session\.cjs \$appDir/);
  console.log('PASS actual Windows main/preload IPC: paired launch, save replies, in-place Save, Open token adoption, conflict/error replies, stale panel rejection and graphics-export identity isolation');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});
