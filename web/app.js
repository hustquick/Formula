import {mathmlToOMML} from './math-omml.mjs';
import {equationClipboard} from './equation-clipboard.mjs';
import {DocumentLifecycle,documentSignature} from './document-lifecycle.mjs';
import {validateDocumentSetting,documentSettingControls,documentSnapshotSettingKeys,captureDocumentSettings} from './document-settings.mjs';
import {FormulaObject} from './formula-object.mjs';
import {installFormulaProjection} from './formula-projection.mjs';
import {normalizeColorSettings,installColorPickers} from './color-picker.mjs';
import {FormulaHistory} from './formula-history.mjs';
import {isRasterFormat,isVectorFormat,outputScale} from './output-formats.mjs';
import {migrateTypesetting,attachDerivedLanguage,classifyRenderError} from './typesetting.mjs';
import {CommandRegistry,RevisionHistory} from './commands.mjs';
import {applyVisualStructure,selectionStructure} from './editor-transforms.mjs';
import {installSourceIndentation} from './source-indentation.mjs';
import {installSourceSurface} from './source-surface.mjs';
import {installSourceAssist} from './source-assist.mjs';
import {formatLatexSource,formatTypstSource} from './format-latex.mjs';
import {tex2typst, typst2tex} from './source-conversion.mjs';
import {jsPDF} from 'jspdf';
import 'svg2pdf.js';

window.FormulaApplyVisualStructure=applyVisualStructure;
window.FormulaSelectionStructure=selectionStructure;
window.FormulaFormatLatex=formatLatexSource;
window.FormulaFormatGenerated=(text,mode=state.sourceLanguage)=>mode==='typst'?formatTypstSource(text):formatLatexSource(text);
const $ = id => document.getElementById(id);
let outputColors;
let batchSession=null;
const documentLifecycle=new DocumentLifecycle(window.FormulaSavedLifecycle);window.FormulaDocumentLifecycle=documentLifecycle;
const bridge = window.webkit?.messageHandlers?.mathforge;
const examples = {
  heat: String.raw`\mathrm{Nu}=0.023\,\mathrm{Re}^{0.8}\mathrm{Pr}^{0.4}`,
  efficiency: String.raw`\eta=\frac{Q_{\mathrm{useful}}}{Q_{\mathrm{solar}}}`,
  quadratic: String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
  matrix: String.raw`\mathbf{A}=\begin{pmatrix}a&b\\c&d\end{pmatrix}`
};
for(const key of Object.keys(examples))examples[key]=formatLatexSource(examples[key]);
let state = {latex: examples.efficiency, rawSource:'', editorMode:'latex', history:[], size:32, padding:12, color:'#000000', transparent:true, scale:300/96, preamble:String.raw`\usepackage{amsmath,amssymb}
\usepackage{xcolor}`,typstPreamble:'',displayMode:'display'};
try { Object.assign(state, migrateTypesetting(window.FormulaSavedState || JSON.parse(localStorage.getItem('mathforge') || '{}'))); } catch {}
// WKWebView reinjects its launch snapshot on every reload. A font change
// restores the current editor snapshot once instead of that stale launch state.
try{const pending=sessionStorage.getItem('formula-font-reload-state');if(pending){Object.assign(state,migrateTypesetting(JSON.parse(pending)));sessionStorage.removeItem('formula-font-reload-state');}}catch{}
state.history = Array.isArray(state.history) ? state.history.filter(x=>typeof x==='string'||(x&&typeof x.rawSource==='string')).slice(0,100) : [];
state=attachDerivedLanguage(normalizeColorSettings(migrateTypesetting(state)));
// Repair the known pre-1.4.1 swapped-source format before adopting the contract.
if(!state.formulaContent)try{const alternate=state.sourceLanguage==='latex'?typst(state.latex):state.latex;if(state.rawSource&&state.rawSource===alternate)state.rawSource=state.sourceLanguage==='latex'?state.latex:typst(state.latex);}catch{}
let content;
function restoreContent(saved=state){
  const object=saved.formulaObject;
  const cached=saved.formulaContent?.representations?.[state.sourceLanguage]?.text;
  const text=typeof cached==='string'&&stripDelimiters(cached)===stripDelimiters(saved.rawSource||'')?cached:saved.formulaContent?(saved.rawSource??saved.latex??''):(saved.rawSource||saved.latex||'');
  content=new FormulaObject(object??saved.formulaContent,{language:state.sourceLanguage,text,formatting:{...captureDocumentSettings(state),...captureDocumentSettings(saved)},mode:state.editorMode});
  if(object){state.editorMode=content.presentation.mode;Object.assign(state,content.formatting);}
  else if(typeof saved.visualDraft==='string'&&compactVisualLatex(saved.visualDraft.replace(/\\placeholder\{[^}]*\}/g,''))===compactVisualLatex(content.get('latex')?.text??''))content.setVisual(saved.visualDraft);
  state.formulaContent=content.serialize();state.formulaObject=content.snapshot();
}
restoreContent();
installFormulaProjection(state,()=>content,stripDelimiters);

function contentSource(language){return content.resolve(language,authority=>{
  if(language==='latex')return typst2tex(stripDelimiters(authority.text));
  const latex=content.resolve('latex',a=>typst2tex(stripDelimiters(a.text)));
  return formatTypstSource(typst(stripDelimiters(latex)));
});}
function captureContent(){content.identity.documentId=documentLifecycle.id;content.setPresentation(state.editorMode);content.setFormatting(captureDocumentSettings(state));state.formulaContent=content.serialize();state.formulaObject=content.snapshot();return state.formulaContent;}
function formulaSnapshot(){captureContent();return {...state,formulaObject:content.snapshot(),formulaContent:content.serialize(),latex:stripDelimiters(content.get('latex')?.text??''),rawSource:stripDelimiters(content.get(state.sourceLanguage)?.text??content.authority.text),history:[]};}
window.FormulaActiveObject=()=>content.snapshot();
let renderBackendUsed='builtin',localAttemptSource=null;
state.mathFont=window.FormulaMathFont||'newcm';
for(const key of ['sourceZoom','visualZoom'])state[key]=Number.isFinite(state[key])?Math.max(0.5,Math.min(2.5,state[key])):(Number.isFinite(state.editorZoom)?state.editorZoom:1);
let valid = true, updating = false, renderID = 0, renderQueue = Promise.resolve(), svgResult = null, nativeResult=null, sourceTimer, visualTimer, conversionAvailable=true,lastRenderKey='';
const requests=new Map();
function nativeRequest(action,data){return new Promise((resolve,reject)=>{const id=String(Date.now())+'-'+Math.random().toString(36).slice(2);const timer=setTimeout(()=>{requests.delete(id);reject(new Error(action==='render'?'本机排版超时，请查看编译日志':'保存操作超时'));},action==='render'?180000:600000);requests.set(id,{resolve,reject,timer});send(action,{...data,id});});}
window.FormulaNativeReply=(id,result)=>{const req=requests.get(id);if(!req)return;clearTimeout(req.timer);requests.delete(id);if(result.log!==undefined)$('compile-log').textContent=result.log;if(result.error)req.reject(new Error(result.error));else req.resolve(result);};
function status(text, error=false){ $('status').textContent=text; $('status').classList.toggle('error',error); }
function send(action, data={}){ bridge?.postMessage({action,...data}); }
function persist(){if(batchSession)return;if(state.editorMode==='visual'&&typeof mf!=='undefined'){content.setVisual(mf.getValue('latex'));}captureContent(); try{localStorage.setItem('mathforge',JSON.stringify(state));}catch{} send('state',{state,document:documentLifecycle.getStatus(state)}); }
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
function getModeSource(){return contentSource(state.sourceLanguage);}
function invalidate(message){
  persist();
  const src=stripDelimiters($('source').value),category=classifyRenderError(message,src,state.sourceLanguage,renderBackendUsed);
  const feedback=$('render-feedback');feedback.replaceChildren();feedback.dataset.category=category;feedback.hidden=false;
  const feedbackText=document.createElement('span');feedbackText.textContent=message;feedback.append(feedbackText);
  if(category==='capability'){const label=state.sourceLanguage==='typst'?'Typst':'LaTeX';feedbackText.textContent='当前内容无法由内置引擎完成，可尝试本机 '+label+' 环境。';const retry=document.createElement('button');retry.textContent='尝试本机 '+label;retry.onclick=()=>window.FormulaCommands.execute('tryLocalTypesetting');feedback.append(retry);}
  if(category==='environment'||category==='local-failure'){const configure=document.createElement('button');configure.textContent='配置本机环境';configure.onclick=()=>window.FormulaCommands.execute('settings');feedback.append(configure);const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>readSource();feedback.append(retry);}

  valid=false;svgResult=null;nativeResult=null;$('source').classList.toggle('invalid',renderBackendUsed==='builtin');if($('preview').querySelector('svg,.preview-image')){$('preview').dataset.stale='true';$('dimensions').textContent='上一有效结果 · 当前输入未完成';status(message,true);return;}$('preview').replaceChildren();$('dimensions').textContent='排版失败';
  const box=document.createElement('div');box.className='render-error';const text=document.createElement('p');text.textContent=message;box.append(text);
  if(renderBackendUsed!=='builtin'){const log=document.createElement('button');log.textContent='查看完整编译日志';log.onclick=()=>{$('tool-dialog').showModal();$('compile-log').parentElement.open=true;$('compile-log').scrollIntoView({block:'nearest'});};const copyLog=document.createElement('button');copyLog.textContent='复制日志';copyLog.onclick=safe(()=>copy($('compile-log').textContent));const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>readSource();box.append(log,copyLog,retry);}
  $('preview').append(box);status(message,true);
}
function updateAlternates(){
  window.FormulaSourceSurface?.refresh();
  $('other-label').textContent=state.sourceLanguage==='latex'?'Typst':'LaTeX';
  try{$('other-source').textContent=conversionAvailable?(contentSource(state.sourceLanguage==='latex'?'typst':'latex')):'本机可排版；此语法暂不支持转换为另一种源码。';}catch(e){$('other-source').textContent='此公式暂不支持转换为 Typst：'+e.message;}
  try{$('mathml').textContent=conversionAvailable?content.cache('mathml',mf.getValue('math-ml'),'MathLive@0.111.1'):'此语法暂不支持 MathML 转换。';}catch{$('mathml').textContent='当前编辑结构尚未完成。';}
}
function updateMode(){
  for(const [id,mode] of [['input-visual','visual'],['mode-latex','latex'],['mode-typst','typst']]){const button=$(id),selected=state.editorMode===mode;button.classList.toggle('active',selected);button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;}
  document.querySelector('.input-editors').dataset.inputMode=state.editorMode==='visual'?'visual':'source';
  $('source-hint').textContent=state.sourceLanguage==='typst'?'Typst 数学模式，可粘贴 $…$；不支持整篇文档或自定义函数':'可粘贴带 $…$ 或 \\[ … \\] 的公式';
  $('source').setAttribute('aria-label',state.sourceLanguage+' 公式源码');
}

