import {tex2typst, typst2tex} from 'tex2typst';
import {jsPDF} from 'jspdf';
import 'svg2pdf.js';

const $ = id => document.getElementById(id);
const bridge = window.webkit?.messageHandlers?.mathforge;
const examples = {
  heat: String.raw`\mathrm{Nu}=0.023\,\mathrm{Re}^{0.8}\mathrm{Pr}^{0.4}`,
  efficiency: String.raw`\eta=\frac{Q_{\mathrm{useful}}}{Q_{\mathrm{solar}}}`,
  quadratic: String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
  matrix: String.raw`\mathbf{A}=\begin{pmatrix}a&b\\c&d\end{pmatrix}`
};
let state = {latex: examples.efficiency, rawSource:'', mode:'latex', engine:'embedded', history:[], size:32, padding:12, color:'#000000', transparent:true, scale:300/96, preamble:String.raw`\usepackage{amsmath,amssymb}
\usepackage{xcolor}`,typstPreamble:'',displayMode:'display'};
try { Object.assign(state, window.FormulaSavedState || JSON.parse(localStorage.getItem('mathforge') || '{}')); } catch {}
// WKWebView reinjects its launch snapshot on every reload. A font change
// restores the current editor snapshot once instead of that stale launch state.
try{const pending=sessionStorage.getItem('formula-font-reload-state');if(pending){Object.assign(state,JSON.parse(pending));sessionStorage.removeItem('formula-font-reload-state');}}catch{}
state.history = Array.isArray(state.history) ? state.history.filter(x=>typeof x==='string'||(x&&typeof x.rawSource==='string')).slice(0,100) : [];
if(!bridge)state.engine='embedded';
state.mode = state.mode === 'typst' ? 'typst' : 'latex';
state.mathFont=window.FormulaMathFont||'newcm';
for(const key of ['sourceZoom','visualZoom'])state[key]=Number.isFinite(state[key])?Math.max(0.5,Math.min(2.5,state[key])):(Number.isFinite(state.editorZoom)?state.editorZoom:1);
let valid = true, updating = false, renderID = 0, renderQueue = Promise.resolve(), svgResult = null, nativeResult=null, sourceTimer, visualTimer, conversionAvailable=true,lastRenderKey='';
const requests=new Map();
function nativeRequest(action,data){return new Promise((resolve,reject)=>{const id=String(Date.now())+'-'+Math.random().toString(36).slice(2);const timer=setTimeout(()=>{requests.delete(id);reject(new Error(action==='render'?'本机排版超时，请查看编译日志':'保存操作超时'));},action==='render'?180000:600000);requests.set(id,{resolve,reject,timer});send(action,{...data,id});});}
window.FormulaNativeReply=(id,result)=>{const req=requests.get(id);if(!req)return;clearTimeout(req.timer);requests.delete(id);if(result.log!==undefined)$('compile-log').textContent=result.log;if(result.error)req.reject(new Error(result.error));else req.resolve(result);};
function status(text, error=false){ $('status').textContent=text; $('status').classList.toggle('error',error); }
function send(action, data={}){ bridge?.postMessage({action,...data}); }
function persist(){ try{localStorage.setItem('mathforge',JSON.stringify(state));}catch{} send('state',{state}); }
function stripDelimiters(text){
  text=text.trim();
  if(text.startsWith('$$') && text.endsWith('$$'))return text.slice(2,-2).trim();
  if(text.startsWith('$') && text.endsWith('$'))return text.slice(1,-1).trim();
  if((text.startsWith('\\[')&&text.endsWith('\\]'))||(text.startsWith('\\(')&&text.endsWith('\\)')))return text.slice(2,-2).trim();
  return text;
}
// Compact generated math source without changing text or control-word boundaries.
function compactVisualLatex(source){
  const tokens=source.match(/\\[A-Za-z]+|\\[\s\S]|%[^\n]*(?:\n|$)|\s+|[\s\S]/g)||[];
  let result='',depth=0,textDepth=0,pendingText=false,controlWord=false;
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];
    if(/^\s+$/.test(token)&&!textDepth){
      if(controlWord&&/^[A-Za-z]/.test(tokens[i+1]||''))result+=' ';
      continue;
    }
    result+=token;
    if(token==='{'){depth++;if(pendingText&&!textDepth)textDepth=depth;pendingText=false;}
    else if(token==='}'){if(depth===textDepth)textDepth=0;depth=Math.max(0,depth-1);pendingText=false;}
    else if(token!=='*'||!pendingText)pendingText=/^\\(?:text|textnormal|textrm|textsf|texttt|textbf|textmd|textit|textsl|textsc|textup|operatorname|mbox|hbox|ce|pu)$/.test(token);
    controlWord=/^\\[A-Za-z]+$/.test(token);
  }
  return result;
}
function typst(latex){ return tex2typst(latex,{nonStrict:false}); }
function getModeSource(){return state.mode==='latex'?state.latex:typst(state.latex);}
function invalidate(message){
  valid=false;svgResult=null;nativeResult=null;$('source').classList.toggle('invalid',state.engine==='embedded');$('preview').replaceChildren();$('dimensions').textContent='排版失败';
  const box=document.createElement('div');box.className='render-error';const text=document.createElement('p');text.textContent=message;box.append(text);
  if(state.engine!=='embedded'){const log=document.createElement('button');log.textContent='查看完整编译日志';log.onclick=()=>{$('tool-dialog').showModal();$('compile-log').parentElement.open=true;$('compile-log').scrollIntoView({block:'nearest'});};const copyLog=document.createElement('button');copyLog.textContent='复制日志';copyLog.onclick=safe(()=>copy($('compile-log').textContent));const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>readSource();box.append(log,copyLog,retry);}
  $('preview').append(box);status(message,true);
}
function updateAlternates(){
  $('other-label').textContent=state.mode==='latex'?'Typst':'LaTeX';
  try{$('other-source').textContent=conversionAvailable?(state.mode==='latex'?typst(state.latex):state.latex):'本机可排版；此语法暂不支持转换为另一种源码。';}catch(e){$('other-source').textContent='此公式暂不支持转换为 Typst：'+e.message;}
  try{$('mathml').textContent=conversionAvailable?mf.getValue('math-ml'):'此语法暂不支持 MathML 转换。';}catch{$('mathml').textContent='当前编辑结构尚未完成。';}
}
function updateMode(){
  $('mode-latex').classList.toggle('active',state.mode==='latex');$('mode-typst').classList.toggle('active',state.mode==='typst');
  $('source-hint').textContent=state.mode==='typst'?'Typst 数学模式，可粘贴 $…$；不支持整篇文档或自定义函数':'可粘贴带 $…$ 或 \\[ … \\] 的公式';
  $('source').setAttribute('aria-label',state.mode+' 公式源码');
}
function settings(){for(const key of ['size','padding','scale'])state[key]=Number($(key).value);state.color=$('color').value;state.transparent=$('transparent').checked;}
function scheduleRender(){
  const key=JSON.stringify({latex:state.latex,rawSource:state.rawSource,engine:state.engine,size:state.size,padding:state.padding,color:state.color,transparent:state.transparent,scale:state.scale,preamble:state.preamble,typstPreamble:state.typstPreamble,displayMode:state.displayMode});
  if(key===lastRenderKey&&valid&&(svgResult||nativeResult))return renderQueue;
  const id=++renderID, latex=state.latex, opts={...state};
  svgResult=null;nativeResult=null;
  renderQueue=renderQueue.catch(()=>{}).then(async()=>{
    if(id!==renderID)return;
    if(opts.engine!=='embedded'){
      if(!bridge)throw new Error('本机引擎需要在 Formula Mac 应用中使用');
      status('正在调用本机 '+(opts.engine==='typst'?'Typst':'LaTeX')+'…');
      const result=await nativeRequest('render',{engine:opts.engine,source:opts.rawSource,options:{size:opts.size,padding:opts.padding,color:opts.color,transparent:opts.transparent,scale:opts.scale,preamble:opts.preamble,typstPreamble:opts.typstPreamble,displayMode:opts.displayMode}});
      if(id!==renderID)return;
      nativeResult=result;lastRenderKey=key;valid=true;$('source').classList.remove('invalid');
      const img=new Image();img.className='preview-image';img.src='data:image/png;base64,'+result.png;$('preview').replaceChildren(img);
      $('dimensions').textContent=`${result.width} × ${result.height} px`;
      updateOutputFormats();status('本机排版完成 · '+result.engine);persist();return;
    }
    await MathJax.startup.promise;
    const container=await MathJax.tex2svgPromise(latex,{display:opts.displayMode!=='inline'});
    if(id!==renderID)return;
    if(container.querySelector('[data-mml-node="merror"]'))throw new Error(container.textContent || '公式排版失败');
    const raw=container.querySelector('svg');
    if(!raw)throw new Error('没有生成公式图像');
    const vb=raw.getAttribute('viewBox').split(/\s+/).map(Number);
    const unit=opts.size*4/3/1000, pad=opts.padding/unit;
    const width=vb[2]*unit+2*opts.padding, height=vb[3]*unit+2*opts.padding;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('请输入非空公式');
    const svg=raw.cloneNode(true);
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    svg.setAttribute('viewBox',`${vb[0]-pad} ${vb[1]-pad} ${vb[2]+2*pad} ${vb[3]+2*pad}`);
    svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.removeAttribute('style');svg.removeAttribute('role');svg.removeAttribute('focusable');
    svg.querySelectorAll('g').forEach(g=>{if(g.getAttribute('fill')==='currentColor')g.setAttribute('fill',opts.color);if(g.getAttribute('stroke')==='currentColor')g.setAttribute('stroke',opts.color);});
    svg.setAttribute('color',opts.color);
    if(!opts.transparent){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');Object.entries({x:vb[0]-pad,y:vb[1]-pad,width:vb[2]+2*pad,height:vb[3]+2*pad,fill:'#ffffff'}).forEach(([k,v])=>rect.setAttribute(k,String(v)));svg.prepend(rect);}
    const meta=document.createElementNS('http://www.w3.org/2000/svg','metadata');meta.textContent=JSON.stringify({generator:'Formula',latex,format:'mathforge-equation',version:1,state:{...opts,history:[]}});svg.prepend(meta);
    svgResult={svg,width,height};lastRenderKey=key;valid=true;$('source').classList.remove('invalid');
    $('preview').replaceChildren(svg.cloneNode(true));$('dimensions').textContent=`${Math.ceil(width)} × ${Math.ceil(height)} px`;
    updateOutputFormats();status(state.mode==='typst'?'Typst 已转换并同步；请核对预览':'已同步 · 可导出');persist();
  }).catch(e=>{if(id===renderID)invalidate(e.message);});
  return renderQueue;
}
function readSource(){
  clearTimeout(sourceTimer);clearTimeout(visualTimer);
  try {
    const src=stripDelimiters($('source').value);
    if(!src)throw new Error('请输入公式');
    if(state.engine!=='typst'&&state.mode==='typst' && /#|\b(?:set|show|let|import|include)\b/.test(src))throw new Error('内置模式只支持 Typst 数学公式；文档指令或自定义函数请使用本机 Typst');
    state.rawSource=src;
    let latex;
    try{latex=state.mode==='typst'?typst2tex(src):src;conversionAvailable=true;mf.readOnly=false;}
    catch(e){if(state.engine!=='typst')throw e;conversionAvailable=false;mf.readOnly=true;latex='';}
    updating=true;mf.setValue(latex,{silenceNotifications:true});updating=false;
    state.latex=latex;valid=true;updateAlternates();return scheduleRender();
  }catch(e){updating=false;++renderID;invalidate(e.message);return Promise.resolve();}
}
async function switchMode(mode){
  if(state.engine==='latex'&&mode==='typst'){status('本机 LaTeX 使用 LaTeX 源码。请切换到内置排版或本机 Typst。',true);return;}
  if(state.engine==='typst'&&mode==='latex'){status('本机 Typst 使用 Typst 源码。请切换到内置排版或本机 LaTeX。',true);return;}
  if(mode===state.mode)return;
  // Keep the canonical LaTeX when the generated alternate source is untouched.
  // Only parse again after an actual source edit, avoiding lossy round trips.
  if(stripDelimiters($('source').value)!==state.rawSource){await readSource();if(!valid)return;}
  if(!conversionAvailable){status('此语法暂不支持转换为另一种源码。',true);return;}
  try{const next=mode==='latex'?state.latex:typst(state.latex);state.mode=mode;$('source').value=next;state.rawSource=stripDelimiters(next);updateMode();updateAlternates();persist();scheduleRender();}
  catch(e){status('无法切换：'+e.message,true);}
}
function loadLatex(latex){state.latex=latex;conversionAvailable=true;mf.readOnly=false;updating=true;mf.setValue(latex,{silenceNotifications:true});updating=false;try{$('source').value=getModeSource();}catch{state.mode='latex';$('source').value=latex;}state.rawSource=stripDelimiters($('source').value);updateMode();updateAlternates();scheduleRender();}
function svgText(){return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(svgResult.svg);}
async function pngWithDPI(blob,dpi){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);
  view.setUint32(0,9);chunk.set([112,72,89,115],4);
  const ppm=Math.round(dpi/0.0254);view.setUint32(8,ppm);view.setUint32(12,ppm);chunk[16]=1;
  let crc=0xffffffff;for(const byte of chunk.subarray(4,17)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(17,(crc^0xffffffff)>>>0);
  const parts=[bytes.subarray(0,8)];let inserted=false;
  for(let offset=8;offset+12<=bytes.length;){const length=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0);const end=offset+length+12;const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(type==='IDAT'&&!inserted){parts.push(chunk);inserted=true;}if(type!=='pHYs')parts.push(bytes.subarray(offset,end));offset=end;
  }
  return new Blob(parts,{type:'image/png'});
}
function ensureResolutionOption(){if(![...$('scale').options].some(o=>Number(o.value)===state.scale)){const option=new Option(Math.round(state.scale*96)+' DPI（原设置）',String(state.scale));$('scale').add(option);}}
async function bytesBase64(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
async function save(blob, name){
  if(bridge){status('请选择保存位置');const result=await nativeRequest('save',{name,base64:await bytesBase64(blob)});status(result.cancelled?'已取消保存':'已保存 '+name);}
  else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('已导出 '+name);}
}
async function copy(text, format='text'){
  if(bridge){send('copy',{text,format});status('已复制');return;}
  try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();if(!document.execCommand('copy'))throw new Error('复制失败，请手动选择源码复制');ta.remove();}status('已复制');
}
async function exportFile(kind,copying=false){
  const deliver=async(blob,name)=>{
    if(!copying)return save(blob,name);
    if(['latex','typst','mathml','project'].includes(kind))return copy(await blob.text());
    if(bridge){send('copyImage',{[kind]:await bytesBase64(blob)});status('已复制 '+$('output-format').selectedOptions[0].textContent);return;}
    if(!navigator.clipboard?.write||!ClipboardItem.supports(blob.type))throw new Error('此格式的复制需要本机应用');
    await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);status('已复制');
  };
  await readSource();await renderQueue;if(!valid)throw new Error('请先修正公式再导出');
  if(kind==='project'){return deliver(new Blob([JSON.stringify({format:'mathforge-equation',version:1,state:{...state,history:[]}},null,2)],{type:'application/json'}),'equation.mathforge');}
  if(['latex','typst','mathml'].includes(kind)){if(!conversionAvailable)throw new Error('此语法暂不支持跨格式转换，可保存为可恢复公式文件');const txt=kind==='latex'?state.latex:kind==='typst'?typst(state.latex):mf.getValue('math-ml');return deliver(new Blob([kind==='typst'?'$ '+txt+' $':txt],{type:'text/plain;charset=utf-8'}),'equation.'+({latex:'tex',typst:'typ',mathml:'mml'}[kind]));}
  if(state.engine!=='embedded'){
    if(!nativeResult)throw new Error('本机排版结果尚未就绪');
    if(!nativeResult[kind])throw new Error(kind==='svg'?'本机 LaTeX 导出 SVG 需要可用的 dvisvgm。可在系统工具中指定路径。':kind==='eps'?'EPS 导出需要 pdftops，可在系统工具中指定路径。':'此格式未能生成，请查看编译日志');
    return deliver(new Blob([Uint8Array.from(atob(nativeResult[kind]),c=>c.charCodeAt(0))],{type:({svg:'image/svg+xml',pdf:'application/pdf',png:'image/png',jpeg:'image/jpeg',tiff:'image/tiff',eps:'application/postscript'})[kind]}),'equation.'+(kind==='jpeg'?'jpg':kind));
  }
  if(!svgResult)throw new Error('请先修正公式再导出');
  if(['tiff','eps'].includes(kind))throw new Error('TIFF / EPS 请使用本机 LaTeX 或 Typst 引擎');
  const {width,height,svg}=svgResult;
  if(kind==='svg')return deliver(new Blob([svgText()],{type:'image/svg+xml'}),'equation.svg');
  if(kind==='pdf'){
    const w=width*.75,h=height*.75;
    const pdf=new jsPDF({orientation:w>h?'landscape':'portrait',unit:'pt',format:[w,h]});
    pdf.setProperties({title:'Formula equation',subject:'MathForge:'+JSON.stringify({format:'mathforge-equation',version:1,state:{...state,history:[]}})});
    await pdf.svg(svg.cloneNode(true),{x:0,y:0,width:w,height:h});return deliver(pdf.output('blob'),'equation.pdf');
  }
  const scale=Number($('scale').value),w=Math.ceil(width*scale),h=Math.ceil(height*scale);
  if(w*h>50000000||w>16000||h>16000)throw new Error('PNG 尺寸过大，请降低字号或清晰度');
  const url=URL.createObjectURL(new Blob([svgText()],{type:'image/svg+xml'}));
  try{const img=new Image();img.src=url;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片渲染失败'));});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(kind==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}ctx.drawImage(img,0,0,w,h);const mime=kind==='jpeg'?'image/jpeg':'image/png';const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,.96));if(!blob)throw new Error('图片导出失败');return deliver(kind==='png'?await pngWithDPI(blob,scale*96):blob,'equation.'+(kind==='jpeg'?'jpg':'png'));}finally{URL.revokeObjectURL(url);}
}
function history(){
  $('history').replaceChildren();state.history.forEach((item,i)=>{const text=typeof item==='string'?item:item.rawSource;const wrap=document.createElement('div');wrap.className='history-item';const b=document.createElement('button');b.textContent=text;b.title=text;b.onclick=()=>{if(typeof item==='string')loadLatex(item);else restore(item);};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','删除收藏');del.onclick=()=>{state.history.splice(i,1);history();persist();};wrap.append(b,del);$('history').append(wrap);});
}
function updateOutputFormats(){
  const selected=$('output-format').value;
  const formats=[['svg','SVG'],['pdf','PDF'],['png','PNG'],['jpeg','JPEG'],['tiff','TIFF'],['eps','EPS'],['latex','LaTeX 源码'],['typst','Typst 源码'],['mathml','MathML'],['project','MathForge']];
  const available=formats.filter(([kind])=>kind==='project'||(['latex','typst','mathml'].includes(kind)?conversionAvailable:state.engine==='embedded'?!['tiff','eps'].includes(kind):!!nativeResult?.[kind]));
  $('output-format').replaceChildren(...available.map(([kind,label])=>new Option(label,kind)));
  if(available.some(([kind])=>kind===selected))$('output-format').value=selected;
}

function applyUI(){updateOutputFormats();$('math-font').value=state.mathFont;$('math-font').disabled=state.engine!=='embedded';ensureResolutionOption();for(const key of ['size','padding','scale','color','transparent']){if(key==='transparent')$(key).checked=state[key];else $(key).value=state[key];}$('engine').value=state.engine;$('preamble').value=state.preamble;$('typst-preamble').value=state.typstPreamble;$('display-mode').value=state.displayMode;$('engine-note').textContent=state.engine==='embedded'?'MathJax 矢量排版':'本机 '+(state.engine==='typst'?'Typst':'LaTeX');updateMode();}
function restore(saved){
  const keepHistory=state.history;for(const k of ['latex','rawSource','mode','engine','size','padding','color','transparent','scale','mathFont','preamble','typstPreamble','displayMode'])if(saved[k]!==undefined)state[k]=saved[k];state.history=keepHistory;
  if(!bridge)state.engine='embedded';applyUI();$('source').value=state.rawSource||getModeSource();readSource();
}
function importContent(text,ext){
  if(['mathforge','json'].includes(ext)){const data=JSON.parse(text);if(data.format==='mathforge-library'){state.history=data.history.slice(0,100);history();persist();status('收藏已恢复');return;}if(data.format!=='mathforge-equation')throw new Error('无法识别的公式文件');restore(data.state);return;}
  if(ext==='svg'){const meta=new DOMParser().parseFromString(text,'image/svg+xml').querySelector('metadata');if(!meta)throw new Error('SVG 中没有可恢复源码');const data=JSON.parse(meta.textContent);if(data.state)restore(data.state);else loadLatex(data.latex);return;}
  if(ext==='tex'&&text.includes('\\begin{document}')){const body=text.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);if(!body)throw new Error('LaTeX 文档不完整');state.preamble=text.split('\\begin{document}')[0].replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/,'').trim();text=body[1];if(bridge)state.engine='latex';}
  state.mode=ext==='typ'?'typst':'latex';if(state.engine!=='embedded')state.engine=state.mode==='typst'?'typst':'latex';$('source').value=text;applyUI();readSource();
}
let detectedTools={};
window.FormulaTools=tools=>{detectedTools=tools;$('tool-paths').replaceChildren();for(const [key,label] of Object.entries({latex:'LaTeX',typst:'Typst',dvisvgm:'dvisvgm',pdftops:'pdftops'})){const row=document.createElement('div');row.className='tool-row';const name=document.createElement('span');name.textContent=label;const path=document.createElement('code');path.textContent=tools[key]?.path||'未检测到';const version=document.createElement('small');version.textContent=tools[key]?.version||'';path.append(version);const button=document.createElement('button');button.textContent='指定路径';button.onclick=()=>send('chooseTool',{tool:key});row.append(name,path,button);$('tool-paths').append(row);}};
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){status(e.message,true);}};
window.FormulaNativeResult=(message,error=false)=>status(message,error);
window.FormulaImport=(text,ext)=>safe(()=>importContent(text,ext))();
window.FormulaAction=kind=>safe(async()=>{if(kind==='copy')await copy($('source').value);else if(kind==='import')$('import').click();else await exportFile(kind);})();
window.FormulaTest={pngWithDPI,compactVisualLatex,exportFile,readSource,stripDelimiters,getState:()=>state,getSVG:()=>svgResult?svgText():null};

