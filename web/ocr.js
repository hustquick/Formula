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
  let installPhase="";
  window.FormulaOCRInstallPhase=(message)=>{installPhase=message;status.textContent=message;};
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
    #formula-ocr-dialog{width:min(760px,calc(100vw - 32px));border:0;border-radius:18px;padding:0;box-shadow:0 20px 70px #0004}
    #formula-ocr-dialog::backdrop{background:#0005;backdrop-filter:blur(2px)}
    .ocr-box{padding:22px}.ocr-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.ocr-head h2{margin:0}
    .ocr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.ocr-field{display:flex;flex-direction:column;gap:6px}.ocr-field label{font-size:12px;opacity:.72}.ocr-field select{min-height:36px;border-radius:9px;padding:0 10px}
    .ocr-mode{display:flex;gap:8px}.ocr-mode button{flex:1;min-height:36px}.ocr-mode button.active{font-weight:700;outline:2px solid color-mix(in srgb,currentColor 28%,transparent)}
    .ocr-install-choices{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.ocr-install-choices label{display:inline-flex;gap:7px;align-items:center;min-height:36px;cursor:pointer}.ocr-install-choices label:has(input:disabled){opacity:.45;cursor:not-allowed}.ocr-install-choices input{appearance:none;width:18px;height:18px;border:2px solid currentColor;border-radius:50%;margin:0;display:grid;place-items:center;cursor:inherit}.ocr-install-choices input:checked::before{content:"";width:9px;height:9px;border-radius:50%;background:currentColor}.ocr-install-choices input:focus-visible{outline:2px solid #5689ff;outline-offset:3px}.ocr-install-arrow{opacity:.45;font-size:18px}.ocr-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.ocr-actions button{min-height:36px}.ocr-actions .primary{font-weight:700}
    .ocr-status{padding:12px 14px;border-radius:12px;background:color-mix(in srgb,currentColor 6%,transparent);line-height:1.55}
    .ocr-note{opacity:.72;font-size:13px;line-height:1.55}.ocr-log{max-height:150px;overflow:auto;font-size:11px;white-space:pre-wrap;background:#111;color:#ddd;padding:10px;border-radius:10px}
    .ocr-results{display:grid;gap:8px;margin-top:12px;max-height:310px;overflow:auto}.ocr-result{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,currentColor 5%,transparent);cursor:pointer}
    .ocr-result input[type=checkbox]{width:18px;height:18px;margin:0}.ocr-result .ocr-formula-preview{min-height:34px;display:flex;align-items:center;overflow:auto}.ocr-result .ocr-formula-preview svg{max-width:100%;height:auto}.ocr-result small{opacity:.62;display:block;margin-top:4px}.ocr-result.selected{outline:2px solid color-mix(in srgb,currentColor 22%,transparent)}
  `;document.head.append(style);

  const dialog=document.createElement('dialog');dialog.id='formula-ocr-dialog';
  dialog.innerHTML=`<div class="ocr-box">
    <div class="ocr-head"><div><h2>图片公式识别</h2><div class="ocr-note">本地模型 · 按需安装 · 安装后可离线使用</div></div><button data-close>完成</button></div>
    <div class="ocr-grid">
      <div class="ocr-field"><label>识别能力</label><select data-engine><option value="pix2text">基础识别（Pix2Text）</option><option value="unimernet">专业识别（UniMERNet Tiny）</option></select></div>
      <div class="ocr-field"><label>图片类型</label><div class="ocr-mode"><button data-mode="single" class="active">单个公式</button><button data-mode="page">整页提取公式</button></div></div>
    </div>
    <div class="ocr-install-choices" role="group" aria-label="安装版本层级"><label><input type="checkbox" data-basic-install>基础版（Pix2Text）</label><span class="ocr-install-arrow" aria-hidden="true">→</span><label><input type="checkbox" data-pro-install>专业版（UniMERNet Tiny）</label></div>
    <p class="ocr-status" data-status>正在检查本地识别模型…</p>
    <div class="ocr-actions"><button class="primary" data-recognize disabled>选择图片并识别</button><button data-install>安装基础版</button><button data-refresh>刷新状态</button></div>
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
  const basicChoice=dialog.querySelector('[data-basic-install]');
  const proChoice=dialog.querySelector('[data-pro-install]');
  function syncInstallChoices(){
    // Pro implies Basic; the parent remains selected and locked while Pro is selected.
    if(proChoice.checked)basicChoice.checked=true;
    basicChoice.disabled=proChoice.checked;
    const basicInstalled=!!lastStatus?.engines?.pix2text?.installed;
    const proInstalled=!!lastStatus?.engines?.unimernet?.installed;
    const requested=proChoice.checked?'unimernet':basicChoice.checked?'pix2text':null;
    const installed=requested==='unimernet'?proInstalled:basicInstalled;
    install.disabled=!!lastStatus?.busy||!requested;
    install.textContent=!requested?'选择安装版本':installed?'已安装 · 验证/修复':requested==='unimernet'?(basicInstalled?'升级至专业版':'安装专业版'):'安装基础版';
    install.dataset.installEngine=requested||'';
  }
  basicChoice.addEventListener('change',syncInstallChoices);
  proChoice.addEventListener('change',syncInstallChoices);
  basicChoice.checked=true;
  let mode='single';
  let lastStatus=null;
  let pageFormulas=[];
  const selected=new Set();
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
    mode=btn.dataset.mode;
    dialog.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===btn));
    pageFormulas=[];selected.clear();results.hidden=true;results.innerHTML='';
    updateState();
  });

  function engineInfo(){return lastStatus?.engines?.[engine.value]||{};}
  function updateState(){
    const info=engineInfo();
    const installed=!!info.installed;
    recognize.disabled=!installed||!!lastStatus?.busy||(mode==='page'&&!lastStatus?.detectorInstalled);
    install.disabled=!!lastStatus?.busy;
    const enhanced=engine.value==='unimernet';
    const label=enhanced?'专业识别（UniMERNet Tiny）':'基础识别（Pix2Text）';
    syncInstallChoices();
    if(lastStatus?.busy){status.textContent='识别组件正在执行任务；安装阶段可在当前窗口查看。';return;}
    if(installed){
      status.textContent=`${label} 已安装 · 总占用约 ${fmt(lastStatus?.bytes||0)} · ${lastStatus?.detectorInstalled?'MFD 整页公式检测已就绪':'MFD 尚未就绪，请验证/修复识别组件'}`;
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
  engine.onchange=()=>{pageFormulas=[];selected.clear();results.hidden=true;results.innerHTML='';updateState();};

  install.onclick=async()=>{
    install.disabled=true;recognize.disabled=true;results.hidden=true;
    const installEngine=install.dataset.installEngine;
    if(!installEngine)return;
    const enhanced=installEngine==='unimernet';
    const label=enhanced?'专业版':'基础版';
    const startedAt=Date.now();
    const ticker=setInterval(()=>{if(installPhase)status.textContent=`${installPhase} · 已等待 ${Math.floor((Date.now()-startedAt)/1000)} 秒（尚无法获取准确下载百分比）`;},1000);
    status.textContent=enhanced?'正在安装专业版：自动包含基础版，再安装 UniMERNet Tiny…':'正在安装基础版：准备 Pix2Text 与 MFD 公式检测…';
    try{
      const r=await request('ocrInstall',{engine:installEngine});
      if(r.log)log.textContent=r.log;
      status.textContent=r.message||`${label}安装完成`;
      await refresh();
    }catch(e){status.textContent=e.message;log.textContent=e.log||e.message;dialog.querySelector('details').open=true;}
    finally{clearInterval(ticker);installPhase="";install.disabled=false;}
  };

  function insertLatex(latex){
    if(typeof window.FormulaImport!=='function')throw new Error('编辑器尚未就绪');
    window.FormulaImport(latex,'tex');
  }
  function normalizeFormula(latex){
    let s=String(latex||'').trim();
    if(s.startsWith('$$')&&s.endsWith('$$'))s=s.slice(2,-2).trim();
    else if(s.startsWith('$')&&s.endsWith('$'))s=s.slice(1,-1).trim();
    else if((s.startsWith('\\[')&&s.endsWith('\\]'))||(s.startsWith('\\(')&&s.endsWith('\\)')))s=s.slice(2,-2).trim();
    return s;
  }
  function selectedLatex(){
    const picked=pageFormulas.map((item,index)=>selected.has(index)?normalizeFormula(item.latex):'').filter(Boolean);
    if(!picked.length)return '';
    if(picked.length===1)return picked[0];
    return `\\begin{gathered}\n${picked.join('\\\\[0.6em]\n')}\n\\end{gathered}`;
  }
  function clearEditor(){
    const source=document.getElementById('source');
    if(source){source.value='';source.dispatchEvent(new Event('input',{bubbles:true}));return;}
    if(typeof window.FormulaImport==='function')window.FormulaImport('\\text{}','tex');
  }
  function syncSelection(engineLabel){
    const latex=selectedLatex();
    if(latex)insertLatex(latex);else clearEditor();
    const count=selected.size;
    status.textContent=count?`已选择 ${count} 个公式 · 已同步到输入与输出预览 · ${engineLabel}`:'当前未选择公式 · 已清空本次识别结果';
  }
  async function renderFormulaPreview(target,latex){
    target.textContent='正在生成公式预览…';
    try{
      if(!window.MathJax?.tex2svgPromise)throw new Error('MathJax unavailable');
      await window.MathJax.startup?.promise;
      const node=await window.MathJax.tex2svgPromise(normalizeFormula(latex),{display:false});
      const svg=node.querySelector('svg');
      if(!svg)throw new Error('No SVG');
      target.replaceChildren(svg.cloneNode(true));
    }catch{target.textContent='公式预览暂不可用';}
  }
  function renderPageResults(formulas,engineLabel){
    results.innerHTML='';pageFormulas=formulas;selected.clear();
    if(!formulas.length){results.hidden=true;status.textContent='整页检测完成，但没有检测到数学公式。';return;}
    formulas.forEach((item,index)=>{
      const row=document.createElement('label');row.className='ocr-result';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.formulaIndex=String(index);
      const body=document.createElement('div');
      const preview=document.createElement('div');preview.className='ocr-formula-preview';
      const meta=document.createElement('small');meta.textContent=`公式 ${index+1}${item.type?' · '+item.type:''}`;
      body.append(preview,meta);row.append(checkbox,body);results.append(row);
      renderFormulaPreview(preview,item.latex||'');
      checkbox.onchange=()=>{
        if(checkbox.checked)selected.add(index);else selected.delete(index);
        row.classList.toggle('selected',checkbox.checked);
        syncSelection(engineLabel);
      };
    });
    results.hidden=false;
    status.textContent=`检测到 ${formulas.length} 个公式 · 请直接勾选需要的公式；勾选即同步，取消即移除`;
  }

  recognize.onclick=async()=>{
    recognize.disabled=true;results.hidden=true;results.innerHTML='';pageFormulas=[];selected.clear();
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
    finally{recognize.disabled=false;}
  };

  const imageTab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='图片识别');
  if(imageTab){imageTab.disabled=false;imageTab.title='本地图片公式识别';imageTab.onclick=()=>{dialog.showModal();refresh();};}
})();
