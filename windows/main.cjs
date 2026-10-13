const {app,BrowserWindow,ipcMain,dialog,clipboard,nativeImage,Menu}=require('electron');
const fs=require('fs');
const fsp=require('fs/promises');
const path=require('path');
const os=require('os');
const sharp=require('sharp');
const {spawnSync}=require('child_process');

let win;
const appRoot=__dirname;
const webRoot=path.join(appRoot,'web');
const iconPath=path.join(appRoot,'Formula.png');
const statePath=()=>path.join(app.getPath('userData'),'state.json');
const toolsPath=()=>path.join(app.getPath('userData'),'tools.json');
let toolPaths={};

function readJson(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2));}
function send(channel,...args){if(win&&!win.isDestroyed())win.webContents.send(channel,...args);}
function reply(id,result){send('formula-native-reply',id,result);}
function versionLine(exe){
  for(const args of [['--version'],['-version']]){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:8000});if(!r.error&&(r.status===0||r.status===1)){const s=(r.stdout||r.stderr||'').trim();if(s)return s.split(/\r?\n/)[0];}}
  return '已检测到';
}
function executable(file){try{return fs.statSync(file).isFile();}catch{return false;}}
function where(name){const r=spawnSync('where.exe',[name],{encoding:'utf8',windowsHide:true,timeout:5000});return r.status===0?(r.stdout||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean):[];}
function texliveCandidates(name){
  const roots=['C:\\texlive',path.join(process.env.ProgramFiles||'C:\\Program Files','texlive')];const out=[];
  for(const root of roots){try{for(const year of fs.readdirSync(root)){out.push(path.join(root,year,'bin','windows',name));}}catch{}}
  return out;
}
function candidates(key){
  const names=key==='latex'?['xelatex.exe','pdflatex.exe','lualatex.exe']:[key+'.exe'];
  let out=[];if(toolPaths[key])out.push(toolPaths[key]);for(const name of names){out.push(...where(name));out.push(...texliveCandidates(name));
    out.push(path.join(process.env.ProgramFiles||'C:\\Program Files','MiKTeX','miktex','bin','x64',name));
    out.push(path.join(process.env.LOCALAPPDATA||'', 'Programs','MiKTeX','miktex','bin','x64',name));
    out.push(path.join(process.env.LOCALAPPDATA||'', 'Microsoft','WinGet','Links',name));
    out.push(path.join(process.env.USERPROFILE||'', '.cargo','bin',name));
  }
  return [...new Set(out.filter(Boolean))];
}
function discover(key){for(const file of candidates(key)){if(executable(file))return {path:file,version:versionLine(file)};}return {path:'',version:'未安装，或当前路径不可执行'};}
function scanTools(){const result={};for(const key of ['latex','typst','dvisvgm','pdftops']){result[key]=discover(key);if(result[key].path)toolPaths[key]=result[key].path;}writeJson(toolsPath(),toolPaths);send('formula-tools',result);return result;}
function run(exe,args,cwd,timeout=45000){const r=spawnSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,timeout,maxBuffer:20*1024*1024});const text=((r.stdout||'')+'\n'+(r.stderr||'')).trim();if(r.error)throw new Error(r.error.message);return {code:r.status??1,text};}
function svgSize(svg){const vb=svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);if(vb)return {width:Math.ceil(Number(vb[1])),height:Math.ceil(Number(vb[2]))};const w=svg.match(/width=["']([\d.]+)/i),h=svg.match(/height=["']([\d.]+)/i);return {width:Math.ceil(Number(w?.[1]||800)),height:Math.ceil(Number(h?.[1]||300))};}
async function renderNative(data){
  const engine=data.engine||'latex',source=String(data.source||''),o=data.options||{};scanTools();const exe=toolPaths[engine];if(!exe)throw new Error(`未检测到 ${engine}。请在“系统工具”中指定路径。`);
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'Formula-render-'));let log='';try{
    const pdf=path.join(dir,'equation.pdf'),svg=path.join(dir,'equation.svg');
    if(engine==='typst'){
      const size=Math.max(10,Math.min(160,Number(o.size||32))),padding=Math.max(0,Math.min(80,Number(o.padding||12)))*0.75,color=/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#18232f';
      const fill=o.transparent===false?'white':'none',preamble=String(o.typstPreamble||'');
      const doc=`#set page(width: auto, height: auto, margin: ${padding}pt, fill: ${fill})\n#set text(size: ${size}pt, fill: rgb(\"${color}\"))\n${preamble}\n$ ${source} $\n`;
      await fsp.writeFile(path.join(dir,'equation.typ'),doc,'utf8');
      for(const format of ['pdf','svg']){const r=run(exe,['compile','--root',dir,'--format',format,'equation.typ',`equation.${format}`],dir);log+=r.text+'\n';if(r.code!==0)throw new Error('Typst 编译失败，请查看编译日志。');}
    }else{
      const size=Math.max(10,Math.min(160,Number(o.size||32))),padding=Math.max(0,Math.min(80,Number(o.padding||12)))*0.75,color=/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#18232f';const preamble=String(o.preamble||'\\usepackage{amsmath,amssymb}\n\\usepackage{xcolor}');
      const tex=`\\documentclass[border=${padding}pt]{standalone}\n\\usepackage{amsmath,amssymb,xcolor}\n${preamble}\n\\begin{document}\n\\definecolor{formula}{HTML}{${color.slice(1)}}\n\\color{formula}\\fontsize{${size}}{${size*1.2}}\\selectfont\n$\\displaystyle ${source}$\n\\end{document}\n`;
      await fsp.writeFile(path.join(dir,'equation.tex'),tex,'utf8');
      const r=run(exe,['-no-shell-escape','-interaction=nonstopmode','-halt-on-error','-file-line-error','-output-directory',dir,'equation.tex'],dir);log+=r.text+'\n';if(r.code!==0)throw new Error('LaTeX 编译失败，请查看编译日志。');
      const dvi=toolPaths.dvisvgm;if(!dvi)throw new Error('Windows 本机 LaTeX 预览需要 dvisvgm；也可切换到“内置排版”。');
      const s=run(dvi,['--pdf','--no-fonts','--output='+svg,pdf],dir);log+=s.text+'\n';if(s.code!==0)throw new Error('dvisvgm 转换 SVG 失败。');
    }
    const pdfBytes=await fsp.readFile(pdf),svgText=await fsp.readFile(svg,'utf8'),size=svgSize(svgText);const svgBytes=Buffer.from(svgText);const scale=Math.max(1,Math.min(4,Number(o.scale||3)));
    const raster=sharp(svgBytes).resize({width:Math.max(1,Math.ceil(size.width*scale))});
    const png=await (o.transparent===false?raster.clone().flatten({background:'#ffffff'}):raster.clone()).png().toBuffer();
    const jpeg=await raster.clone().flatten({background:'#ffffff'}).jpeg({quality:96}).toBuffer();
    const tiff=await (o.transparent===false?raster.clone().flatten({background:'#ffffff'}):raster.clone()).tiff().toBuffer();
    const result={engine:path.basename(exe),pdf:pdfBytes.toString('base64'),svg:svgBytes.toString('base64'),png:png.toString('base64'),jpeg:jpeg.toString('base64'),tiff:tiff.toString('base64'),width:Math.ceil(size.width*scale),height:Math.ceil(size.height*scale),log};
    if(toolPaths.pdftops){try{const eps=path.join(dir,'equation.eps'),e=run(toolPaths.pdftops,['-eps',pdf,eps],dir);log+=e.text+'\n';if(e.code===0)result.eps=(await fsp.readFile(eps)).toString('base64');}catch{}}
    result.log=log;return result;
  }finally{await fsp.rm(dir,{recursive:true,force:true});}
}