MathLive.MathfieldElement.fontsDirectory=new URL('vendor/mathlive/fonts',document.baseURI).href;
MathLive.MathfieldElement.soundsDirectory=null;
const mf=new MathLive.MathfieldElement();mf.id='formula';mf.setAttribute('aria-label','可视化公式编辑器');mf.mathVirtualKeyboardPolicy='manual';$('editor-mount').append(mf);
// Require explicit LaTeX commands instead of silently rewriting typed letters.
// Toolbar structures and backslash command entry remain available.
mf.inlineShortcuts={};
// MathLive command mode can lose the backslash when replacing a selection.
// Delete the selected range first, then let its normal command handler run.
mf.addEventListener('keydown',event=>{
  if(event.key==='\\'&&!mf.readOnly&&mf.mode!=='latex'&&!mf.selectionIsCollapsed)mf.executeCommand('deleteBackward');
},{capture:true});
mf.addEventListener('keyup',event=>{
  if(event.key==='Enter'&&mf.mode==='math'&&mf.getValue(mf.selection,'latex')==='\\sqrt{}'){
    mf.insert('\\sqrt{#?}',{format:'latex',insertionMode:'replaceSelection',selectionMode:'placeholder',silenceNotifications:false,focus:true});
    syncVisual(true);
  }
});
function syncVisual(force=false){
  if(updating||mf.readOnly||mf.mode==='latex')return;
  try{
    const latex=compactVisualLatex(mf.getValue('latex-without-placeholders'));
    if(!force&&latex===state.latex)return;
    clearTimeout(sourceTimer);clearTimeout(visualTimer);state.latex=latex;conversionAvailable=true;
    try{$('source').value=getModeSource();}catch{state.mode='latex';state.engine='embedded';$('source').value=latex;applyUI();}
    state.rawSource=stripDelimiters($('source').value);updateAlternates();persist();
    ++renderID;svgResult=null;nativeResult=null;
    if(!state.rawSource){$('preview').replaceChildren();$('dimensions').textContent='等待输入';status('请输入公式');return;}
    status('源码已同步 · 正在准备预览…');
    visualTimer=setTimeout(scheduleRender,state.engine==='embedded'?100:650);
  }catch(e){status('编辑同步失败：'+e.message,true);}
}
for(const event of ['input','change','keyup','compositionend','blur'])mf.addEventListener(event,()=>syncVisual());
// WebKit may repaint its editable shadow tree before delivering an input event.
// Read the editor value after such changes, but only while the editor has focus.
if(mf.shadowRoot){new MutationObserver(()=>{
  if(document.activeElement===mf&&!updating)syncVisual();
}).observe(mf.shadowRoot,{childList:true,subtree:true,characterData:true});}
// A click in the editor's whitespace should focus its keyboard sink too.
mf.addEventListener('pointerdown',()=>{if(!mf.readOnly)mf.focus();});
$('source').addEventListener('input',()=>{clearTimeout(sourceTimer);svgResult=null;nativeResult=null;sourceTimer=setTimeout(readSource,state.engine==='embedded'?220:650);});
$('mode-latex').onclick=()=>switchMode('latex');$('mode-typst').onclick=()=>switchMode('typst');
// A persistent, draggable primary toolbar; extended groups remain available.
const toolbar=$('tools'), primaryToolbar=document.createElement('div');
primaryToolbar.className='primary-tools';primaryToolbar.id='primary-tools';
const originals=[...toolbar.querySelectorAll('[data-insert],[data-command],[data-style]')];
const catalog=originals.map((button,index)=>({id:String(index),button,label:button.textContent.trim()}));
function toolIcon(label){
  const name=label.replace(/\s.*$/,'');
  const glyphs={'分数':'½','上标':'x²','下标':'x₁','根号':'√x','积分':'∫','求和':'∑','圆括号':'(x)','方括号':'[x]','大括号':'{x}','绝对值':'|x|','范数':'‖x‖','n':'ⁿ√x','极限':'lim','连乘':'∏','定积分':'∫ₐᵇ','偏导':'∂y/∂x','导数':'dy/dx','上下标':'xᵢ²','正体':'Aa','粗体':'𝐀','黑板体':'ℝ','花体':'ℒ','文本':'abc','向量':'x⃗','帽号':'x̂','上划线':'x̅','下划线':'x̲','上方加行':'↑＋','下方加行':'↓＋','删除行':'↔−','左侧加列':'←＋','右侧加列':'→＋','删除列':'↕−','撤销':'↶','重做':'↷'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 30');svg.setAttribute('aria-hidden','true');svg.classList.add('tool-icon');
  const text=(value,x,y,size=17)=>{const node=document.createElementNS(svg.namespaceURI,'text');node.setAttribute('x',x);node.setAttribute('y',y);node.setAttribute('font-size',size);node.setAttribute('text-anchor','middle');node.textContent=value;svg.append(node);};
  if(name==='分段公式'){text('{',8,24,29);text('x, x≥0',28,12,8);text('−x, x<0',28,24,8);}
  else if(/矩阵|行列式|多行对齐/.test(label)){const bracket=label==='行列式'?'|':label==='方括号矩阵'?'[':label==='无括号矩阵'||label==='多行对齐'?'':'(';text(bracket,5,23,26);text(bracket==='['?']':bracket==='('?')':bracket,39,23,26);text('a  b',22,12,10);text('c  d',22,24,10);}
  else text(glyphs[name]||label,22,22,/导数|偏导/.test(name)?11:17);
  return svg;
}
for(const entry of catalog){
  entry.button.dataset.toolLabel=entry.label;
  entry.button.setAttribute('aria-label',entry.label);
  entry.button.querySelectorAll('b').forEach(node=>node.remove());
  const caption=document.createElement('span');caption.className='tool-caption';caption.textContent=entry.button.textContent.trim();
  entry.button.replaceChildren(toolIcon(entry.label),caption);
}
const defaultToolbar=catalog.filter(entry=>entry.button.parentElement===toolbar).map(entry=>entry.id);
let toolbarLayout=[...defaultToolbar],customizingToolbar=false,draggedTool=null;
try{const saved=JSON.parse(localStorage.getItem('formula-toolbar-layout'));if(Array.isArray(saved))toolbarLayout=[...new Set(saved.filter(id=>catalog.some(entry=>entry.id===id)))];}catch{}
// Stable keys include the action so future additions do not change saved meanings.
for(const entry of catalog)entry.key=entry.button.dataset.insert||entry.button.dataset.command||entry.button.dataset.style;
try{const saved=JSON.parse(localStorage.getItem('formula-toolbar-layout-v2'));if(Array.isArray(saved))toolbarLayout=saved.map(key=>catalog.find(entry=>entry.key===key)?.id).filter(Boolean);}catch{}
toolbar.prepend(primaryToolbar);
let toolbarDisplay=localStorage.getItem('formula-toolbar-display')||'both';
if(!['both','icons','text'].includes(toolbarDisplay))toolbarDisplay='both';
function applyToolbarDisplay(){toolbar.dataset.display=toolbarDisplay;$('toolbar-display').value=toolbarDisplay;}
$('toolbar-display').onchange=()=>{toolbarDisplay=$('toolbar-display').value;localStorage.setItem('formula-toolbar-display',toolbarDisplay);applyToolbarDisplay();};applyToolbarDisplay();
function renderToolbar(){
  primaryToolbar.replaceChildren();
  for(const entry of catalog)entry.button.hidden=entry.button.parentElement===toolbar;
  for(const id of toolbarLayout){
    const entry=catalog.find(entry=>entry.id===id);if(!entry)continue;
    const button=entry.button.cloneNode(true);button.hidden=false;button.dataset.toolId=id;
    button.draggable=customizingToolbar;button.title=customizingToolbar?'拖拽调整顺序':entry.label;
    primaryToolbar.append(button);
  }
  primaryToolbar.classList.toggle('customizing',customizingToolbar);
  $('customize-toolbar').textContent=customizingToolbar?'完成自定义':'自定义工具栏';
  $('customize-toolbar').setAttribute('aria-expanded',String(customizingToolbar));
  $('toolbar-remove').hidden=!customizingToolbar;$('reset-toolbar').hidden=!customizingToolbar;$('toolbar-options').hidden=!customizingToolbar;
  $('toolbar-options').replaceChildren();
  if(customizingToolbar)for(const entry of catalog){
    const label=document.createElement('label'),input=document.createElement('input');label.draggable=true;label.dataset.toolId=entry.id;label.title='拖到上方工具栏添加';input.type='checkbox';input.checked=toolbarLayout.includes(entry.id);
    input.onchange=()=>{toolbarLayout=input.checked?[...toolbarLayout,entry.id]:toolbarLayout.filter(id=>id!==entry.id);saveToolbar();};
    label.append(input,toolIcon(entry.label),document.createTextNode(entry.label));$('toolbar-options').append(label);
  }
}
function saveToolbar(){localStorage.setItem('formula-toolbar-layout-v2',JSON.stringify(toolbarLayout.map(id=>catalog.find(entry=>entry.id===id).key)));renderToolbar();}
$('customize-toolbar').onclick=()=>{customizingToolbar=!customizingToolbar;renderToolbar();};
$('reset-toolbar').onclick=()=>{toolbarLayout=[...defaultToolbar];saveToolbar();};
function startToolDrag(e){const button=e.target.closest('[data-tool-id]');if(!customizingToolbar||!button)return;draggedTool=button.dataset.toolId;e.dataTransfer.setData('text/plain',draggedTool);e.dataTransfer.effectAllowed='move';}
primaryToolbar.addEventListener('dragstart',startToolDrag);$('toolbar-options').addEventListener('dragstart',startToolDrag);
primaryToolbar.addEventListener('dragover',e=>{if(customizingToolbar)e.preventDefault();});
primaryToolbar.addEventListener('drop',e=>{
  if(!customizingToolbar)return;e.preventDefault();const target=e.target.closest('[data-tool-id]');
  if(!draggedTool||(target&&draggedTool===target.dataset.toolId))return;
  toolbarLayout=toolbarLayout.filter(id=>id!==draggedTool);toolbarLayout.splice(target?toolbarLayout.indexOf(target.dataset.toolId):toolbarLayout.length,0,draggedTool);draggedTool=null;saveToolbar();
});
primaryToolbar.addEventListener('dragend',()=>{draggedTool=null;});
$('toolbar-remove').addEventListener('dragover',e=>{if(customizingToolbar)e.preventDefault();});
$('toolbar-remove').addEventListener('drop',e=>{if(!customizingToolbar||!draggedTool)return;e.preventDefault();toolbarLayout=toolbarLayout.filter(id=>id!==draggedTool);draggedTool=null;saveToolbar();});renderToolbar();

// Match the reference editor's ten categories without changing saved action keys.
const categorySpecs=[
 ['常用符号',String.raw`\begin{matrix}\times&{\color{#64a6df}\cap}\\{\color{#64a6df}\therefore}&\propto\end{matrix}`,['∞','≤','≥','≠','≈','∈','→','×','±']],
 ['希腊字母',String.raw`\begin{matrix}\alpha&{\color{#64a6df}\beta}\\{\color{#64a6df}\gamma}&\delta\end{matrix}`,['α','β','γ','θ','π']],
 ['分数微分',String.raw`\frac{x}{{\color{#64a6df}y}}`,['分数 ½','偏导','导数']],
 ['根式角标',String.raw`{\color{#64a6df}\sqrt{\color{black}e^{\color{#64a6df}x}}}`,['根号 √','上标 x²','下标 x₁','n 次根','上下标']],
 ['极限对数',String.raw`{\color{#64a6df}\lim}_{n\to\infty}`,['极限']],
 ['三角函数',String.raw`{\color{#64a6df}\sin}\,\alpha`,[]],
 ['积分运算',String.raw`{\color{#64a6df}\int}_a^b`,['积分 ∫','定积分']],
 ['大型运算',String.raw`{\color{#64a6df}\sum}_{i=0}^n`,['求和 ∑','连乘']],
 ['括号取整',String.raw`{\color{#64a6df}\{}[(\,)]{\color{#64a6df}\}}`,['圆括号','方括号','大括号','绝对值','范数']],
 ['数组矩阵',String.raw`\begin{bmatrix}0&1\\1&0\end{bmatrix}`,['矩阵','分段公式','方括号矩阵','行列式','无括号矩阵','多行对齐','上方加行','下方加行','删除行','左侧加列','右侧加列','删除列']]
];
const allOriginals=catalog.map(entry=>entry.button);
for(const old of toolbar.querySelectorAll('.tool-group,.table-tools'))old.remove();
for(const [name,demo,labels] of categorySpecs){
 const group=document.createElement('details');group.className='tool-group';const summary=document.createElement('summary');summary.setAttribute('aria-label',name);
 const art=document.createElement('span');art.className='category-art';art.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.className='category-label';label.textContent=name;summary.append(art,label);const panel=document.createElement('div');
 for(const title of labels){const entry=catalog.find(entry=>entry.label===title);if(entry){entry.button.hidden=false;panel.append(entry.button);}}
 if(name==='三角函数'||name==='极限对数')for(const command of name==='三角函数'?['sin','cos','tan','cot','arcsin','arccos','arctan']:['log','ln','exp']){const button=document.createElement('button');button.dataset.insert='\\'+command+' #@';button.setAttribute('aria-label',command);button.append(toolIcon(command));panel.append(button);}
 group.append(summary,panel);toolbar.append(group);
 (async()=>{while(!window.MathJax?.tex2svgPromise)await new Promise(resolve=>setTimeout(resolve,50));try{art.append(await MathJax.tex2svgPromise('\\displaystyle '+demo,{display:false}));}catch{art.append(toolIcon(labels[0]||name));}})();
}
const formatting=document.createElement('div');formatting.className='format-popup';formatting.hidden=true;
for(const title of ['正体','粗体','黑板体','花体','文本','向量','帽号','上划线','下划线','撤销','重做']){const entry=catalog.find(entry=>entry.label===title);entry.button.hidden=false;formatting.append(entry.button);}
toolbar.parentElement.append(formatting);
$('font-menu').addEventListener('pointerdown',e=>e.preventDefault());
$('font-menu').onclick=()=>{formatting.hidden=!formatting.hidden;const r=$('font-menu').getBoundingClientRect();formatting.style.left=Math.max(8,Math.min(r.left,innerWidth-formatting.offsetWidth-8))+'px';formatting.style.top=(r.bottom+6+formatting.offsetHeight>innerHeight?r.top-formatting.offsetHeight-6:r.bottom+6)+'px';};
formatting.addEventListener('click',()=>formatting.hidden=true);
const inputEditors=document.querySelector('.input-editors');
function setInputPane(mode){inputEditors.dataset.inputMode=mode;for(const id of ['mode-latex','mode-typst'])$(id).disabled=mode==='visual';$('input-source').classList.toggle('active',mode==='source');$('input-visual').classList.toggle('active',mode==='visual');}
$('input-source').onclick=()=>{setInputPane('source');$('source').focus();};
$('input-visual').onclick=()=>{clearTimeout(sourceTimer);readSource();setInputPane('visual');mf.focus();};
const originalFocus=mf.focus.bind(mf);mf.focus=(...args)=>{setInputPane('visual');return originalFocus(...args);};
$('clear-input').onclick=()=>{clearTimeout(sourceTimer);clearTimeout(visualTimer);mf.setValue('');syncVisual(true);svgResult=null;nativeResult=null;valid=false;state.latex='';state.rawSource='';persist();$('source').value='';$('preview').replaceChildren();status('请输入公式');};
$('math-font').value=state.mathFont;
let fontSwitchID=0;
$('math-font').onchange=async()=>{
  const requested=$('math-font').value,id=++fontSwitchID;
  try{
    await MathJax.startup.promise;
    await MathJax.loader.load('[fonts]/mathjax-'+requested+'-font/svg');
    if(id!==fontSwitchID)return;
    const classes=MathJax._.output.fonts['mathjax-'+requested].svg_ts;
    const Font=Object.values(classes).find(value=>typeof value==='function');
    const jax=MathJax.startup.document.outputJax;
    jax.font=new Font({dynamicPrefix:'[fonts]/mathjax-'+requested+'-font/svg/dynamic'});
    jax.clearFontCache();
    state.mathFont=requested;window.FormulaMathFont=requested;
    localStorage.setItem('formula-math-font',requested);persist();
    lastRenderKey='';if(stripDelimiters($('source').value)!==state.rawSource)await readSource();else await scheduleRender();
  }catch(e){$('math-font').value=state.mathFont;status('字体切换失败：'+e.message,true);}
};
function applyEditorZoom(){document.querySelector('.input-editors').style.setProperty('--editor-source-size',(16*state.sourceZoom)+'px');document.querySelector('.input-editors').style.setProperty('--editor-visual-size',(28*state.visualZoom)+'px');}
applyEditorZoom();
for(const [id,step] of [['editor-size-down',-0.1],['editor-size-up',0.1]])$(id).onclick=()=>{const key=inputEditors.dataset.inputMode==='visual'?'visualZoom':'sourceZoom';state[key]=Math.max(0.5,Math.min(2.5,Math.round((state[key]+step)*10)/10));applyEditorZoom();persist();};

for(const [id,step] of [['input-size-down',-2],['input-size-up',2]])$(id).onclick=()=>{const value=Number($('size').value);$('size').value=Math.max(10,Math.min(160,(Number.isFinite(value)?value:state.size)+step));$('size').dispatchEvent(new Event('change'));};
document.querySelector('.tool-deck').prepend(document.querySelector('.examples'));
let currentTab='quick';
function selectToolTab(tab){currentTab=tab;document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));toolbar.dataset.tab=tab;document.querySelector('.toolbar-customize').hidden=tab!=='custom';document.querySelector('.examples').hidden=tab!=='templates';$('history').hidden=tab!=='favorites';if(tab==='templates')document.querySelector('.tool-deck').prepend(document.querySelector('.examples'));if(tab==='favorites')document.querySelector('.tool-deck').prepend($('history'));}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>selectToolTab(button.dataset.tab));selectToolTab('quick');document.querySelector('.preview-card>.section-head').append($('remember'));
const toolMenus=[...toolbar.querySelectorAll('.tool-group')];
function closeToolMenus(){for(const menu of toolMenus)menu.open=false;}
for(const menu of toolMenus){
  const trigger=menu.querySelector('summary'),panel=menu.querySelector(':scope>div');
  trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');
  panel.setAttribute('aria-label',trigger.textContent+'选项');
  menu.addEventListener('toggle',()=>{
    trigger.setAttribute('aria-expanded',String(menu.open));if(!menu.open)return;
    for(const other of toolMenus)if(other!==menu)other.open=false;
    const rect=trigger.getBoundingClientRect();
    panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-Math.min(435,innerWidth-16)-8))+'px';
    panel.style.top=Math.min(rect.bottom+6,innerHeight-panel.offsetHeight-8)+'px';
  });
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.format-popup,#font-menu'))formatting.hidden=true;
  if(!e.target.closest('.tool-group')||e.target.closest('[data-insert],[data-style],[data-command]'))closeToolMenus();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(toolMenus.some(menu=>menu.open)||!formatting.hidden)){formatting.hidden=true;closeToolMenus();mf.focus();}});
