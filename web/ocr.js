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
      const timeout=action==='ocrStatus'?15000:action==='ocrInstall'?55*60*1000:12*60*1000;
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('本地公式识别操作超时'));},timeout);
      pending.set(id,{resolve,reject,timer});
      try{bridge.postMessage({action,...data,id});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
    });
  }
  const fmt=bytes=>bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;

  const style=document.createElement('style');
  style.textContent=`
    #formula-ocr-dialog{width:min(720px,calc(100vw - 32px));border:0;border-radius:18px;padding:0;box-shadow:0 20px 70px #0004}
    #formula-ocr-dialog::backdrop{background:#0005;backdrop-filter:blur(2px)}
    .ocr-box{padding:22px}.ocr-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.ocr-head h2{margin:0}
    .ocr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.ocr-field{display:flex;flex-direction:column;gap:6px}.ocr-field label{font-size:12px;opacity:.72}.ocr-field select{min-height:36px;border-radius:9px;padding:0 10px}
    .ocr-mode{display:flex;gap:8px}.ocr-mode button{flex:1;min-height:36px}.ocr-mode button.active{font-weight:700;outline:2px solid color-mix(in srgb,currentColor 28%,transparent)}
    .ocr-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.ocr-actions button{min-height:36px}.ocr-actions .primary{font-weight:700}
    .ocr-status{padding:12px 14px;border-radius:12px;background:color-mix(in srgb,currentColor 6%,transparent);line-height:1.55}
    .ocr-note{opacity:.72;font-size:13px;line-height:1.55}.ocr-log{max-height:150px;overflow:auto;font-size:11px;white-space:pre-wrap;background:#111;color:#ddd;padding:10px;border-radius:10px}
    .ocr-results{display:grid;gap:8px;margin-top:12px;max-height:260px;overflow:auto}.ocr-result{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 10px;border-radius:10px;background:color-mix(in srgb,currentColor 5%,transparent)}
    .ocr-result code{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.ocr-result small{opacity:.62}.ocr-result button{min-height:30px}
  `;document.head.append(style);

  const dialog=document.createElement('dialog');dialog.id='formula-ocr-dialog';
  dialog.innerHTML=`<div class="ocr-box">
    <div class="ocr-head"><div><h2>图片公式识别</h2><div class="ocr-note">本地模型 · 按需安装 · 安装后可离线使用</div></div><button data-close>完成</button></div>
    <div class="ocr-grid">
      <div class="ocr-field"><label>识别模型</label><select data-engine><option value="pix2text">Pix2Text（轻量）</option><option value="unimernet">UniMERNet Tiny（高精度）</option></select></div>
      <div class="ocr-field"><label>图片类型</label><div class="ocr-mode"><button data-mode="single" class="active">单个公式</button><button data-mode="page">整页提取公式</button></div></div>
    </div>
    <p class="ocr-status" data-status>正在检查本地识别模型…</p>
    <div class="ocr-actions"><button class="primary" data-recognize disabled>选择图片并识别</button><button data-install>安装当前模型</button><button data-refresh>刷新状态</button></div>
    <p class="ocr-note" data-note>单个公式：直接把图片交给所选模型。整页提取：先用 MFD 1.5 只检测数学公式区域，忽略正文，再逐个识别为 LaTeX。</p>
    <div class="ocr-results" data-results hidden></div>
    <details><summary>安装/识别日志</summary><pre class="ocr-log" data-log>尚无日志</pre></details>
  </div>`;
  document.body.append(dialog);

  const status=dialog.querySelector('[data-status]');
  const recognize=dialog.querySelector('[data-recognize]');
  const install=dialog.querySelector('[data-install]');
  const log=dialog.querySelector('[data-log]');
  const engine=dialog.querySelector('[data-engine]');
  const results=dialog.querySelector('[data-results]');
  let mode='single';
  let lastStatus=null;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
    mode=btn.dataset.mode;
    dialog.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===btn));
    results.hidden=true;results.innerHTML='';
    updateState();
  });

  function engineInfo(){return lastStatus?.engines?.[engine.value]||{};}
  function updateState(){
    const info=engineInfo();
    const installed=!!info.installed;
    recognize.disabled=!installed||!!lastStatus?.busy||(mode==='page'&&!lastStatus?.detectorInstalled);
    install.disabled=!!lastStatus?.busy;
    const label=engine.value==='unimernet'?'UniMERNet Tiny':'Pix2Text';
    install.textContent=installed?'验证/修复 '+label:'安装 '+label;
    if(lastStatus?.busy){status.textContent='本地识别组件正在安装或识别，请稍后刷新状态。';return;}
    if(installed){
      status.textContent=`${label} 已安装 · 总占用约 ${fmt(lastStatus?.bytes||0)} · ${lastStatus?.detectorInstalled?'MFD 整页公式检测已就绪':'MFD 尚未就绪，请验证/修复当前模型'}`;
    }else if(lastStatus?.environmentExists){
      status.textContent=`${label} 尚未安装；现有 Python 识别环境可复用。`;
    }else if(lastStatus?.pythonAvailable){
      status.textContent=`${label} 尚未安装。首次安装会创建独立 Python 环境并按需下载模型。`;
    }else{
      status.textContent='未找到 Python 3。请先安装 Python 3（UniMERNet 建议 3.10+）。';
    }
  }

  async function refresh(){
    status.textContent='正在检查本地识别模型…';
    try{lastStatus=await request('ocrStatus');updateState();}
    catch(e){status.textContent=e.message;recognize.disabled=true;}
  }
  dialog.querySelector('[data-refresh]').onclick=refresh;
  engine.onchange=()=>{results.hidden=true;results.innerHTML='';updateState();};

  install.onclick=async()=>{
    install.disabled=true;recognize.disabled=true;results.hidden=true;
    const label=engine.value==='unimernet'?'UniMERNet Tiny':'Pix2Text';
    status.textContent=`正在安装 ${label}，同时准备 MFD 1.5 公式区域检测模型…`;
    try{
      const r=await request('ocrInstall',{engine:engine.value});
      if(r.log)log.textContent=r.log;
      status.textContent=r.message||'本地识别安装完成';
      await refresh();
    }catch(e){status.textContent=e.message;log.textContent=e.log||e.message;dialog.querySelector('details').open=true;}
    finally{install.disabled=false;}
  };

  function insertLatex(latex){
    if(typeof window.FormulaImport!=='function')throw new Error('编辑器尚未就绪');
    window.FormulaImport(latex,'tex');
  }
  function renderPageResults(formulas,engineLabel){
    results.innerHTML='';
    if(!formulas.length){results.hidden=true;status.textContent='整页检测完成，但没有检测到数学公式。';return;}
    formulas.forEach((item,index)=>{
      const row=document.createElement('div');row.className='ocr-result';
      const meta=Array.isArray(item.bbox)?`区域 ${item.bbox.map(Math.round).join(', ')}`:'';
      row.innerHTML=`<div><code></code><br><small>公式 ${index+1}${item.type?' · '+item.type:''}${meta?' · '+meta:''}</small></div><button>插入</button>`;
      row.querySelector('code').textContent=item.latex||'';
      row.querySelector('button').onclick=()=>{insertLatex(item.latex);status.textContent=`已将公式 ${index+1} 插入编辑器 · ${engineLabel}`;};
      results.append(row);
    });
    results.hidden=false;
    status.textContent=`检测到 ${formulas.length} 个公式 · ${engineLabel} · 可逐个插入编辑器`;
  }

  recognize.onclick=async()=>{
    recognize.disabled=true;results.hidden=true;results.innerHTML='';
    status.textContent=mode==='page'?'请选择整页教材/论文照片…':'请选择单个公式图片…';
    try{
      const r=await request('ocrRecognize',{engine:engine.value,mode});
      if(r.cancelled){status.textContent='已取消';return;}
      if(r.log)log.textContent=r.log;
      if(mode==='page'){
        renderPageResults(Array.isArray(r.formulas)?r.formulas:[],r.engine||engine.value);
      }else{
        if(!r.latex)throw new Error('没有识别到公式');
        insertLatex(r.latex);
        status.textContent=`识别完成 · ${r.engine||engine.value} · 已送入编辑器`;
        setTimeout(()=>dialog.close(),500);
      }
    }catch(e){status.textContent=e.message;log.textContent=e.log||e.message;dialog.querySelector('details').open=true;}
    finally{recognize.disabled=false;updateState();}
  };

  const imageTab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='图片识别');
  if(imageTab){imageTab.disabled=false;imageTab.title='本地图片公式识别';imageTab.onclick=()=>{dialog.showModal();refresh();};}
})();