function scheduleRender(){
  captureContent();
  renderBackendUsed=localAttemptSource===state.sourceLanguage+':'+state.rawSource?'local':'builtin';
  const key=JSON.stringify({formulaId:content.identity.formulaId,revision:content.objectRevision,latex:state.latex,rawSource:state.rawSource,editorMode:state.editorMode,backend:renderBackendUsed,size:state.size,padding:state.padding,color:state.color,backgroundColor:state.backgroundColor,transparent:state.transparent,scale:state.scale,preamble:state.preamble,typstPreamble:state.typstPreamble,displayMode:state.displayMode});
  if(key===lastRenderKey&&valid&&(svgResult||nativeResult))return renderQueue;
  const id=++renderID, latex=state.latex, opts={...state,sourceLanguage:state.sourceLanguage,backend:renderBackendUsed,persisted:formulaSnapshot(),objectRevision:content.objectRevision};
  svgResult=null;nativeResult=null;
  renderQueue=renderQueue.catch(()=>{}).then(async()=>{
    if(id!==renderID||opts.objectRevision!==content.objectRevision)return;
    if(opts.backend!=='builtin'){
      if(!bridge)throw new Error('本机引擎需要在 Formula Mac 应用中使用');
      status('正在调用本机 '+(opts.sourceLanguage==='typst'?'Typst':'LaTeX')+'…');
      const result=await nativeRequest('render',{engine:opts.sourceLanguage,source:opts.rawSource,document:opts.persisted,options:{size:opts.size,padding:opts.padding,color:opts.color,backgroundColor:opts.backgroundColor,transparent:opts.transparent,scale:1,preamble:opts.preamble,typstPreamble:opts.typstPreamble,displayMode:opts.displayMode}});
      if(id!==renderID||opts.objectRevision!==content.objectRevision)return;
      $('render-feedback').hidden=true;delete $('preview').dataset.stale;nativeResult=result;content.cache('native',result,'native-host');lastRenderKey=key;valid=true;$('source').classList.remove('invalid');
      const img=new Image();img.className='preview-image';img.style.width=(result.width/1)+'px';img.style.height=(result.height/1)+'px';img.src='data:image/png;base64,'+result.png;$('preview').replaceChildren(img);
      $('dimensions').textContent=`${result.width} × ${result.height} px`;
      applyUI();status('本机排版完成 · '+result.engine);persist();return;
    }
    await MathJax.startup.promise;
    const container=await MathJax.tex2svgPromise(latex,{display:opts.displayMode!=='inline'});
    if(id!==renderID||opts.objectRevision!==content.objectRevision)return;
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
    if(!opts.transparent){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');Object.entries({x:vb[0]-pad,y:vb[1]-pad,width:vb[2]+2*pad,height:vb[3]+2*pad,fill:opts.backgroundColor}).forEach(([k,v])=>rect.setAttribute(k,String(v)));svg.prepend(rect);}
    const meta=document.createElementNS('http://www.w3.org/2000/svg','metadata');meta.textContent=JSON.stringify({generator:'Formula',latex,format:'mathforge-equation',version:1,state:{...opts.persisted,history:[]}});svg.prepend(meta);
    svgResult={svg,width,height,revision:content.objectRevision};content.cache('svg',new XMLSerializer().serializeToString(svg),'MathJax');lastRenderKey=key;valid=true;$('source').classList.remove('invalid');
    $('preview').replaceChildren(svg.cloneNode(true));$('dimensions').textContent=`${Math.ceil(width)} × ${Math.ceil(height)} px`;
    $('render-feedback').hidden=true;delete $('preview').dataset.stale;applyUI();status(state.sourceLanguage==='typst'?'Typst 已转换并同步；请核对预览':'已同步 · 可导出');persist();
  }).catch(e=>{if(id===renderID)invalidate(e.message);});
  return renderQueue;
}
function readSource(){
  clearTimeout(sourceTimer);clearTimeout(visualTimer);
  try {
    const src=stripDelimiters($('source').value);
    content.edit(state.sourceLanguage,$('source').value);
    renderBackendUsed=localAttemptSource===state.sourceLanguage+':'+src?'local':'builtin';
    $('render-feedback').hidden=true;applyUI();
    if(!src)throw new Error('请输入公式');
    if(!(renderBackendUsed==='local'&&state.sourceLanguage==='typst')&&state.sourceLanguage==='typst' && /#|\b(?:set|show|let|import|include)\b/.test(src))throw new Error('内置模式只支持 Typst 数学公式；文档指令或自定义函数请使用本机 Typst');
    let latex;
    try{latex=content.validation==='parsed'&&content.get('latex')?stripDelimiters(content.get('latex').text):state.sourceLanguage==='typst'?typst2tex(src):src;content.parsed(latex);conversionAvailable=true;mf.readOnly=false;}
    catch(e){if(!(renderBackendUsed==='local'&&state.sourceLanguage==='typst'))throw e;conversionAvailable=false;mf.readOnly=true;latex='';}
    // Re-rendering an unchanged visual formula must not rebuild its tree: that
    // would erase placeholders and reset the user's structural selection.
    if(state.editorMode!=='visual'||compactVisualLatex(mf.getValue('latex-without-placeholders'))!==compactVisualLatex(latex)){updating=true;mf.setValue(latex,{silenceNotifications:true});updating=false;}
    valid=true;updateAlternates();return scheduleRender();
  }catch(e){updating=false;++renderID;invalidate(e.message);return Promise.resolve();}
}
async function switchMode(mode){
  if(mode===state.sourceLanguage)return;
  // Keep the canonical LaTeX when the generated alternate source is untouched.
  // Only parse again after an actual source edit, avoiding lossy round trips.
  if(!content.matches(state.sourceLanguage,$('source').value)){await readSource();if(!valid)return;}
  if(!valid){status('请先修正当前源码，原内容已保留。',true);return;}
  if(!conversionAvailable){status('此语法暂不支持转换为另一种源码。',true);return;}
  try{const next=contentSource(mode);state.sourceLanguage=mode;$('source').value=next;applyUI();updateAlternates();persist();scheduleRender();}
  catch(e){persist();status('无法切换：'+e.message,true);}
}
function loadLatex(latex){latex=formatLatexSource(latex);content.edit('latex',latex,'generated');content.parsed(latex);conversionAvailable=true;mf.readOnly=false;updating=true;mf.setValue(latex,{silenceNotifications:true});updating=false;try{$('source').value=window.FormulaFormatGenerated(getModeSource());}catch{state.sourceLanguage='latex';$('source').value=latex;}updateMode();updateAlternates();scheduleRender();}
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
  if(bridge){status('请选择保存位置');const result=await nativeRequest('save',{name,base64:await bytesBase64(blob)});status(result.cancelled?'已取消保存':'已保存 '+name);return result;}
  else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('已导出 '+name);return {cancelled:false};}
}
async function copy(text, format='text'){
  if(bridge){send('copy',{text,format,formulaId:content.identity.formulaId,revision:content.objectRevision,sourceRevision:content.revision});status('已复制');return;}
  try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();if(!document.execCommand('copy'))throw new Error('复制失败，请手动选择源码复制');ta.remove();}status('已复制');
}
async function copyEquation(editableOnly=false){
  if(!content.matches(state.sourceLanguage,$('source').value))await readSource();else await scheduleRender();
  if(!valid||!conversionAvailable)throw Error('当前公式无法转换为可编辑数学表示；可显式复制源码或图片。');
  const latex=stripDelimiters(contentSource('latex')),raw=content.cached('mathml');
  if(typeof raw!=='string')throw Error('当前公式没有可用的 MathML 表示');
  const doc=new DOMParser().parseFromString(raw.trim().startsWith('<math')?raw:'<math xmlns="http://www.w3.org/1998/Math/MathML">'+raw+'</math>','application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='math')throw Error('当前 MathML 表示无效');
  const math=doc.documentElement;math.setAttribute('xmlns','http://www.w3.org/1998/Math/MathML');math.setAttribute('display',state.displayMode==='inline'?'inline':'block');math.setAttribute('mathsize',state.size+'pt');math.setAttribute('mathcolor',state.color);
  const mathml=new XMLSerializer().serializeToString(math),object=content.snapshot(),graphics={};
  if(!editableOnly){
    if(nativeResult){for(const key of ['svg','pdf','png'])if(nativeResult[key])graphics[key]=nativeResult[key];}
    else if(svgResult){graphics.svg=await bytesBase64(new Blob([svgText()]));try{graphics.png=await bytesBase64(await rasterBlob('png'));}catch{}
      const {width,height,svg}=svgResult,w=width*.75,h=height*.75,pdf=new jsPDF({orientation:w>h?'landscape':'portrait',unit:'pt',format:[w,h]});
      pdf.setProperties({subject:'MathForge:'+JSON.stringify({format:'mathforge-equation',version:1,state:formulaSnapshot()})});await pdf.svg(svg.cloneNode(true),{x:0,y:0,width:w,height:h});graphics.pdf=await bytesBase64(pdf.output('blob'));
    }
  }
  if(object.identity.formulaId!==content.identity.formulaId||object.revision!==content.objectRevision)throw Error('公式已变化，请重新复制');
  let omml,gvml;
  try{
    if(bridge&&window.FormulaSourceEquationSupported){
      const converted=await nativeRequest('prepareEquation',{latex,formulaId:object.identity.formulaId,revision:object.revision});
      if(converted.latex!==latex||typeof converted.omml!=='string')throw Error('转换结果与当前源码不匹配');
      omml=converted.omml;
      if(typeof converted.gvml!=='string')throw Error('缺少演示/表格原生公式载荷');
      gvml=converted.gvml;
    }else omml=mathmlToOMML(mathml);
  }catch(error){throw Error('原生公式复制失败：'+error.message+'；原剪贴板已保留，可显式复制其他格式。');}
  if(object.identity.formulaId!==content.identity.formulaId||object.revision!==content.objectRevision||!content.matches(state.sourceLanguage,$('source').value))throw Error('公式已变化，请重新复制');
  const payload=equationClipboard(object,{latex,mathml,graphics,editableOnly});
  payload.omml=omml;
  if(gvml)payload.gvml=gvml;
  payload.typst=contentSource('typst');
  if(bridge){send('copyEquation',payload);status(editableOnly?'已复制数学表示 · 是否转换为公式取决于目标应用':'已智能复制 · 数学表示及图形备用');return;}
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined')await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([payload.text],{type:'text/plain'}),'text/html':new Blob([payload.html],{type:'text/html'})})]);else await copy(payload.text);
  status('已复制数学文本 · 浏览器剪贴板格式受限');
}
async function exportFile(kind,copying=false){
  const deliver=async(blob,name)=>{
    if(!copying)return save(blob,name);
    if(['latex','typst','mathml','project'].includes(kind))return copy(await blob.text());
    if(bridge){const payload={formulaId:content.identity.formulaId,revision:content.objectRevision,[kind]:await bytesBase64(blob),equation:JSON.stringify({format:'mathforge-equation',version:1,state:formulaSnapshot()})};if(kind!=='png'){if(nativeResult?.png)payload.png=nativeResult.png;else if(svgResult){try{payload.png=await bytesBase64(await rasterBlob('png'));}catch{}}}send('copyImage',payload);status('已复制 '+$('output-format').selectedOptions[0].textContent);return;}
    if(!navigator.clipboard?.write||!ClipboardItem.supports(blob.type))throw new Error('此格式的复制需要本机应用');
    await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);status('已复制');
  };
  // Output is read-only for an unchanged representation; reparsing generated
  // Typst here would overwrite the original LaTeX cache with a lossy round trip.
  if(!valid||!content.matches(state.sourceLanguage,$('source').value))await readSource();
  else await scheduleRender();
  await renderQueue;
  if(kind==='project'){return deliver(new Blob([JSON.stringify({format:'mathforge-equation',version:1,state:formulaSnapshot()},null,2)],{type:'application/json'}),'equation.mathforge');}
  if(!valid)throw new Error('请先修正公式再导出');
  if(['latex','typst','mathml'].includes(kind)){if(!conversionAvailable)throw new Error('此语法暂不支持跨格式转换，可保存为可恢复公式文件');const txt=['latex','typst'].includes(kind)?stripDelimiters(contentSource(kind)):content.cached('mathml');return deliver(new Blob([kind==='typst'?'$ '+txt+' $':txt],{type:'text/plain;charset=utf-8'}),'equation.'+({latex:'tex',typst:'typ',mathml:'mml'}[kind]));}
  if(renderBackendUsed!=='builtin'){
    if(isRasterFormat(kind))nativeResult=await nativeRequest('render',{engine:state.sourceLanguage,source:state.rawSource,document:formulaSnapshot(),options:{size:state.size,padding:state.padding,color:state.color,backgroundColor:state.backgroundColor,transparent:state.transparent,scale:outputScale(kind,state.scale),preamble:state.preamble,typstPreamble:state.typstPreamble,displayMode:state.displayMode}});
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
    pdf.setProperties({title:'Formula equation',subject:'MathForge:'+JSON.stringify({format:'mathforge-equation',version:1,state:formulaSnapshot()})});
    await pdf.svg(svg.cloneNode(true),{x:0,y:0,width:w,height:h});return deliver(pdf.output('blob'),'equation.pdf');
  }
  return deliver(await rasterBlob(kind),'equation.'+(kind==='jpeg'?'jpg':'png'));
}
async function rasterBlob(kind='png'){
  const {width,height}=svgResult;
  const scale=Number(state.scale),w=Math.ceil(width*scale),h=Math.ceil(height*scale);
  if(w*h>50000000||w>16000||h>16000)throw new Error('PNG 尺寸过大，请降低字号或清晰度');
  const url=URL.createObjectURL(new Blob([svgText()],{type:'image/svg+xml'}));
  try{const img=new Image();img.src=url;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片渲染失败'));});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(kind==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}ctx.drawImage(img,0,0,w,h);const mime=kind==='jpeg'?'image/jpeg':'image/png';const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,.96));if(!blob)throw new Error('图片导出失败');return kind==='png'?await pngWithDPI(blob,scale*96):blob;}finally{URL.revokeObjectURL(url);}
}
function history(){
  $('history').replaceChildren();state.history.forEach((item,i)=>{const text=typeof item==='string'?item:item.rawSource;const wrap=document.createElement('div');wrap.className='history-item';const b=document.createElement('button');b.className='favorite-preview';b.textContent=text;b.title=text;b.setAttribute('aria-label',text);b.onclick=()=>window.FormulaCommands.execute('restoreFavorite',{index:i});
    const latex=typeof item==='string'?item:item.latex;
    if(latex)Promise.resolve(MathJax.startup.promise).then(()=>MathJax.tex2svgPromise(latex,{display:true})).then(node=>{if(!b.isConnected)return;const svg=node.querySelector('svg');if(svg){svg.removeAttribute('width');svg.removeAttribute('height');b.replaceChildren(svg);}}).catch(()=>{});
const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','删除收藏');del.onclick=()=>window.FormulaCommands.execute('removeFavorite',{index:i});wrap.append(b,del);$('history').append(wrap);});
}
function updateResolution(){const raster=isRasterFormat($('output-format').value);$('scale').disabled=!raster;$('scale').closest('label').classList.toggle('resolution-disabled',!raster);$('scale').title=raster?'位图输出分辨率':'矢量或源码格式不受分辨率设置影响';}
$('output-format').addEventListener('change',updateResolution);
function updateOutputFormats(){
  if(window.FormulaCommands)updateCommandState();
  const selected=$('output-format').value;
  const formats=[['svg','SVG'],['pdf','PDF'],['png','PNG'],['jpeg','JPEG'],['tiff','TIFF'],['eps','EPS'],['latex','LaTeX 源码'],['typst','Typst 源码'],['mathml','MathML'],['project','MathForge']];
  // Engine capabilities do not depend on a transient compile result or source conversion.
  const available=formats.filter(([kind])=>{
    if(['project','latex','typst','mathml'].includes(kind))return true;
    if(renderBackendUsed==='builtin')return !['tiff','eps'].includes(kind);
    if(kind==='eps')return !!detectedTools.pdftops?.path;
    if(kind==='svg')return state.sourceLanguage==='typst'||!!detectedTools.dvisvgm?.path;
    return true;
  });
  const signature=available.map(([kind])=>kind).join(',');
  if($('output-format').dataset.formats===signature){updateResolution();return;}
  $('output-format').dataset.formats=signature;
  $('output-format').replaceChildren(...available.map(([kind,label])=>new Option(label,kind)));
  if(available.some(([kind])=>kind===selected))$('output-format').value=selected;updateResolution();
}

function applyUI(){updateOutputFormats();$('math-font').value=state.mathFont;$('math-font').disabled=renderBackendUsed!=='builtin';ensureResolutionOption();for(const key of ['size','padding','scale','color','backgroundColor']){$(key).value=state[key];}outputColors?.refresh();$('preamble').value=state.preamble;$('typst-preamble').value=state.typstPreamble;$('display-mode').value=state.displayMode;$('engine-note').textContent=(state.sourceLanguage==='typst'?'Typst':'LaTeX')+' · '+(renderBackendUsed==='builtin'?'内置':'本机');updateMode();}
async function restore(saved){
  const previousFont=state.mathFont;
  saved=normalizeColorSettings(migrateTypesetting(saved));localAttemptSource=null;renderBackendUsed='builtin';const keepHistory=state.history;for(const k of ['editorMode',...documentSnapshotSettingKeys])if(saved[k]!==undefined)state[k]=saved[k];state.history=keepHistory;restoreContent(saved);
  const visualDraft=content.cached('visual');
  applyUI();$('source').value=content.get(state.sourceLanguage)?.text??state.rawSource;
  await readSource();
  if(state.editorMode==='visual'&&typeof visualDraft==='string'){
    updating=true;mf.setValue(visualDraft,{silenceNotifications:true});updating=false;persist();
  }
  if(state.mathFont!==previousFont)return applyMathFont(state.mathFont);
}
function importContent(text,ext,metadata){
  if(['mathforge','json'].includes(ext)){const data=JSON.parse(text);if(data.format==='mathforge-library')return registry.execute('importFavoriteLibrary',{history:data.history});if(data.format!=='mathforge-equation')throw new Error('无法识别的公式文件');return restore(data.state);}
  if(ext==='svg'){const meta=new DOMParser().parseFromString(text,'image/svg+xml').querySelector('metadata');if(!meta)throw new Error('SVG 中没有可恢复源码');const data=JSON.parse(meta.textContent);if(data.state)return restore(data.state);return loadLatex(data.latex);}
  if(ext==='tex'&&text.includes('\\begin{document}')){const body=text.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);if(!body)throw new Error('LaTeX 文档不完整');state.preamble=text.split('\\begin{document}')[0].replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/,'').trim();text=body[1];}
  state.sourceLanguage=ext==='typ'?'typst':'latex';content.edit(state.sourceLanguage,text,metadata?'ocr':'import',metadata);$('source').value=text;applyUI();readSource();
}
let detectedTools={};
window.FormulaTools=tools=>{detectedTools=tools;updateOutputFormats();$('tool-paths').replaceChildren();for(const [key,label] of Object.entries({latex:'LaTeX',typst:'Typst',dvisvgm:'dvisvgm',pdftops:'pdftops'})){const row=document.createElement('div');row.className='tool-row';const name=document.createElement('span');name.textContent=label;const path=document.createElement('code');path.textContent=tools[key]?.path||'未检测到';const version=document.createElement('small');version.textContent=tools[key]?.version||'';path.append(version);const button=document.createElement('button');button.textContent='指定路径';button.onclick=()=>window.FormulaCommands.execute('chooseLocalTool',{tool:key});row.append(name,path,button);$('tool-paths').append(row);}};
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){status(e.message,true);}};
window.FormulaNativeResult=(message,error=false)=>status(message,error);
window.FormulaImport=(text,ext)=>safe(()=>importContent(text,ext))();
window.FormulaAction=kind=>safe(async()=>{if(kind==='copy')await copy($('source').value);else if(kind==='import')window.FormulaChooseImport();else await exportFile(kind);})();
window.FormulaTest={pngWithDPI,compactVisualLatex,exportFile,readSource,stripDelimiters,getState:()=>{captureContent();return state;},getSVG:()=>svgResult?svgText():null};

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
  if(updating||mf.readOnly||mf.mode==='latex'||(!force&&document.querySelector('.input-editors').dataset.inputMode!=='visual'))return;
  try{
    const latex=compactVisualLatex(mf.getValue('latex-without-placeholders'));
    if(latex===compactVisualLatex(state.latex)){content.setVisual(mf.getValue('latex'));return;}
    clearTimeout(sourceTimer);clearTimeout(visualTimer);content.edit('latex',formatLatexSource(latex),'visual');content.parsed(latex);conversionAvailable=true;
    try{$('source').value=window.FormulaFormatGenerated(getModeSource());}catch{state.sourceLanguage='latex';$('source').value=formatLatexSource(latex);applyUI();}
    updateAlternates();persist();window.FormulaRecordVisual?.();
    ++renderID;svgResult=null;nativeResult=null;
    if(!state.rawSource){$('preview').replaceChildren();$('dimensions').textContent='等待输入';status('请输入公式');return;}
    status('源码已同步 · 正在准备预览…');
    visualTimer=setTimeout(scheduleRender,renderBackendUsed==='builtin'?100:650);
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
$('source').addEventListener('input',()=>{if(!batchSession){content.edit(state.sourceLanguage,$('source').value);persist();}localAttemptSource=null;renderBackendUsed='builtin';clearTimeout(sourceTimer);svgResult=null;nativeResult=null;sourceTimer=setTimeout(readSource,renderBackendUsed==='builtin'?220:650);});
$('mode-latex').onclick=()=>changeEditorMode('latex');$('mode-typst').onclick=()=>changeEditorMode('typst');
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
function applyToolbarDisplay(){toolbar.dataset.display=toolbarDisplay;for(const input of $('toolbar-display').querySelectorAll('input'))input.checked=input.value===toolbarDisplay;}
function applyUIMode(mode){
  const display={icon:'icons',text:'text',icontext:'both'}[mode];
  if(!display)return;
  toolbarDisplay=display;localStorage.setItem('formula-toolbar-display',toolbarDisplay);applyToolbarDisplay();
}
window.setUIMode=mode=>window.FormulaCommands.execute('setToolbarDisplay',{mode});
$('toolbar-display').onchange=e=>window.setUIMode({icons:'icon',text:'text',both:'icontext'}[e.target.value]);applyToolbarDisplay();
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
    input.onchange=()=>window.FormulaCommands.execute('setToolbarItem',{id:entry.id,selected:input.checked});
    label.append(input,toolIcon(entry.label),document.createTextNode(entry.label));$('toolbar-options').append(label);
  }
}
let acceptedToolbar=[...toolbarLayout];
function saveToolbar(){
  renderToolbar();
  const previousDisplay=toolbar.dataset.display;toolbar.dataset.display='both';
  const rows=new Set([...primaryToolbar.children].map(button=>Math.round(button.offsetTop)));
  toolbar.dataset.display=previousDisplay;
  if(rows.size>2){toolbarLayout=[...acceptedToolbar];renderToolbar();status('自定义工具最多两行，请先移除部分工具。',true);return;}
  acceptedToolbar=[...toolbarLayout];
  localStorage.setItem('formula-toolbar-layout-v2',JSON.stringify(toolbarLayout.map(id=>catalog.find(entry=>entry.id===id).key)));renderToolbar();}