function createMenu(){const template=[{label:'文件',submenu:[{label:'导入公式…',accelerator:'Ctrl+O',click:()=>send('formula-result','请点击界面右上角“导入公式”',false)},{type:'separator'},{role:'quit',label:'退出'}]},{label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},{label:'帮助',submenu:[{label:`关于 Formula ${app.getVersion()}`,click:()=>dialog.showMessageBox(win,{type:'info',title:'Formula',message:`Formula ${app.getVersion()}`,detail:'Windows 版 · 内置公式排版无需安装 LaTeX / Typst。'})}]}];Menu.setApplicationMenu(Menu.buildFromTemplate(template));}
function createWindow(){
  win=new BrowserWindow({width:1180,height:900,minWidth:760,minHeight:650,title:'Formula · 公式工坊',icon:executable(iconPath)?iconPath:undefined,webPreferences:{preload:path.join(appRoot,'preload.cjs'),contextIsolation:false,nodeIntegration:false,sandbox:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file:'))e.preventDefault();});win.loadFile(path.join(webRoot,'index.html'));createMenu();win.webContents.once('did-finish-load',()=>scanTools());
}

ipcMain.on('formula-load-state',e=>{e.returnValue=readJson(statePath(),{});});
ipcMain.on('formula-native',async(event,data)=>{try{const action=data?.action;
  if(action==='state'){writeJson(statePath(),data.state||{});return;}
  if(action==='copy'){clipboard.writeText(String(data.text||''));return;}
  if(action==='copyImage'){clipboard.clear();for(const [kind,mime] of [['png','image/png'],['jpeg','image/jpeg'],['svg','image/svg+xml'],['pdf','application/pdf'],['tiff','image/tiff'],['eps','application/postscript']]){if(!data[kind])continue;const bytes=Buffer.from(data[kind],'base64');if(['png','jpeg'].includes(kind))clipboard.writeImage(nativeImage.createFromBuffer(bytes));clipboard.writeBuffer(mime,bytes);if(kind==='svg')clipboard.writeText(bytes.toString('utf8'));}return;}
  if(action==='save'){const r=await dialog.showSaveDialog(win,{defaultPath:data.name});if(r.canceled)return reply(data.id,{cancelled:true});await fsp.writeFile(r.filePath,Buffer.from(data.base64,'base64'));return reply(data.id,{saved:true});}
  if(action==='import'){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Formula files',extensions:['tex','typ','txt','svg','mathforge','json']}]});if(r.canceled||!r.filePaths[0])return;const file=r.filePaths[0],text=await fsp.readFile(file,'utf8');return send('formula-import',text,path.extname(file).slice(1).toLowerCase());}
  if(action==='scanTools'){scanTools();return;}
  if(action==='chooseTool'){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Executable',extensions:['exe']} ]});if(r.canceled||!r.filePaths[0])return;toolPaths[data.tool]=r.filePaths[0];writeJson(toolsPath(),toolPaths);scanTools();return;}
  if(action==='render'){try{return reply(data.id,await renderNative(data));}catch(err){return reply(data.id,{error:err.message,log:err.stack||err.message});}}
  if(action==='drag'){const dir=path.join(app.getPath('userData'),'DragExports');await fsp.mkdir(dir,{recursive:true});const file=path.join(dir,path.basename(data.name||'equation.svg'));await fsp.writeFile(file,Buffer.from(data.base64,'base64'));win.webContents.startDrag({file,icon:iconPath});return;}
}catch(err){if(data?.id)reply(data.id,{error:err.message});else send('formula-result',err.message,true);}});

app.whenReady().then(()=>{toolPaths=readJson(toolsPath(),{});createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