window.addEventListener('resize',closeToolMenus);window.addEventListener('scroll',e=>{if(!e.target.closest?.('.tool-group'))closeToolMenus();},true);
formatting.addEventListener('pointerdown',e=>e.preventDefault());
$('tools').addEventListener('pointerdown',e=>{if(!customizingToolbar&&e.target.closest('[data-insert],[data-command],[data-style],summary'))e.preventDefault();});
function handleToolClick(e){
  if(e.target.closest('.format-popup')&&inputEditors.dataset.inputMode==='source'){
    const source=$('source');let start=source.selectionStart,end=source.selectionEnd;
    if(start===end){start=0;end=source.value.length;}
    readSource();
    if(state.mode==='latex'&&end>start){
      const button=e.target.closest('[data-style],[data-insert]');
      const commands={'normal:up':'mathrm','normal:bold':'mathbf','double-struck:up':'mathbb','calligraphic:up':'mathcal'};
      const command=commands[button?.dataset.style];
      const template=command?'\\'+command+'{#@}':button?.dataset.insert;
      if(template){source.setRangeText(template.replace('#@',source.value.slice(start,end)),start,end,'select');readSource();return;}
    }
    mf.select();
  }
  if(e.target.closest('[data-insert],[data-command],[data-style]'))setInputPane('visual');
  if(customizingToolbar&&e.target.closest('#primary-tools'))return;
  const font=e.target.closest('[data-style]');
  if(font){
    if(mf.readOnly){status('此语法请在源码区编辑。',true);return;}
    mf.focus();const [variant,variantStyle]=font.dataset.style.split(':');
    mf.applyStyle({variant,variantStyle},{operation:'set'});syncVisual(true);return;
  }
  const action=e.target.closest('[data-command]');
  if(action){
    if(mf.readOnly){status('此语法请在源码区编辑。',true);return;}
    mf.focus();
    const result=mf.executeCommand(action.dataset.command);
    if(result===false)status('请先点击分段公式或矩阵中的单元格，再增删行列。',true);
    syncVisual(true);return;
  }
  const b=e.target.closest('[data-insert]');if(b){
  if(mf.readOnly){status('当前原生 Typst 语法不支持可视化修改，请在源码区编辑。',true);return;}
  let template=b.dataset.insert;
  if(template==='\\sqrt{#?}')template=mf.selectionIsCollapsed?'\\sqrt{#?}':'\\sqrt{#@}';
  if(!mf.selectionIsCollapsed){
    if(template==='#@_{#?}^{#?}')template='_{#@}^{#?}';
    else if(template.startsWith('#@_'))template='_{#@}';
    else if(template.startsWith('#@^'))template='^{#@}';
    else if(template.startsWith('\\int')||template.startsWith('\\sum')||template.startsWith('\\begin{pmatrix}'))template=template.replace('}#?','}#@');
  }
  mf.focus();mf.insert(template,{mode:'math',format:'latex',insertionMode:'replaceSelection',selectionMode:'placeholder',silenceNotifications:false,focus:true});syncVisual(true);
}}
$('tools').addEventListener('click',handleToolClick);
formatting.addEventListener('click',handleToolClick);