$('customize-toolbar').onclick=()=>{customizingToolbar=!customizingToolbar;renderToolbar();};
function closeToolbarCustomization(){
  if(!customizingToolbar)return;
  customizingToolbar=false;draggedTool=null;renderToolbar();
}
document.addEventListener('pointerdown',e=>{
  if(customizingToolbar&&!e.target.closest('#toolbar-options,#toolbar-remove,#primary-tools,.toolbar-customize'))closeToolbarCustomization();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&customizingToolbar){e.preventDefault();closeToolbarCustomization();$('customize-toolbar').focus();}
});

$('reset-toolbar').onclick=()=>window.FormulaCommands.execute('resetToolbar');
function startToolDrag(e){const button=e.target.closest('[data-tool-id]');if(!customizingToolbar||!button)return;draggedTool=button.dataset.toolId;e.dataTransfer.setData('text/plain',draggedTool);e.dataTransfer.effectAllowed='move';}
primaryToolbar.addEventListener('dragstart',startToolDrag);$('toolbar-options').addEventListener('dragstart',startToolDrag);
primaryToolbar.addEventListener('dragover',e=>{if(customizingToolbar)e.preventDefault();});
primaryToolbar.addEventListener('drop',e=>{
  if(!customizingToolbar)return;e.preventDefault();const target=e.target.closest('[data-tool-id]');
  if(!draggedTool||(target&&draggedTool===target.dataset.toolId))return;
  window.FormulaCommands.execute('moveToolbarItem',{id:draggedTool,target:target?.dataset.toolId});draggedTool=null;
});
primaryToolbar.addEventListener('dragend',()=>{draggedTool=null;});
$('toolbar-remove').addEventListener('dragover',e=>{if(customizingToolbar)e.preventDefault();});
$('toolbar-remove').addEventListener('drop',e=>{if(!customizingToolbar||!draggedTool)return;e.preventDefault();window.FormulaCommands.execute('setToolbarItem',{id:draggedTool,selected:false});draggedTool=null;});renderToolbar();

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
function setInputPane(mode){if(mode==='visual')state.editorMode='visual';else if(state.editorMode==='visual')state.editorMode='latex';updateMode();}
// Restore the editable visual tree (including unfinished placeholders) once.
if(state.editorMode==='visual'&&typeof content.cached('visual')==='string'){
  updating=true;mf.setValue(content.cached('visual'),{silenceNotifications:true});updating=false;
}
const originalFocus=mf.focus.bind(mf);mf.focus=(...args)=>{if(window.FormulaRevisions?.busy)window.FormulaRevisions.editorFocus='visual';setInputPane('visual');if(document.activeElement!==mf)mf.blur();originalFocus(...args);mf.shadowRoot?.querySelector('[part=keyboard-sink]')?.focus({preventScroll:true});};
$('math-font').value=state.mathFont;
let fontSwitchID=0;
async function applyMathFont(requested,record=false){
  if(record)return editTransaction('修改公式字体',()=>requested===state.mathFont?undefined:applyMathFont(requested,false));
  const id=++fontSwitchID;
  try{
    await MathJax.startup.promise;
    await MathJax.loader.load('[fonts]/mathjax-'+requested+'-font/svg');
    if(id!==fontSwitchID)return;
    const classes=MathJax._.output.fonts['mathjax-'+requested].svg_ts;
    const Font=Object.values(classes).find(value=>typeof value==='function');
    const jax=MathJax.startup.document.outputJax;
    jax.font=new Font({dynamicPrefix:'[fonts]/mathjax-'+requested+'-font/svg/dynamic'});
    jax.clearFontCache();
    const commit=()=>{state.mathFont=requested;window.FormulaMathFont=requested;localStorage.setItem('formula-math-font',requested);persist();};
    commit();
    lastRenderKey='';if(!content.matches(state.sourceLanguage,$('source').value))await readSource();else await scheduleRender();
  }catch(e){$('math-font').value=state.mathFont;throw new Error('字体切换失败：'+e.message);}
}
function applyEditorZoom(){document.querySelector('.input-editors').style.setProperty('--editor-source-size',(16*state.sourceZoom)+'px');document.querySelector('.input-editors').style.setProperty('--editor-visual-size',(28*state.visualZoom)+'px');window.FormulaSourceSurface?.refresh();}
applyEditorZoom();


