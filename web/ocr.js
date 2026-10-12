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
  window.FormulaOCRProgress=(id,result)=>{if(pending.has(id))status.textContent=result.message;};
  function request(action,data={}){
    return new Promise((resolve,reject)=>{
      const id='ocr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('本地公式识别操作超时'));},action==='ocrStatus'?15000:action==='ocrInstall'?50*60*1000:5*60*1000);
      pending.set(id,{resolve,reject,timer});
      try{bridge.postMessage({action,...data,id});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
    });
  }
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
    <p class="ocr-note">第一版针对“单个、已裁剪的公式图片”。识别结果会作为 LaTeX 自动送回 Formula，可继续用 MathLive 修改并转换为 Typst。模型与 Python 环境保存在用户 Application Support 中，不计入 Formula.app/DMG 大小。</p>
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
      status.textContent=r.busy?'本地识别组件正在安装或识别，请稍后刷新状态。':r.installed?`本地识别已安装 · 占用约 ${fmt(r.bytes||0)} · 可离线使用`:(r.environmentExists?'Python 环境已创建，但识别模型尚未验证就绪。请继续安装，完成后再选择图片。':r.pythonAvailable?'尚未安装识别模型。首次安装会创建独立环境并下载 Pix2Text/MFR 模型。':'尚未安装识别模型，且未找到 Python 3。请先安装 Python 3。');
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