document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>loadLatex(examples[b.dataset.example]));
ensureResolutionOption();
for(const key of ['size','padding','scale','color','transparent']){if(key==='transparent')$(key).checked=state[key];else $(key).value=state[key];$(key).addEventListener('change',()=>{settings();if(state.size<10||state.size>160||state.padding<0||state.padding>80){status('字号范围 10–160 pt，留白范围 0–80 px',true);return;}scheduleRender();});}
$('export-selected').onclick=safe(()=>exportFile($('output-format').value));
$('copy-selected').onclick=safe(()=>exportFile($('output-format').value,true));
$('copy-source').onclick=safe(()=>copy($('source').value));$('copy-other').onclick=safe(()=>copy($('other-source').textContent));$('copy-mathml').onclick=safe(()=>copy($('mathml').textContent));
$('remember').onclick=async()=>{await readSource();if(!valid)return;const item={...state,history:undefined};state.history=[item,...state.history.filter(x=>(typeof x==='string'?x:x.rawSource)!==state.rawSource)].slice(0,100);history();persist();status('已收藏当前公式及排版设置');};
$('save-library').onclick=safe(()=>save(new Blob([JSON.stringify({format:'mathforge-library',version:1,history:state.history},null,2)],{type:'application/json'}),'formula-library.json'));
window.FormulaChooseImport=()=>{if(bridge){send('import');return;}const f=document.createElement('input');f.type='file';f.accept='.tex,.typ,.txt,.svg,.mathforge,.json';f.onchange=safe(async()=>{const file=f.files[0];if(file)importContent(await file.text(),file.name.split('.').pop());});f.click();};
$('input-settings').onclick=()=>{$('tool-dialog').showModal();if(bridge)send('scanTools');else{$('tool-paths').textContent='本机路径检测仅在 Mac 应用中可用。';}};
$('close-tools').onclick=()=>{$('tool-dialog').close();};$('scan-tools').onclick=()=>send('scanTools');
for(const [id,key] of [['preamble','preamble'],['typst-preamble','typstPreamble'],['display-mode','displayMode']])$(id).addEventListener('change',()=>{state[key]=$(id).value;persist();readSource();});
$('engine').onchange=safe(async()=>{const engine=$('engine').value;if(engine!=='embedded'&&!bridge){$('engine').value=state.engine;throw new Error('本机排版需要 Mac 应用');}if(engine==='latex'&&state.mode==='typst'){if(!conversionAvailable)throw new Error('此 Typst 语法无法转换为 LaTeX');$('source').value=state.latex;state.mode='latex';}else if(engine==='typst'&&state.mode==='latex'){$('source').value=typst(state.latex);state.mode='typst';}state.engine=engine;applyUI();await readSource();});
for(const kind of ['svg','pdf'])$('batch-'+kind).onclick=safe(async()=>{const lines=$('batch-source').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!lines.length)throw new Error('请输入待导出的公式');if(lines.length>100)throw new Error('每次最多批量导出 100 条');const original={...state};try{for(const line of lines){$('source').value=line;await exportFile(kind);if(!valid)throw new Error('批量导出已停止，请核对公式');}}finally{restore(original);}});
$('preview').title='Mac 应用中按住 Option 拖动，可将公式文件拖到桌面或其他应用';
$('preview').addEventListener('mousedown',safe(async e=>{if(!e.altKey||!bridge||!valid)return;e.preventDefault();if(nativeResult){const kind=nativeResult.svg?'svg':'pdf';send('drag',{name:'equation.'+kind,base64:nativeResult[kind]});}else if(svgResult){send('drag',{name:'equation.svg',base64:await bytesBase64(new Blob([svgText()]))});}}));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='o'){e.preventDefault();window.FormulaChooseImport();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='e'){e.preventDefault();safe(()=>exportFile('svg'))();}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();safe(()=>copy($('source').value))();}});
// Repair language/source mismatches saved by versions before 1.4.1.
try{const alternate=state.mode==='latex'?typst(state.latex):state.latex;if(state.rawSource&&state.rawSource===alternate)state.rawSource=getModeSource();}catch{}
updateOutputFormats();applyUI();history();if(state.rawSource){$('source').value=state.rawSource;readSource();}else loadLatex(state.latex);if(bridge)send('scanTools');