for(const [id,step] of [['input-size-down',-2],['input-size-up',2]])$(id).onclick=()=>{const value=Number($('size').value);$('size').value=Math.max(10,Math.min(160,(Number.isFinite(value)?value:state.size)+step));$('size').dispatchEvent(new Event('change'));};
document.querySelector('.tool-deck').prepend(document.querySelector('.examples'));
// UI context is separate from content/revision state: restoring it never mutates math.
function captureEditorContext(){
  const source=$('source'),visual=document.querySelector('.visual-pane'),preview=$('preview');
  return {mode:state.editorMode,text:source.value,focus:document.activeElement===preview?'preview':state.editorMode==='visual'?'visual':'source',
    selection:[source.selectionStart,source.selectionEnd],visualSelection:JSON.parse(JSON.stringify(mf.selection)),
    sourceScroll:[source.scrollLeft,source.scrollTop],visualScroll:[visual.scrollLeft,visual.scrollTop],previewScroll:[preview.scrollLeft,preview.scrollTop],pageScroll:[scrollX,scrollY]};
}
function restoreEditorContext(context){
  if(!context)return;
  if(context.mode!==state.editorMode||context.text!==$('source').value){if(state.editorMode==='visual')mf.focus();else $('source').focus({preventScroll:true});return;}
  const source=$('source'),visual=document.querySelector('.visual-pane'),preview=$('preview');
  if(context.focus==='preview')preview.focus({preventScroll:true});
  else if(context.focus==='visual'){mf.focus({preventScroll:true});try{mf.selection=context.visualSelection;}catch{}}
  else{source.focus({preventScroll:true});source.setSelectionRange(...context.selection);}
  for(const [node,position] of [[source,context.sourceScroll],[visual,context.visualScroll],[preview,context.previewScroll]]){node.scrollLeft=position[0];node.scrollTop=position[1];}
  window.scrollTo(...context.pageScroll);
}
// Pointer activation of a shelf tab is navigation, not a request to move the caret.
document.querySelector('.input-tabs').addEventListener('pointerdown',event=>{if(event.target.closest('button')&&!event.target.closest('button').disabled)event.preventDefault();});
let toolContext=null;
$('font-menu').addEventListener('pointerdown',()=>{toolContext=captureEditorContext();});
let currentTab='quick';
function selectToolTab(tab){currentTab=tab;document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));toolbar.dataset.tab=tab;document.querySelector('.tool-deck').dataset.activeTab=tab;document.querySelector('.toolbar-customize').hidden=tab!=='custom';document.querySelector('.examples').hidden=tab!=='templates';$('history').hidden=tab!=='favorites';if(tab==='templates')document.querySelector('.tool-deck').prepend(document.querySelector('.examples'));if(tab==='favorites')document.querySelector('.tool-deck').prepend($('history'));}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>selectToolTab(button.dataset.tab));selectToolTab('quick');document.querySelector('.preview-card>.section-head').append($('remember'));
const toolMenus=[...toolbar.querySelectorAll('.tool-group')];
function closeToolMenus(){for(const menu of toolMenus)menu.open=false;}
for(const menu of toolMenus){
  const trigger=menu.querySelector('summary'),panel=menu.querySelector(':scope>div');
  trigger.addEventListener('pointerdown',()=>{toolContext=captureEditorContext();});
  trigger.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))toolContext=captureEditorContext();});
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
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(toolMenus.some(menu=>menu.open)||!formatting.hidden)){formatting.hidden=true;closeToolMenus();restoreEditorContext(toolContext);toolContext=null;}});
window.addEventListener('resize',closeToolMenus);window.addEventListener('scroll',e=>{if(!e.target.closest?.('.tool-group'))closeToolMenus();},true);
formatting.addEventListener('pointerdown',e=>e.preventDefault());
$('tools').addEventListener('pointerdown',e=>{if(!customizingToolbar&&e.target.closest('[data-insert],[data-command],[data-style],summary'))e.preventDefault();});
function handleToolClick(e){
  const undoButton=e.target.closest('[data-command="undo"],[data-command="redo"]');if(undoButton&&window.FormulaCommands){window.FormulaCommands.execute(undoButton.dataset.command);return;}
  const sourceButton=e.target.closest('[data-insert],[data-style]');
  if(sourceButton&&inputEditors.dataset.inputMode==='source'&&state.sourceLanguage==='latex'){
    const source=$('source'),start=source.selectionStart,end=source.selectionEnd;
    const commands={'normal:up':'mathrm','normal:bold':'mathbf','double-struck:up':'mathbb','calligraphic:up':'mathcal'};
    const command=commands[sourceButton.dataset.style];
    const template=command?'\\'+command+'{#@}':sourceButton.dataset.insert;
    if(template&&window.FormulaCommands){window.FormulaCommands.execute('insertStructure',{template});return;}
  }
  if(e.target.closest('[data-insert],[data-command],[data-style]'))setInputPane('visual');
  if(customizingToolbar&&e.target.closest('#primary-tools'))return;
  const font=e.target.closest('[data-style]');
  if(font){
    if(mf.readOnly){status('此语法请在源码区编辑。',true);return;}
    const [variant,variantStyle]=font.dataset.style.split(':');if(window.FormulaCommands){window.FormulaCommands.execute('applyStyle',{variant,variantStyle});return;}mf.focus();
    mf.applyStyle({variant,variantStyle},{operation:'set'});syncVisual(true);return;
  }
  const action=e.target.closest('[data-command]');
  if(action){
    if(mf.readOnly){status('此语法请在源码区编辑。',true);return;}
    mf.focus();
    if(['undo','redo'].includes(action.dataset.command)){window.FormulaCommands?.execute(action.dataset.command);return;}
    if(window.FormulaExecuteMatrixCommand){window.FormulaExecuteMatrixCommand(action.dataset.command);return;}
    const result=mf.executeCommand(action.dataset.command);
    if(result===false)status('请先点击分段公式或矩阵中的单元格，再增删行列。',true);
    syncVisual(true);return;
  }
  const b=e.target.closest('[data-insert]');if(b){
  if(mf.readOnly){status('当前原生 Typst 语法不支持可视化修改，请在源码区编辑。',true);return;}
  window.FormulaApplyVisualStructure(mf,b.dataset.insert);syncVisual(true);
}}
$('tools').addEventListener('click',handleToolClick);
formatting.addEventListener('click',handleToolClick);

