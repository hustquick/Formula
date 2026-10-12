(() => {
  const bridge=window.webkit?.messageHandlers?.mathforge;
  if(!bridge||document.getElementById('formula-ocr-dialog'))return;

  const pending=new Map();
  const previousReply=window.FormulaNativeReply;
  window.FormulaNativeReply=(id,result)=>{
    const req=pending.get(id);
    if(!req){previousReply?.(id,result);return;}
    clearTimeout(req.timer);pending.delete(id);
    if(result?.error)req.reject(Object.assign(new Error(result.error),{log:result.log}));else req.resolve(result||{});
  };
  window.FormulaOCRProgress=(id,result)=>{pending.get(id)?.onProgress?.(result);};
  function request(action,data={},onProgress=r=>{status.textContent=r.message;}){
    return new Promise((resolve,reject)=>{
      const id='ocr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('本地公式识别操作超时'));},action==='ocrStatus'?15000:action==='ocrInstall'?50*60*1000:action==='ocrDocument'?20*60*1000:5*60*1000);
      pending.set(id,{resolve,reject,timer,onProgress});
      try{bridge.postMessage({action,...data,id});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
    });
  }
  window.FormulaOCRRequest=request;
  const fmt=bytes=>bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;

  const style=document.createElement('style');
  style.textContent=`
    #formula-ocr-dialog{width:min(620px,calc(100vw - 32px));border:0;border-radius:18px;padding:0;box-shadow:0 20px 70px #0004}
    #formula-ocr-dialog::backdrop{background:#0005;backdrop-filter:blur(2px)}
    .ocr-box{padding:22px}.ocr-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.ocr-head h2{margin:0}
    .ocr-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.ocr-actions button{min-height:36px}.ocr-actions .primary{font-weight:700}
    .ocr-status{padding:12px 14px;border-radius:12px;background:color-mix(in srgb,currentColor 6%,transparent);line-height:1.55}
    .ocr-note{opacity:.72;font-size:13px;line-height:1.55}.ocr-log{max-height:150px;overflow:auto;font-size:11px;white-space:pre-wrap;background:#111;color:#ddd;padding:10px;border-radius:10px}
  `;document.head.append(style);

  const dialog=document.createElement('dialog');dialog.id='formula-ocr-dialog';
  dialog.innerHTML=`<div class="ocr-box">
    <div class="ocr-head"><div><h2>图片公式识别</h2><div class="ocr-note">本地 Pix2Text · 首次安装后可离线使用</div></div><button data-close>完成</button></div>
    <p class="ocr-status" data-status>正在检查本地识别模型…</p>
    <div class="ocr-actions"><button class="primary" data-recognize disabled>选择图片并识别</button><button data-install>安装本地识别模型</button><button data-refresh>刷新状态</button></div>
    <p class="ocr-note">第一版针对“单个、已裁剪的公式图片”。识别结果会作为 LaTeX 自动送回 Formula，可继续用 MathLive 修改并转换为 Typst。Python 环境保存在应用支持目录，模型保存在 Pix2Text 用户缓存中，不计入 Formula.app/DMG 大小。</p>
    <details><summary>安装/识别日志</summary><pre class="ocr-log" data-log>尚无日志</pre></details>
  </div>`;
  document.body.append(dialog);
  const status=dialog.querySelector('[data-status]'),recognize=dialog.querySelector('[data-recognize]'),install=dialog.querySelector('[data-install]'),log=dialog.querySelector('[data-log]');
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  async function refresh(){
    status.textContent='正在检查本地识别模型…';
    try{
      const r=await request('ocrStatus');
      recognize.disabled=!r.installed||r.busy;
      install.hidden=false;install.disabled=!!r.busy;install.textContent=r.installed?'验证/修复本地识别模型':'安装/继续安装本地识别模型';
      status.textContent=r.busy?'本地识别组件正在安装或识别，请稍后刷新状态。':r.installed?`本地识别已安装 · 环境占用约 ${fmt(r.bytes||0)} · 可离线使用`:(r.environmentExists?'Python 环境已创建，但识别模型尚未验证就绪。请继续安装，完成后再选择图片。':r.pythonAvailable?'尚未安装识别模型。首次安装会创建独立环境并下载 Pix2Text/MFR 模型。':'尚未安装识别模型，且未找到 Python 3。请先安装 Python 3。');
    }catch(e){status.textContent=e.message;recognize.disabled=true;}
  }
  dialog.querySelector('[data-refresh]').onclick=refresh;
  install.onclick=async()=>{
    install.disabled=true;recognize.disabled=true;status.textContent='正在创建独立环境、安装 Pix2Text 并下载模型…';
    try{const r=await request('ocrInstall');if(r.log)log.textContent=r.log;status.textContent=r.message||'本地识别安装完成';await refresh();}
    catch(e){status.textContent=e.message;log.textContent=e.log||e.message;dialog.querySelector('details').open=true;}
    finally{install.disabled=false;}
  };
  recognize.onclick=async()=>{
    recognize.disabled=true;status.textContent='请选择一个已裁剪的公式图片…';
    try{
      const r=await request('ocrRecognize');
      if(r.cancelled){status.textContent='已取消';return;}
      if(r.log)log.textContent=r.log;
      if(!r.latex)throw new Error('没有识别到公式');
      if(typeof window.FormulaImport!=='function')throw new Error('编辑器尚未就绪，识别结果：'+r.latex);
      window.FormulaImport(r.latex,'tex');
      status.textContent=`识别完成 · ${r.engine||'Pix2Text'} · 已送入编辑器`;
      setTimeout(()=>dialog.close(),500);
    }catch(e){status.textContent=e.message;log.textContent=e.log||e.message;dialog.querySelector('details').open=true;}
    finally{recognize.disabled=false;}
  };

  const imageTab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='图片识别');
  if(imageTab){imageTab.disabled=false;imageTab.title='本地图片公式识别';imageTab.onclick=()=>{dialog.showModal();refresh();};}
})();