document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>loadLatex(examples[b.dataset.example]));
ensureResolutionOption();
outputColors=installColorPickers();
for(const key of ['size','padding','scale','color','backgroundColor'])$(key).value=state[key];
$('export-selected').onclick=safe(()=>exportFile($('output-format').value));
$('copy-selected').onclick=safe(()=>exportFile($('output-format').value,true));
$('copy-source').onclick=safe(()=>copy($('source').value));$('copy-other').onclick=safe(()=>copy($('other-source').textContent));$('copy-mathml').onclick=safe(()=>copy($('mathml').textContent));

$('save-library').onclick=safe(()=>save(new Blob([JSON.stringify({format:'mathforge-library',version:1,history:state.history},null,2)],{type:'application/json'}),'formula-library.json'));
window.FormulaChooseImport=()=>{if(bridge){send('import');return;}const f=document.createElement('input');f.type='file';f.accept='.tex,.typ,.txt,.svg,.mathforge,.json';f.onchange=safe(async()=>{const file=f.files[0];if(file)await window.FormulaCommands.execute('importContent',{text:await file.text(),ext:file.name.split('.').pop()});});f.click();};
$('input-settings').onclick=()=>{$('tool-dialog').showModal();if(bridge)send('scanTools');else{$('tool-paths').textContent='本机路径检测仅在 Mac 应用中可用。';}};
$('close-tools').onclick=()=>{$('tool-dialog').close();};$('scan-tools').onclick=()=>window.FormulaCommands.execute('scanLocalTools');

for(const kind of ['svg','pdf'])$('batch-'+kind).onclick=safe(()=>window.FormulaCommands.execute('batchExport',{kind,text:$('batch-source').value}));

$('preview').title='Mac 应用中按住 Option 拖动，可将公式文件拖到桌面或其他应用';
$('preview').addEventListener('mousedown',safe(async e=>{if(!e.altKey||!bridge||!valid)return;e.preventDefault();if(nativeResult){const kind=nativeResult.svg?'svg':'pdf';send('drag',{name:'equation.'+kind,base64:nativeResult[kind]});}else if(svgResult){send('drag',{name:'equation.svg',base64:await bytesBase64(new Blob([svgText()]))});}}));

updateOutputFormats();applyUI();history();if(state.rawSource){$('source').value=content.get(state.sourceLanguage)?.text??state.rawSource;readSource();}else loadLatex(state.latex);if(bridge)send('scanTools');

installSourceAssist($('source'),()=>state.sourceLanguage);
installSourceIndentation($('source'),()=>state.sourceLanguage);
window.FormulaSourceSurface=installSourceSurface($('source'),()=>state.sourceLanguage);

// All public editing/navigation/clipboard entry points share this registry.
const captureRevision=()=>({formulaContent:captureContent(),formulaObject:content.snapshot(),visualLatex:content.cached('visual')??mf.getValue('latex'),focus:document.activeElement===mf?'visual':document.activeElement===$('preview')?'preview':'source',latex:state.latex,rawSource:content.get(state.sourceLanguage)?.text??content.authority.text,editorMode:state.editorMode,...captureDocumentSettings(state),sourceSelection:[$('source').selectionStart,$('source').selectionEnd],sourceScroll:[$('source').scrollLeft,$('source').scrollTop],visualSelection:JSON.parse(JSON.stringify(mf.selection))});
let savedFormulaHistory={};try{savedFormulaHistory=JSON.parse(localStorage.getItem('formula-document-history')||'{}');}catch{}
const formulaHistory=new FormulaHistory(savedFormulaHistory);let formulaHistoryTimer;
// Preserve meaningful content changes from the previous operation-history store once.
if(!savedFormulaHistory.migrated){try{const old=JSON.parse(localStorage.getItem('formula-operation-history')||'{}');for(const entry of old.entries||[]){const snapshot=migrateTypesetting(entry.snapshot||{});if(snapshot.rawSource?.trim())formulaHistory.observe(snapshot,entry.title||'历史公式版本');}}catch{}savedFormulaHistory.migrated=true;}

function saveFormulaHistory(){try{localStorage.setItem('formula-document-history',JSON.stringify({...formulaHistory.serialize(),migrated:true}));}catch{status('历史空间不足，当前公式未受影响',true);}}
function recordFormulaSnapshot(snapshot,title){if(batchSession)return;formulaHistory.observe(snapshot,title);saveFormulaHistory();}
function observeFormula(title='编辑公式'){if(batchSession||revisions.restoring||revisions.inTransaction||revisions.busy||revisions.timer)return;recordFormulaSnapshot(captureRevision(),title);}
formulaHistory.onOversize=()=>status('公式超过历史容量，本次内容未写入历史；当前编辑仍保留。',true);
window.FormulaDocumentHistory=formulaHistory;
const revisions=new RevisionHistory(captureRevision,async snapshot=>{
  snapshot=normalizeColorSettings(migrateTypesetting(snapshot));localAttemptSource=null;renderBackendUsed='builtin';
  const fontChanged=snapshot.mathFont&&snapshot.mathFont!==state.mathFont;clearTimeout(sourceTimer);clearTimeout(visualTimer);for(const key of ['editorMode',...documentSnapshotSettingKeys])if(snapshot[key]!==undefined)state[key]=snapshot[key];restoreContent(snapshot);$('source').value=content.get(state.sourceLanguage)?.text??snapshot.rawSource;applyUI();readSource();updateMode();
  $('source').setSelectionRange(...(snapshot.sourceSelection||[0,0]));$('source').scrollLeft=(snapshot.sourceScroll||[0,0])[0];$('source').scrollTop=(snapshot.sourceScroll||[0,0])[1];
  if(snapshot.editorMode==='visual'){updating=true;mf.setValue(content.cached('visual')??(snapshot.formulaObject?content.get('latex')?.text:snapshot.visualLatex??snapshot.latex),{silenceNotifications:true});updating=false;mf.focus();try{mf.selection=snapshot.visualSelection;}catch{}}else $('source').focus();persist();if(fontChanged)await applyMathFont(state.mathFont);
});
const registry=new CommandRegistry(()=>updateCommandState());registry.onError=e=>status(e.message,true);
window.FormulaCommands=registry;window.FormulaRevisions=revisions;
let commandDepth=0;
async function editTransaction(title,execute){
  const result=await revisions.transaction(title,async context=>{recordFormulaSnapshot(captureRevision(),'编辑前的公式');commandDepth++;try{return await execute(context);}finally{commandDepth--;}});
  observeFormula(title);return result;
}
// Protect the editable surfaces only while a queued document operation owns
// state. Their geometry is unchanged; commands and Undo remain available.
let transactionInert,transactionLock;
const focusSource=$('source').focus.bind($('source'));
$('source').focus=(options)=>{if(revisions.busy)revisions.editorFocus='source';focusSource(options);};
revisions.onBusyChange=busy=>{
  if(busy){revisions.editorFocus=null;transactionInert=inputEditors.inert;const lock=transactionLock={};clearTimeout(formulaHistoryTimer);queueMicrotask(()=>{if(transactionLock===lock)inputEditors.inert=true;});}
  else{transactionLock=null;inputEditors.inert=transactionInert;if(revisions.editorFocus||document.activeElement===document.body){if(revisions.editorFocus==='visual'||(!revisions.editorFocus&&state.editorMode==='visual'))mf.focus();else $('source').focus({preventScroll:true});}updateCommandState();}
};
const register=(id,title,shortcut,category,execute,enabled=()=>true)=>registry.register({id,title,shortcut,category,execute,enabled});
registry.executionContext=()=>!batchSession;
registry.register({id:'scanLocalTools',title:'检测本机环境',mutation:'runtime',execute:()=>send('scanTools')});
registry.register({id:'chooseLocalTool',title:'配置本机工具路径',mutation:'preference',context:args=>['latex','typst','dvisvgm','pdftops'].includes(args?.tool),execute:args=>send('chooseTool',{tool:args.tool})});

registry.register({id:'batchExport',title:'批量导出',category:'文件',mutation:'runtime',context:args=>['svg','pdf'].includes(args?.kind)&&typeof args.text==='string',execute:async args=>{
  if(revisions.busy||[...registry.executions].some(x=>x.id!=='batchExport'))throw Error('请等待当前操作完成后再批量导出');
  const lines=args.text.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length)throw Error('请输入待导出的公式');if(lines.length>100)throw Error('每次最多批量导出 100 条');
  // Finish pending input before taking a by-value snapshot. Temporary rendering
  // must never persist a batch item as the user's current document or history.
  if(!content.matches(state.sourceLanguage,$('source').value))await readSource();
  revisions.flush();await renderQueue;
  const original=JSON.parse(JSON.stringify({...state,formulaContent:captureContent()})),context=captureEditorContext(),focus=document.activeElement;
  const runtime={localAttemptSource,renderBackendUsed};
  const previewNodes=[...$('preview').childNodes].map(n=>n.cloneNode(true)),visualLatex=mf.getValue('latex');
  const surfaces=[document.querySelector('.editor-card'),document.querySelector('.preview-card'),...$('tool-dialog').querySelectorAll('.settings-disclosure-content')];
  const inert=surfaces.map(n=>n.inert);batchSession={};surfaces.forEach(n=>n.inert=true);updateCommandState();
  let cancelled=false;
  try{
    for(const line of lines){$('source').value=line;const result=await exportFile(args.kind);if(result?.cancelled){cancelled=true;break;}}
  }finally{
    // Keep the scope closed while restoring and rendering the original formula.
    Object.assign(state,original);restoreContent(original);$('source').value=content.get(state.sourceLanguage)?.text??original.rawSource;
    localAttemptSource=runtime.localAttemptSource;renderBackendUsed=runtime.renderBackendUsed;lastRenderKey='';$('preview').replaceChildren(...previewNodes);applyUI();await readSource();await renderQueue;
    updating=true;mf.setValue(visualLatex,{silenceNotifications:true});updating=false;
    surfaces.forEach((n,i)=>n.inert=inert[i]);batchSession=null;persist();restoreEditorContext(context);if($('tool-dialog').open&&focus?.isConnected)focus.focus({preventScroll:true});updateCommandState();
  }
  status(cancelled?'已取消批量导出':'批量导出完成');
}});

registry.register({id:'setDocumentSetting',title:'修改排版设置',category:'排版',mutation:'document',undoable:true,context:args=>!!args&&Object.hasOwn(documentSettingControls,args.key),execute:async args=>{
  const {key}=args;let value;
  try{value=validateDocumentSetting(key,args.value);}catch(error){$(documentSettingControls[key]).value=state[key];outputColors?.refresh();throw error;}
  if(key==='mathFont')return applyMathFont(value,true);
  let rendering;
  await editTransaction('修改排版设置',()=>{
    if(value===state[key])return;
    state[key]=value;$(documentSettingControls[key]).value=value;
    if(key==='backgroundColor')state.transparent=value==='transparent';
    outputColors?.refresh();persist();
    rendering=content.matches(state.sourceLanguage,$('source').value)?scheduleRender():readSource();
  });
  await rendering;
}});
for(const [key,id] of Object.entries(documentSettingControls)){
  $(id).onchange=()=>registry.execute('setDocumentSetting',{key,value:$(id).value}).catch(registry.onError);
}
registry.register({id:'setEditorZoom',title:'调整编辑显示大小',category:'视图',mutation:'preference',context:args=>['sourceZoom','visualZoom'].includes(args?.key)&&Number.isFinite(args.step),execute:args=>{
  state[args.key]=Math.max(0.5,Math.min(2.5,Math.round((state[args.key]+args.step)*10)/10));applyEditorZoom();persist();
}});
for(const [id,step] of [['editor-size-down',-0.1],['editor-size-up',0.1]])$(id).onclick=()=>registry.execute('setEditorZoom',{key:inputEditors.dataset.inputMode==='visual'?'visualZoom':'sourceZoom',step});
registry.register({id:'setToolbarDisplay',title:'工具栏显示方式',mutation:'preference',context:args=>['icon','text','icontext'].includes(args?.mode),execute:args=>applyUIMode(args.mode)});
registry.register({id:'setToolbarItem',title:'修改自定义工具',mutation:'preference',context:args=>catalog.some(x=>x.id===args?.id)&&typeof args.selected==='boolean',execute:args=>{toolbarLayout=args.selected?[...new Set([...toolbarLayout,args.id])]:toolbarLayout.filter(id=>id!==args.id);saveToolbar();}});
registry.register({id:'moveToolbarItem',title:'排列自定义工具',mutation:'preference',context:args=>catalog.some(x=>x.id===args?.id)&&(!args.target||toolbarLayout.includes(args.target)),execute:args=>{if(args.id===args.target)return;toolbarLayout=toolbarLayout.filter(id=>id!==args.id);toolbarLayout.splice(args.target?toolbarLayout.indexOf(args.target):toolbarLayout.length,0,args.id);saveToolbar();}});
registry.register({id:'resetToolbar',title:'恢复默认工具栏',mutation:'preference',execute:()=>{toolbarLayout=[...defaultToolbar];saveToolbar();}});
const auxiliaryInput=()=>{const n=document.activeElement;return n!==$('source')&&n!==mf&&!!n?.matches('input:not([type=checkbox]):not([type=color]):not([type=range]):not([type=button]),textarea,[contenteditable=true]');};
register('undo','撤销','meta+z','编辑',()=>auxiliaryInput()?nativeEdit('undo'):revisions.undo(),()=>auxiliaryInput()||revisions.canUndo);
register('redo','重做','meta+shift+z','编辑',()=>auxiliaryInput()?nativeEdit('redo'):revisions.redo(),()=>auxiliaryInput()||revisions.canRedo);
register('newFormula','新建公式','meta+n','文件',()=>editTransaction('新建公式',()=>{documentLifecycle.adopt('未命名公式',{});documentLifecycle.savedSignature=null;content=new FormulaObject(null,{language:state.sourceLanguage,text:'',mode:state.editorMode,formatting:captureDocumentSettings(state)});content.identity.documentId=documentLifecycle.id;$('source').value='';updating=true;mf.setValue('');updating=false;++renderID;valid=false;svgResult=null;nativeResult=null;$('preview').replaceChildren();persist();}));
async function saveDocument(saveAs){
  if(!bridge)return exportFile('project');
  if(!content.matches(state.sourceLanguage,$('source').value))await readSource();
  if(state.editorMode==='visual')content.setVisual(mf.getValue('latex'));captureContent();
  const signature=documentSignature(state),id=documentLifecycle.id;
  const payload=JSON.stringify({format:'mathforge-equation',version:1,state:formulaSnapshot()});
  const result=await nativeRequest('saveProject',{documentID:id,signature,saveAs,name:documentLifecycle.name==='未命名公式'?'equation.mathforge':documentLifecycle.name,base64:await bytesBase64(new Blob([payload]))});
  if(result.saved&&documentLifecycle.id===id){documentLifecycle.saved(result.name,signature);persist();}
  status(result.cancelled?'已取消保存':'已保存 '+(result.name||documentLifecycle.name));return result;
}
register('openFormula','打开…','meta+o','文件',()=>window.FormulaChooseImport());
window.FormulaRefreshDocumentIdentity=()=>persist();
register('saveFormula','保存公式','meta+s','文件',()=>saveDocument(false));
register('saveAs','另存为…','meta+shift+s','文件',()=>saveDocument(true));
register('exportFormula','导出…','meta+shift+e','文件',()=>exportFile($('output-format').value),()=>valid&&!!(svgResult||nativeResult));
let settingsContext=null;
function captureSettingsContext(){settingsContext=captureEditorContext();}
$('input-settings').addEventListener('pointerdown',captureSettingsContext);
$('tool-dialog').addEventListener('close',()=>{
  const context=settingsContext;settingsContext=null;if(!context)return;
  restoreEditorContext(context);
});
register('settings','设置…','meta+,','应用',()=>{if(!settingsContext)captureSettingsContext();$('tool-dialog').showModal();if(bridge)send('scanTools');});
async function changeEditorMode(mode){
  if(!['visual','latex','typst'].includes(mode))return;
  const source=$('source');
  if(mode==='visual'){
    if(state.editorMode!=='visual'){
      if(content.validation!=='parsed'||!content.matches(state.sourceLanguage,source.value)){await readSource();if(!valid)return;}
      if(!valid){status('请先修正当前源码，原内容已保留。',true);return;}
      if(!conversionAvailable){status('此源码暂不支持可视化编辑，已保留原内容。',true);return;}
      if(state.sourceLanguage==='typst'){await switchMode('latex');if(state.sourceLanguage!=='latex')return;}
    }
    setInputPane('visual');mf.focus();persist();return;
  }
  const previousMode=state.editorMode;if(previousMode==='visual'){syncVisual(true);state.editorMode='latex';}
  await switchMode(mode);if(state.sourceLanguage!==mode){state.editorMode=previousMode;updateMode();return;}
  state.editorMode=mode;updateMode();mf.blur();source.focus();persist();
}
const changePane=mode=>changeEditorMode(mode==='visual'?'visual':state.sourceLanguage);
register('switchToSource','LaTeX 编辑','meta+l','视图',()=>registry.execute('switchLatex'));
register('switchToVisual','可视化编辑','meta+e','视图',()=>registry.execute('switchVisual'));
register('workspace1','聚焦 LaTeX','meta+1','视图',()=>registry.execute('switchLatex'));
register('workspace2','聚焦可视化','meta+2','视图',()=>registry.execute('switchVisual'));
$('preview').tabIndex=0;
register('workspace3','聚焦结果','meta+3','视图',()=>{$('preview').focus({preventScroll:true});});
const graphicKind=()=>['svg','pdf','png','jpeg','tiff','eps'].includes($('output-format').value)?$('output-format').value:nativeResult?.svg||svgResult?'svg':'pdf';
register('copySelected','智能复制',null,'编辑',()=>copyEquation(),()=>valid&&!!(svgResult||nativeResult));
register('copyRenderedImage','复制渲染结果','meta+shift+c','编辑',()=>exportFile(graphicKind(),true),()=>valid&&!!(svgResult||nativeResult));
register('copySource','复制当前源码','meta+alt+c','编辑',()=>copy(contentSource(state.sourceLanguage)));
register('copyLatex','复制为 LaTeX',null,'复制',()=>exportFile('latex',true));
register('copyTypst','复制为 Typst',null,'复制',()=>exportFile('typst',true));
register('smartCopy','智能复制',null,'复制',()=>copyEquation());
register('copyEditableEquation','复制为可编辑公式',null,'复制',()=>copyEquation(true));
register('copyMathML','复制为 MathML',null,'复制',()=>exportFile('mathml',true));
register('copySVG','复制为 SVG',null,'复制',()=>exportFile('svg',true));
register('copyPNG','复制为图片',null,'复制',()=>exportFile('png',true));
register('copy','复制','meta+c','编辑',()=>{
  if(auxiliaryInput())return nativeEdit('copy');
  if(document.activeElement===$('source')){
    const source=$('source');
    // An empty selection follows native Copy: do not erase existing clipboard data.
    if(source.selectionStart===source.selectionEnd)return nativeEdit('copy');
    return copy(source.value.slice(source.selectionStart,source.selectionEnd));
  }
  if(document.activeElement===mf){
    if(!mf.selectionIsCollapsed)return copy(mf.getValue(mf.selection,'latex'));
  }else {
    const selection=window.getSelection();
    // MathLive keeps a hidden shadow-DOM text selection after focus leaves it.
    // Only a visible document text selection belongs to native text Copy.
    if(selection?.toString()&&selection.anchorNode?.getRootNode()===document)return nativeEdit('copy');
  }
  return copyEquation();
});
const nativeEdit=action=>{if(bridge)send('nativeEdit',{edit:action});else {document.execCommand(action);}};
for(const [id,title,key] of [['cut','剪切','x'],['paste','粘贴','v'],['selectAll','全选','a']])register(id,title,'meta+'+key,'编辑',()=>{if(document.activeElement===mf&&id==='selectAll'){mf.select();return;}return nativeEdit(id);});
register('tryLocalTypesetting','尝试本机排版',null,'视图',()=>{if(!bridge){status('本机环境需要在 Formula Mac 应用中使用',true);return;}const src=stripDelimiters($('source').value);localAttemptSource=state.sourceLanguage+':'+src;return readSource();},()=>!$('render-feedback').hidden&&$('render-feedback').dataset.category==='capability');
register('switchLatex','转换为 LaTeX',null,'公式',()=>editTransaction('转换为 LaTeX',()=>changeEditorMode('latex')));
register('switchTypst','转换为 Typst',null,'公式',()=>editTransaction('转换为 Typst',()=>changeEditorMode('typst')));
register('switchVisual','切换可视化',null,'视图',()=>editTransaction('切换可视化',()=>changeEditorMode('visual')));
const describeStructure=t=>/^#?@?[_^]|^[{].*[_^]/.test(t)?'应用上下标':/\\(?:hat|tilde|dot|ddot|vec|bar|overline|widehat|widetilde)/.test(t)?'应用修饰符':/\\(?:frac|dfrac|tfrac)/.test(t)?'插入分式':/\\sqrt/.test(t)?'插入根式':/matrix/.test(t)?'插入矩阵':/\\left/.test(t)?'添加括号':'插入公式结构';
register('applyStyle','应用文字样式',null,'公式',args=>editTransaction('应用文字样式',()=>{mf.focus();mf.applyStyle(args,{operation:'set'});syncVisual(true);}));
register('insertStructure','插入公式结构',null,'公式',args=>editTransaction(args?.title||describeStructure(args.template),()=>{if(inputEditors.dataset.inputMode==='source'){const source=$('source'),selected=source.value.slice(source.selectionStart,source.selectionEnd);let text=args.transform===false?args.template:selectionStructure(args.template,selected).replaceAll('#?','');text=state.sourceLanguage==='typst'?formatTypstSource(typst(text)):formatLatexSource(text);source.focus();document.execCommand('insertText',false,text);source.dispatchEvent(new Event('input',{bubbles:true}));readSource();}else applyVisualStructure(mf,args.template,{transform:args.transform!==false});}));
window.FormulaApplyVisualStructure=(editor,template,options={})=>registry.execute('insertStructure',{template,...options});
for(const [id,title,template] of [
  ...['hat','widehat','tilde','widetilde','bar','overline','vec','dot','ddot','breve','check','acute','grave','overset','underset'].map(name=>['accent.'+name,name+' 修饰', '\\'+name+(name==='overset'||name==='underset'?'{}{}':'{}')]),
  ['superscript','上标 superscript','^{}'],['subscript','下标 subscript','_{}'],['scripts','上下标','_{}^{}'],
  ['fraction','分式 fraction','\\frac{}{}'],['root','根式 root','\\sqrt{}'],['nthRoot','n 次根','\\sqrt[]{}'],
  ['brackets','括号 brackets','\\left(\\right)'],['absolute','绝对值','\\left|\\right|'],['norm','范数','\\left\\lVert\\right\\rVert'],
  ['matrix','矩阵 matrix','\\begin{pmatrix}#@&#?\\\\#?&#?\\end{pmatrix}'],['cases','分段 cases','\\begin{cases}#@&#?\\\\#?&#?\\end{cases}']
])registry.register({id,title,category:'结构',undoable:true,mutation:'document',enabled:()=>!mf.readOnly,execute:()=>registry.execute('insertStructure',{template,title})});