(() => {
  if(!window.FormulaOCRRequest||document.getElementById('formula-document-dialog'))return;
  const request=window.FormulaOCRRequest;
  const dialog=document.createElement('dialog');dialog.id='formula-document-dialog';
  dialog.style.cssText='width:min(920px,calc(100vw - 32px));max-height:90vh;border:0;border-radius:18px;padding:0;box-shadow:0 20px 70px #0004';
  dialog.innerHTML=`<div class="ocr-box">
    <div class="ocr-head"><div><h2>文档识别</h2><div class="ocr-note">PDF · Word (.docx) · 整页图片</div></div><button data-doc-close>完成</button></div>
    <p class="ocr-status" data-doc-status role="status" aria-live="polite">正在检查文档识别组件…</p>
    <progress data-doc-progress hidden style="width:100%"></progress>
    <div class="ocr-actions"><button class="primary" data-doc-recognize disabled>选择文档并识别</button><button data-doc-install>安装文档识别组件</button><button data-doc-refresh>刷新状态</button></div>
    <div class="ocr-actions"><label>PDF 起始页 <input data-doc-first type="number" min="1" value="1" style="width:70px"></label><label>末页 <input data-doc-last type="number" min="1" placeholder="自动" style="width:70px"></label><span class="ocr-note">仅用于 PDF；留空时识别最多 20 页，可分批继续。</span></div>
    <p class="ocr-note">识别中英文正文和公式。Word 原生公式直接提取，图片另做识别；结果以 Markdown 预览，可复制全文、导出，或选择公式送入编辑器。</p>
    <section data-doc-results hidden><h3 data-doc-summary></h3><p data-doc-warnings class="ocr-note"></p>
      <div class="ocr-actions"><button data-doc-copy>复制全文</button><button data-doc-export>导出 Markdown…</button><button data-doc-import>导入所选公式</button></div>
      <label>全文预览<textarea data-doc-preview readonly style="box-sizing:border-box;width:100%;height:220px;font:13px/1.6 monospace;white-space:pre-wrap"></textarea></label>
      <h3>识别到的公式</h3><div data-doc-formulas></div>
    </section>
    <details data-doc-details><summary>安装/识别日志</summary><pre class="ocr-log" data-doc-log>尚无日志</pre></details>
  </div>`;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector);
  const status=$('[data-doc-status]'),recognize=$('[data-doc-recognize]'),install=$('[data-doc-install]'),refreshButton=$('[data-doc-refresh]');
  let markdown='',sourceName='文档',selected=[];
  const progress=r=>{
    if(r.message)status.textContent=r.message;
    const bar=$('[data-doc-progress]');bar.hidden=!r.total;
    if(r.total){bar.max=r.total;bar.value=r.completed||0;}
  };
  const failure=e=>{status.textContent=e.message;$('[data-doc-log]').textContent=e.log||e.message;$('[data-doc-details]').open=true;};
  const busy=value=>{recognize.disabled=value;install.disabled=value;refreshButton.disabled=value;};
  $('[data-doc-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  async function refresh(){
    status.textContent='正在检查文档识别组件…';
    try{
      const r=await request('ocrStatus',{},progress);
      recognize.disabled=!r.documentInstalled||r.busy;install.disabled=!!r.busy;
      install.textContent=r.documentInstalled?'验证/修复文档识别':'安装/继续安装文档识别';
      status.textContent=r.busy?'识别组件正在安装或识别，请稍后刷新。':r.documentInstalled?'文档识别已就绪 · 可识别 PDF、Word 和整页图片':'文档识别组件尚未就绪。首次安装需下载文字和公式检测模型，已有的单公式模型会复用。';
    }catch(e){failure(e);recognize.disabled=true;}
  }
  refreshButton.onclick=refresh;
  install.onclick=async()=>{
    busy(true);status.textContent='正在准备文档识别组件与模型…';
    try{const r=await request('ocrInstall',{document:true},progress);$('[data-doc-log]').textContent=r.log||'安装完成';await refresh();}
    catch(e){failure(e);}
    finally{install.disabled=false;refreshButton.disabled=false;$('[data-doc-progress]').hidden=true;}
  };
  function render(result){
    if(!Array.isArray(result.pages))throw new Error('文档识别结果无效');
    markdown=String(result.markdown||'');sourceName=String(result.sourceName||'文档');selected=[];
    $('[data-doc-preview]').value=markdown;
    $('[data-doc-warnings]').textContent=(result.warnings||[]).join('\n');
    const formulas=$('[data-doc-formulas]');formulas.replaceChildren();
    for(const page of result.pages)for(const item of page.items||[]){
      if(!['isolated','embedding'].includes(item.type))continue;
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:10px;margin:10px 0;padding:10px;border:1px solid #8884;border-radius:8px';
      const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;flex:1;min-width:0';
      const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',`选择公式 ${selected.length+1}`);
      const text=document.createElement('span');text.style.cssText='overflow-wrap:anywhere;white-space:pre-wrap';text.textContent=`${item.source||page.source||''}：${item.text}`;
      label.append(check,text);row.append(label);
      const button=document.createElement('button');button.textContent='导入';button.onclick=()=>importFormula(String(item.text));row.append(button);formulas.append(row);
      selected.push({check,latex:String(item.text)});
    }
    if(!selected.length)formulas.textContent='未检测到公式，可查看或复制全文。';
    $('[data-doc-summary]').textContent=`${sourceName} · 已处理 ${result.pages.length} 个页面/内容块 · ${selected.length} 个公式`;
    $('[data-doc-results]').hidden=false;
    status.textContent=result.pages.some(page=>(page.items||[]).some(item=>String(item.text||'').trim()))?`识别完成 · ${selected.length} 个公式，请核对结果后导入`:'文档读取完成，未检测到可识别的正文或公式。';
    $('[data-doc-log]').textContent=result.log||'识别完成';
  }
  function importFormula(latex){
    if(typeof window.FormulaImport!=='function'){failure(new Error('编辑器尚未就绪，请稍后重试。'));return;}
    window.FormulaImport(latex,'tex');dialog.close();
  }
  recognize.onclick=async()=>{
    const first=Number($('[data-doc-first]').value),last=$('[data-doc-last]').value.trim()?Number($('[data-doc-last]').value):0;
    if(!Number.isInteger(first)||first<1||!Number.isInteger(last)||last<0||(last&&(last<first||last-first>=20))){status.textContent='请设置有效 PDF 页码，每次最多识别 20 页。';return;}
    busy(true);status.textContent='请选择 PDF、Word 或整页图片…';
    try{const result=await request('ocrDocument',{first,last},progress);if(result.cancelled){status.textContent='已取消，之前的识别结果仍可查看。';return;}render(result);}
    catch(e){failure(e);}
    finally{busy(false);$('[data-doc-progress]').hidden=true;}
  };
  $('[data-doc-copy]').onclick=()=>{window.webkit.messageHandlers.mathforge.postMessage({action:'copy',text:markdown});status.textContent='已复制识别全文';};
  $('[data-doc-export]').onclick=async()=>{
    try{
      const bytes=new TextEncoder().encode(markdown);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const r=await request('save',{name:sourceName.replace(/\.[^.]+$/,'')+'-识别结果.md',base64:btoa(binary)},progress);
      status.textContent=r.cancelled?'已取消导出':'已导出识别结果';
    }catch(e){failure(e);}
  };
  $('[data-doc-import]').onclick=()=>{
    const formulas=selected.filter(x=>x.check.checked).map(x=>x.latex);
    if(!formulas.length){status.textContent='请先勾选要导入的公式。';return;}
    importFormula(formulas.length===1?formulas[0]:'\\begin{aligned}\n'+formulas.map(x=>'& '+x).join(' \\\\\n')+'\n\\end{aligned}');
  };
  const tab=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='文档识别');
  if(tab){tab.disabled=false;tab.title='本地 PDF / Word / 整页图片识别';tab.onclick=()=>{dialog.showModal();refresh();};}
})();