register('sourceAccept','接受源码补全',null,'公式',args=>editTransaction('接受源码补全',args.execute));
register('matrixEdit','编辑矩阵',null,'公式',args=>editTransaction('编辑矩阵',()=>{mf.focus();mf.executeCommand(args.command);syncVisual(true);}));
window.FormulaExecuteMatrixCommand=command=>registry.execute(['undo','redo'].includes(command)?command:'matrixEdit',{command});
register('insertTemplate','插入模板',null,'公式',args=>editTransaction('插入模板',()=>loadLatex(args.latex)));
for(const b of document.querySelectorAll('[data-example]'))b.onclick=()=>registry.execute('insertTemplate',{latex:examples[b.dataset.example]});
// Favorites are user assets; restoring one is a document transaction, managing
// the collection itself does not consume the active formula's Undo stack.
const favoriteExists=args=>Number.isInteger(args?.index)&&args.index>=0&&args.index<state.history.length;
registry.register({id:'restoreFavorite',title:'恢复收藏公式',category:'收藏',mutation:'document',undoable:true,context:favoriteExists,
  execute:args=>editTransaction('恢复收藏公式',async()=>{const item=state.history[args.index];if(typeof item==='string')loadLatex(item);else await restore(item);await renderQueue;})});
registry.register({id:'removeFavorite',title:'删除收藏公式',category:'收藏',mutation:'asset',context:favoriteExists,
  execute:args=>{state.history.splice(args.index,1);history();persist();}});
registry.register({id:'rememberFormula',title:'收藏当前公式',category:'收藏',mutation:'asset',enabled:()=>!!$('source').value.trim(),execute:async()=>{
  if(!content.matches(state.sourceLanguage,$('source').value))await readSource();
  if(!valid)return;
  captureContent();const item={...state,history:undefined};state.history=[item,...state.history.filter(x=>(typeof x==='string'?x:x.rawSource)!==state.rawSource)].slice(0,100);history();persist();status('已收藏当前公式及排版设置');
}});
$('remember').onclick=safe(()=>registry.execute('rememberFormula'));
registry.register({id:'importFavoriteLibrary',title:'导入收藏库',mutation:'asset',context:args=>Array.isArray(args?.history)&&args.history.every(x=>typeof x==='string'||(x&&typeof x.rawSource==='string')),execute:args=>{state.history=JSON.parse(JSON.stringify(args.history.slice(0,100)));history();persist();status('收藏已恢复');}});
registry.register({id:'backupFavoriteLibrary',title:'备份收藏库',mutation:'none',execute:()=>save(new Blob([JSON.stringify({format:'mathforge-library',version:1,history:state.history},null,2)],{type:'application/json'}),'formula-library.json')});
$('save-library').onclick=safe(()=>registry.execute('backupFavoriteLibrary'));


register('showTemplates','公式模板',null,'公式',()=>selectToolTab('templates'));
register('showFavorites','收藏夹',null,'公式',()=>selectToolTab('favorites'));
register('importContent','导入 / 识别公式',null,'文件',args=>{
  if(['json','mathforge'].includes(args.ext)){const data=JSON.parse(args.text);if(data.format==='mathforge-library')return registry.execute('importFavoriteLibrary',{history:data.history});}
  return editTransaction('导入 / 识别公式',async()=>{await importContent(args.text,args.ext,args.metadata);await renderQueue;});
});window.FormulaImport=(text,ext,name,token,metadata)=>registry.execute('importContent',{text,ext,metadata}).then(result=>{if(result&&name){documentLifecycle.adopt(name,state);persist();if(token)send('documentOpened',{token,documentID:documentLifecycle.id});}return result;}).catch(error=>{if(token)send('documentOpened',{token});registry.onError(error);return false;});
for(const [id,command] of [['input-visual','switchToVisual'],['copy-selected','copySelected'],['export-selected','exportFormula'],['copy-source','copySource'],['input-settings','settings'],['mode-latex','switchLatex'],['mode-typst','switchTypst'],['clear-input','newFormula']]){
  $(id).onclick=safe(()=>registry.execute(command));const item=registry.commands.get(command);$(id).title=item.title+(item.shortcut?' ('+shortcutLabel(item.shortcut)+')':'');
}
const formatButtons=()=>{for(const [id,command] of [['copy-selected','copySelected'],['export-selected','exportFormula']])$(id).disabled=!registry.enabled(command);for(const b of formatting.querySelectorAll('[data-command="undo"],[data-command="redo"]')){const id=b.dataset.command;b.disabled=!registry.enabled(id);}};

function shortcutLabel(key){return key.replace('meta','⌘').replace('alt','⌥').replace('shift','⇧').replaceAll('+','').toUpperCase();}
const commandPanel=document.createElement('div');commandPanel.className='command-overlay';commandPanel.hidden=true;
commandPanel.innerHTML='<input aria-label="搜索命令或历史" placeholder="搜索命令"><div class="find-replace" hidden><input aria-label="替换为" placeholder="替换为"><button data-replace="one">替换</button><button data-replace="all">全部替换</button></div><div class="command-list"></div>';document.body.append(commandPanel);
const commandSearch=commandPanel.querySelector('input'),commandList=commandPanel.querySelector('.command-list');let panelKind='commands',panelSelection=0,returnContext=null;
function closeCommands(){commandPanel.hidden=true;restoreEditorContext(returnContext);}
function showCommands(kind){commandPanel.querySelector('.find-replace').hidden=true;returnContext=captureEditorContext();revisions.flush();panelKind=kind;panelSelection=0;commandSearch.value='';commandSearch.placeholder=kind==='history'?'搜索编辑历史':'搜索命令';commandPanel.hidden=false;drawCommands();commandSearch.focus();}
function drawCommands(){commandList.replaceChildren();const term=commandSearch.value.toLowerCase();const items=panelKind==='history'?revisions.entries.map((entry,i)=>({title:entry.title+' · '+new Date(entry.time).toLocaleTimeString(),enabled:true,execute:()=>revisions.go(i),active:i===revisions.index})).reverse():registry.list().filter(c=>!['tryLocalTypesetting','insertStructure','matrixEdit','sourceAccept','applyStyle','insertTemplate','importContent','restoreFavorite','removeFavorite','setDocumentSetting','setEditorZoom','switchVisual','batchExport','setToolbarDisplay','setToolbarItem','moveToolbarItem','resetToolbar','importFavoriteLibrary','backupFavoriteLibrary','clearFormulaHistory','removeFormulaHistory','scanLocalTools','chooseLocalTool','restoreFormulaVersion'].includes(c.id)).map(c=>({...c,title:c.title+(c.shortcut?' · '+shortcutLabel(c.shortcut):''),execute:()=>registry.execute(c.id)}));
  for(const item of items.filter(c=>(c.title+' '+(c.id||'')).toLowerCase().includes(term))){const b=document.createElement('button');b.textContent=item.title;b.disabled=!item.enabled;if(item.active)b.classList.add('active');b.onpointerdown=e=>e.preventDefault();b.onclick=async()=>{closeCommands();await item.execute();};commandList.append(b);}
  const buttons=[...commandList.querySelectorAll('button:not(:disabled)')];panelSelection=Math.min(panelSelection,Math.max(0,buttons.length-1));buttons.forEach((b,i)=>b.classList.toggle('selected',i===panelSelection));
}
register('commandPalette','命令面板','meta+k','视图',()=>showCommands('commands'));
register('showHistory','历史公式',null,'公式',()=>showFormulaHistory());
registry.register({id:'restoreFormulaVersion',title:'恢复公式历史版本',mutation:'document',undoable:true,context:args=>formulaHistory.versions.some(v=>v.id===args?.id),execute:async args=>{
  const version=formulaHistory.versions.find(v=>v.id===args.id);clearTimeout(formulaHistoryTimer);
  await editTransaction('恢复历史版本',()=>restore({...version.after,visualDraft:version.after.visualLatex}));
  $('tool-dialog').close();
  if(state.editorMode==='visual')mf.focus();else $('source').focus();
}});

registry.register({id:'clearFormulaHistory',title:'清空全部历史',mutation:'asset',execute:()=>{clearTimeout(formulaHistoryTimer);formulaHistory.clear(captureRevision());selectedVersionID=null;saveFormulaHistory();drawFormulaHistory();if($('show-formula-versions').open)drawVersionHistory();}});
registry.register({id:'removeFormulaHistory',title:'删除历史公式',mutation:'asset',context:args=>formulaHistory.formulas.some(x=>x.id===args?.id),execute:args=>{formulaHistory.remove(args.id);saveFormulaHistory();drawFormulaHistory();}});
function showFormulaHistory(){
  returnContext=captureEditorContext();revisions.flush();observeFormula();panelKind='formulas';commandPanel.querySelector('.find-replace').hidden=true;commandPanel.hidden=false;commandSearch.value='';commandSearch.placeholder='搜索历史公式';drawFormulaHistory();commandSearch.focus();
}
function drawFormulaHistory(){
  commandList.replaceChildren();const clear=document.createElement('button');clear.textContent='清空全部历史';clear.onclick=()=>registry.execute('clearFormulaHistory');commandList.append(clear);
  for(const item of formulaHistory.formulas.filter(x=>x.snapshot.rawSource.toLowerCase().includes(commandSearch.value.toLowerCase()))){
    const row=document.createElement('div');row.className='formula-history-row';const open=document.createElement('button');open.className='formula-history-preview';open.textContent=item.snapshot.rawSource||'空公式';open.setAttribute('aria-label','打开历史公式 '+(item.snapshot.rawSource||'空公式'));open.onclick=()=>{closeCommands();registry.execute('importContent',{text:JSON.stringify({format:'mathforge-equation',state:item.snapshot}),ext:'mathforge'});};
    if(item.snapshot.latex&&(!item.snapshot.formulaContent||item.snapshot.formulaContent.validation==='parsed'))MathJax.startup.promise.then(()=>MathJax.tex2svgPromise(item.snapshot.latex,{display:true})).then(node=>{const svg=node.querySelector('svg');if(svg&&open.isConnected){svg.removeAttribute('width');svg.removeAttribute('height');open.replaceChildren(svg);}}).catch(()=>{});
    const time=document.createElement('small');time.textContent=new Date(item.time).toLocaleString()+' · '+(item.snapshot.editorMode==='visual'?'可视化':item.snapshot.editorMode==='typst'?'Typst':'LaTeX');const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','删除历史公式');remove.onclick=()=>registry.execute('removeFormulaHistory',{id:item.id});row.append(open,time,remove);commandList.append(row);
  }
}
let selectedVersionID=null;
function drawVersionHistory(){
  const host=$('formula-versions');host.replaceChildren();
  if(!formulaHistory.versions.length){host.textContent='尚无公式内容版本变化';return;}
  const layout=document.createElement('div');layout.className='formula-version-layout';
  const list=document.createElement('div');list.className='formula-version-list';list.setAttribute('role','listbox');list.setAttribute('aria-label','公式版本');
  const preview=document.createElement('div');preview.className='formula-version-preview';layout.append(list,preview);host.append(layout);
  async function renderSnapshot(target,snapshot){
    if(snapshot.formulaContent&&snapshot.formulaContent.validation!=='parsed'){target.textContent=snapshot.rawSource;return;}
    try{const latex=snapshot.latex||(snapshot.editorMode==='typst'?typst2tex(snapshot.rawSource,{nonStrict:false}):snapshot.rawSource);await MathJax.startup.promise;const node=await MathJax.tex2svgPromise(latex,{display:true});if(target.isConnected)target.replaceChildren(node);}
    catch{target.textContent='该版本暂无法预览';target.title=snapshot.rawSource||'';}
  }
  function select(version){
    selectedVersionID=version.id;for(const button of list.children)button.setAttribute('aria-selected',String(button.dataset.versionId===version.id));preview.replaceChildren();
    for(const [label,snapshot] of [['Before · 修改前',version.before],['After · 修改后',version.after]]){const heading=document.createElement('small');heading.textContent=label;const formula=document.createElement('div');formula.className='formula-version-render';preview.append(heading,formula);renderSnapshot(formula,snapshot);}
    const restoreButton=document.createElement('button');restoreButton.textContent='恢复此版本';restoreButton.onclick=()=>open(version);preview.append(restoreButton);
  }
  function open(version){return registry.execute('restoreFormulaVersion',{id:version.id}).catch(registry.onError);}

  for(const version of [...formulaHistory.versions].reverse()){
    const button=document.createElement('button');button.className='formula-version-entry';button.dataset.versionId=version.id;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.textContent=new Date(version.time).toLocaleString()+' · '+version.title;button.onclick=()=>select(version);button.ondblclick=()=>open(version);list.append(button);
  }
  const selected=formulaHistory.versions.find(v=>v.id===selectedVersionID)||formulaHistory.versions.at(-1);select(selected);
}
$('show-formula-versions').addEventListener('toggle',()=>{if($('show-formula-versions').open)drawVersionHistory();});

let findText='';
function findSource(back=false){changePane('source');if(!findText)return;const text=$('source').value,start=back?$('source').selectionStart-1:$('source').selectionEnd;let at=back?text.lastIndexOf(findText,start):text.indexOf(findText,start);if(at<0)at=back?text.lastIndexOf(findText):text.indexOf(findText);if(at>=0){$('source').setSelectionRange(at,at+findText.length);$('source').focus();}else status('未找到 '+findText,true);}
register('find','查找源码','meta+f','编辑',()=>{commandPanel.querySelector('.find-replace').hidden=false;returnContext=captureEditorContext();panelKind='find';commandPanel.hidden=false;commandSearch.value=findText;commandSearch.placeholder='查找源码';commandList.replaceChildren();commandSearch.focus();});
const replacement=commandPanel.querySelector('.find-replace input');
register('replace','替换当前匹配',null,'编辑',()=>editTransaction('替换源码',()=>{findText=commandSearch.value;if(!findText)return;changePane('source');const source=$('source');if(source.value.slice(source.selectionStart,source.selectionEnd)!==findText)findSource();if(source.value.slice(source.selectionStart,source.selectionEnd)===findText){document.execCommand('insertText',false,replacement.value);source.dispatchEvent(new Event('input',{bubbles:true}));readSource();}}));
register('replaceAll','全部替换匹配',null,'编辑',()=>editTransaction('全部替换源码',()=>{findText=commandSearch.value;if(!findText)return;changePane('source');const source=$('source'),next=source.value.split(findText).join(replacement.value);source.select();document.execCommand('insertText',false,next);source.dispatchEvent(new Event('input',{bubbles:true}));readSource();}));
for(const b of commandPanel.querySelectorAll('[data-replace]')){b.onpointerdown=e=>e.preventDefault();b.onclick=()=>registry.execute(b.dataset.replace==='all'?'replaceAll':'replace');}
register('findNext','查找下一个','meta+g','编辑',()=>findSource());
register('findPrevious','查找上一个','meta+shift+g','编辑',()=>findSource(true));
commandSearch.oninput=()=>{panelSelection=0;if(panelKind==='formulas')drawFormulaHistory();else if(panelKind!=='find')drawCommands();};
commandSearch.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeCommands();return;}if(panelKind==='find'&&e.key==='Enter'){e.preventDefault();findText=commandSearch.value;closeCommands();findSource(e.shiftKey);return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const count=commandList.querySelectorAll('button:not(:disabled)').length;panelSelection=(panelSelection+(e.key==='ArrowDown'?1:-1)+count)%Math.max(1,count);drawCommands();}if(e.key==='Enter'&&panelKind!=='find'){e.preventDefault();commandList.querySelectorAll('button:not(:disabled)')[panelSelection]?.click();}};
document.addEventListener('pointerdown',e=>{if(!commandPanel.hidden&&!commandPanel.contains(e.target))closeCommands();});
$('preview').addEventListener('contextmenu',e=>{e.preventDefault();showCommands('commands');});
const historyEntry=document.createElement('button');historyEntry.className='history-menu-entry';historyEntry.textContent='历史公式';historyEntry.onpointerdown=e=>e.preventDefault();historyEntry.onclick=()=>registry.execute('showHistory');document.querySelector('.editor-card>.section-head').insertBefore(historyEntry,$('input-settings'));
function updateCommandState(){const list=registry.list();send('commandStates',{states:Object.fromEntries(list.map(c=>[c.id,c.enabled]))});formatButtons();if(!commandPanel.hidden&&panelKind!=='find'&&panelKind!=='formulas')drawCommands();}
revisions.onOversize=()=>status('公式超过历史快照容量，本次内容未写入历史。',true);
revisions.onChange=()=>{clearTimeout(formulaHistoryTimer);if(!revisions.restoring){const title=revisions.entries[revisions.index]?.title||'编辑公式';observeFormula(title);formulaHistoryTimer=setTimeout(()=>observeFormula(title),1800);}updateCommandState();try{localStorage.setItem('formula-operation-history',JSON.stringify({index:revisions.index,entries:revisions.entries}));}catch{}};
// Native edit events are grouped; structural registry operations are separate transactions.
$('source').addEventListener('input',e=>{if(!batchSession&&!commandDepth)revisions.schedule(e.inputType?.includes('Paste')?'粘贴源码':e.inputType?.includes('delete')?'删除内容':'输入源码','source');});
window.FormulaRecordVisual=()=>{if(!batchSession&&!commandDepth)revisions.schedule('可视化编辑','visual');};
mf.addEventListener('input',()=>{window.FormulaRecordVisual();if(state.editorMode==='visual'&&!updating)persist();});
window.addEventListener('beforeunload',()=>{revisions.flush();observeFormula();});
try{const saved=JSON.parse(localStorage.getItem('formula-operation-history')||'null');if(saved&&Array.isArray(saved.entries)&&JSON.stringify(saved).length<=revisions.bytes){revisions.entries=saved.entries.filter(e=>e.snapshot&&typeof e.snapshot.rawSource==='string').slice(-100).map(e=>({...e,snapshot:migrateTypesetting(e.snapshot)}));revisions.index=Math.min(Math.max(0,saved.index),revisions.entries.length-1);revisions.counter=Math.max(0,...revisions.entries.map(e=>Number(e.id)||0));}}catch{}
revisions.record('当前公式','initial');
// Native paste/cut/select-all and system quit/close stay in the responder chain.
registry.keyboardContext=(id)=>!(auxiliaryInput()&&['undo','redo','copy','cut','paste','selectAll'].includes(id));
registry.bindKeyboard(document);
// Pinned MathLive 0.111.1 adapter: menu, virtual keyboard and public executeCommand share history.
const internal=mf._mathfield;
if(internal){const originalExecute=internal.executeCommand.bind(internal);internal.executeCommand=command=>{const id=Array.isArray(command)?command[0]:command;if(['undo','redo'].includes(id)){registry.execute(id).catch(registry.onError);return true;}return originalExecute(command);};internal.canUndo=()=>revisions.canUndo;internal.canRedo=()=>revisions.canRedo;}

document.addEventListener('focusin',()=>updateCommandState());
window.FormulaAction=kind=>registry.execute(({import:'openFormula',copy:'copySource',project:'saveFormula'})[kind]||'exportFormula');
for(const id of ['newFormula','switchLatex','switchTypst','switchVisual','switchToSource','switchToVisual','workspace1','workspace2','insertStructure','matrixEdit','sourceAccept','applyStyle','insertTemplate','importContent','replace','replaceAll']){registry.commands.get(id).undoable=true;registry.commands.get(id).mutation='document';}
send('registerCommands',{commands:registry.list().filter(c=>!['tryLocalTypesetting','sourceAccept','applyStyle','insertTemplate','importContent','restoreFavorite','removeFavorite','setDocumentSetting','setEditorZoom','switchVisual','batchExport','setToolbarDisplay','setToolbarItem','moveToolbarItem','resetToolbar','importFavoriteLibrary','backupFavoriteLibrary','clearFormulaHistory','removeFormulaHistory','scanLocalTools','chooseLocalTool','restoreFormulaVersion'].includes(c.id))});
document.querySelector('footer>span:last-child').textContent='⌘K 命令面板 · ⇧⌘E 导出 · ⇧⌘C 复制结果';

for(const button of document.querySelectorAll('.editor-mode [role=radio]')){button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const modes=['visual','latex','typst'],at=modes.indexOf(state.editorMode),next=event.key==='Home'?0:event.key==='End'?2:(at+(event.key==='ArrowRight'?1:2))%3;registry.execute({visual:'switchToVisual',latex:'switchLatex',typst:'switchTypst'}[modes[next]]).then(()=>document.querySelector('.editor-mode [aria-checked=true]').focus());};}
