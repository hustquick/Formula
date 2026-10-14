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
  window.FormulaOCRInstallPhase=(message)=>{installPhase=message;installStatus.textContent=message;};
  window.FormulaOCRInstallLog=(text)=>{log.textContent=text;log.scrollTop=log.scrollHeight;const matches=[...text.matchAll(/(\d+(?:\.\d+)?)%/g)];if(matches.length){installProgress.value=Number(matches.at(-1)[1]);}else{installProgress.removeAttribute("value");}};
  function request(action,data={}){
    return new Promise((resolve,reject)=>{
      const id='ocr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const timeout=action==='ocrStatus'?15000:['ocrInstall','ocrDocumentInstall'].includes(action)?150*60*1000:action==='ocrDocument'?210*60*1000:12*60*1000;
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
    .tool-deck.show-recognition{display:block!important;height:100px;overflow:auto}
    .tool-deck.show-recognition>*:not(#formula-ocr-dialog){display:none!important}
    #formula-ocr-dialog{width:auto;margin:0;border:0;border-radius:0;padding:0;box-shadow:none;background:transparent}
    #formula-ocr-dialog[hidden]{display:none!important}
    #formula-ocr-dialog .ocr-box{padding:8px 16px;display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px}
    #formula-ocr-dialog .ocr-head{display:none}
    #formula-ocr-dialog .ocr-grid{display:flex;align-items:center;gap:12px;margin:0}
    #formula-ocr-dialog .ocr-field{gap:2px}
    #formula-ocr-dialog .ocr-field label{display:none}
    #formula-ocr-dialog .ocr-field select,#formula-ocr-dialog .ocr-mode button,#formula-ocr-dialog .ocr-actions button{min-height:28px;height:28px;font-size:12px;padding:0 9px;border-radius:5px}
    #formula-ocr-dialog .ocr-mode{flex-shrink:0}
    #formula-ocr-dialog .ocr-mode button{flex:0 0 auto;white-space:nowrap;min-width:82px}
    #formula-ocr-dialog .ocr-mode button[data-mode="page"]{min-width:112px}
    #formula-ocr-dialog .ocr-actions{margin:0;gap:6px}
    #formula-ocr-dialog .ocr-status{order:2;flex:1 1 65%;margin:0;padding:3px 0;background:transparent;font-size:11px;border-radius:0}
    #formula-ocr-dialog .ocr-advanced{order:3;font-size:11px;margin-left:auto}
    #formula-ocr-dialog .ocr-advanced[open]{flex-basis:100%;margin:0}
    #formula-ocr-dialog .ocr-results{order:4;flex-basis:100%;margin:0}
    #formula-ocr-dialog [data-document-options]{font-size:11px}
    #formula-ocr-dialog [data-document-options] .ocr-note{display:none}
    #formula-ocr-dialog [data-word-install]{font-size:11px;padding:3px 6px}

    #formula-ocr-dialog .ocr-box{height:100%;min-height:92px;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:30px 28px;align-content:start;gap:6px 12px;padding:8px 12px;position:relative}
    #formula-ocr-dialog .ocr-grid{grid-column:1;grid-row:1;min-width:0}
    #formula-ocr-dialog .ocr-actions{grid-column:2;grid-row:1;flex-wrap:nowrap;position:relative;z-index:2}
    #formula-ocr-dialog .ocr-status{grid-column:1;grid-row:2;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:28px;padding:0}
    #formula-ocr-dialog .ocr-advanced{grid-column:2;grid-row:2;margin:0;justify-self:end;align-self:center}
    #formula-ocr-dialog .ocr-advanced[open]{position:absolute;z-index:5;right:12px;top:42px;width:min(560px,calc(100% - 24px));max-height:180px;overflow:auto;padding:8px 12px;background:white;border:1px solid #dce3ed;border-radius:6px;margin:0}
    #formula-ocr-dialog .ocr-mode{gap:0;height:28px;padding:2px;background:#eef2f8;border-radius:5px}
    #formula-ocr-dialog .ocr-mode button,#formula-ocr-dialog .ocr-mode button[data-mode="page"]{width:108px;min-width:108px;height:24px;min-height:24px;outline:0;border:0;border-radius:4px;box-shadow:none;font-weight:400;background:transparent;padding:0 8px}
    #formula-ocr-dialog .ocr-mode button.active{background:#e2ecff;color:#2466dc;outline:0;box-shadow:none}
    #formula-ocr-dialog .ocr-mode button:hover{background:#e6ebf3}
    #formula-ocr-dialog .ocr-results{grid-column:1/-1;grid-row:3;max-height:150px;min-height:0;position:relative;overflow:auto}
    #formula-ocr-dialog [data-document-options]{grid-column:1;grid-row:1;display:flex;align-items:center;gap:8px}
    #formula-ocr-dialog [data-document-options][hidden]{display:none}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-box{grid-template-rows:28px 24px 24px}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) [data-document-options]{grid-row:2}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-status,#formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-advanced{grid-row:3}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-results{grid-row:4}
    #formula-ocr-dialog .ocr-log{background:#f7f8fa;color:#53627a;border:1px solid #e0e5ed;border-radius:5px;max-height:100px}

    #formula-ocr-dialog .ocr-status,#formula-ocr-dialog .ocr-advanced{display:none!important}
    #formula-ocr-dialog .ocr-box{grid-template-rows:28px minmax(0,1fr);min-height:92px;gap:4px 12px}
    #formula-ocr-dialog .ocr-results{grid-row:2;margin:0;max-height:180px}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-box{grid-template-rows:28px 24px minmax(0,1fr)}
    #formula-ocr-dialog:has([data-document-options]:not([hidden])) .ocr-results{grid-row:3}

    .ocr-settings-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0}
    .ocr-settings-controls [data-install-panel]{flex-basis:100%}
    #ocr-diagnostic-log{max-height:220px;overflow:auto;white-space:pre-wrap;background:#f7f8fa;color:#53627a;padding:10px;border:1px solid #e0e5ed;border-radius:5px}

    #formula-ocr-dialog{width:100%;height:100%}
    #formula-ocr-dialog .ocr-box{width:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;height:100%;min-height:92px;padding:4px 8px;gap:2px}
    #formula-ocr-dialog .ocr-actions{order:0;align-self:flex-end;width:fit-content;margin-left:auto;display:flex;align-items:center;gap:8px;flex:none;min-height:26px;z-index:1}
    #formula-ocr-dialog .ocr-actions button{background:transparent;border:0;box-shadow:none;color:#53627a;padding:2px 6px;height:26px;min-height:26px;font-weight:400}
    #formula-ocr-dialog .ocr-actions button:hover{background:#edf2f8}
    #formula-ocr-dialog .ocr-results{order:1;flex:1;min-height:0;max-height:none;width:100%;margin:0;overflow:auto}
    .ocr-recognition-progress{width:72px;height:3px;appearance:none;opacity:.25}
    .ocr-recognition-progress.busy{opacity:1}
    .ocr-recognition-progress::-webkit-progress-bar{background:#e2e8f0;border-radius:2px}
    .ocr-recognition-progress::-webkit-progress-value{background:#3976ec;border-radius:2px}
    .ocr-settings-controls .ocr-grid{display:flex;flex-wrap:wrap;gap:12px;width:100%;margin:8px 0}
    .ocr-settings-controls .ocr-mode{display:flex;gap:0}
    .ocr-settings-controls .ocr-mode button{height:28px;min-width:100px;padding:3px 10px;outline:0;border:0;box-shadow:none;background:transparent;font-weight:400}
    .ocr-settings-controls .ocr-mode button.active{background:#e2ecff;color:#2466dc;outline:0}
    .ocr-settings-controls [data-document-options]{display:flex;gap:8px;flex-wrap:wrap;width:100%}
    .ocr-settings-controls [hidden]{display:none!important}

    #formula-ocr-dialog .ocr-box{display:grid;grid-template-columns:minmax(0,1fr) 148px;grid-template-rows:minmax(0,1fr);flex-wrap:nowrap;height:100%;min-height:92px;padding:4px 8px;gap:8px;align-items:stretch}
    #formula-ocr-dialog .ocr-actions{grid-column:2;grid-row:1;width:148px;height:88px;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;align-self:start;gap:5px;margin:0;background:transparent;border:0;padding:0}
    #formula-ocr-dialog .ocr-actions [data-recognize]{height:24px;min-height:24px;padding:2px 6px;max-width:100%;white-space:nowrap}
    #formula-ocr-dialog .ocr-recognition-progress{display:block;flex:none;width:88px;height:2px;margin:0;opacity:.3}
    #formula-ocr-dialog .ocr-recognition-progress.busy{opacity:1}
    #formula-ocr-dialog .ocr-input-confirmation{width:148px;height:42px;display:flex;align-items:flex-start;justify-content:flex-end;overflow:hidden;font-size:11px;color:#64748b;text-align:right}
    #formula-ocr-dialog .ocr-input-confirmation img{display:block;max-width:64px;max-height:40px;width:auto;height:auto;object-fit:contain;border-radius:3px}
    #formula-ocr-dialog .ocr-input-confirmation span{max-width:148px;white-space:nowrap;line-height:20px}
    #formula-ocr-dialog .ocr-results{grid-column:1;grid-row:1;width:100%;height:100%;min-height:0;max-height:none;overflow:auto;margin:0;align-content:start}
    #formula-ocr-dialog .ocr-actions [data-cancel-document]{height:18px;min-height:18px;padding:0 4px;font-size:10px}
  `;document.head.append(style);

  const dialog=document.createElement('section');dialog.id='formula-ocr-dialog';
  dialog.innerHTML=`<div class="ocr-box">
    <div class="ocr-head" hidden><h2 data-title>图片公式识别</h2></div>
    <div class="ocr-grid">
      <div class="ocr-field"><label>识别能力</label><select data-engine><option value="pix2text">基础识别（Pix2Text）</option><option value="unimernet">专业识别（UniMERNet Tiny）</option></select></div>
      <div class="ocr-field"><label>图片类型</label><div class="ocr-mode segmented" role="radiogroup" aria-label="图片识别模式"><button data-mode="single" role="radio" aria-checked="true" class="active">单个公式</button><button data-mode="page" role="radio" aria-checked="false">整页提取公式</button></div></div>
    </div>
    <div data-document-options hidden><label>PDF 起始页 <input data-first type="number" min="1" value="1" style="width:70px"></label> <label>结束页 <input data-last type="number" min="0" value="0" style="width:70px"></label><p class="ocr-note">结束页填 0：从起始页处理最多 20 页。Word 按文档顺序提取原生公式及图片中的公式，页码不适用。仅提取公式，不转换正文。</p><button data-word-install>安装 Word 解析组件</button></div>
    <div class="ocr-install-choices" role="group" aria-label="安装版本层级"><label><input type="checkbox" data-basic-install>基础版（Pix2Text）</label><span class="ocr-install-arrow" aria-hidden="true">→</span><label><input type="checkbox" data-pro-install>专业版（UniMERNet Tiny）</label></div>
    <p class="ocr-status" data-status>正在检查本地识别模型…</p>
    <div class="ocr-actions"><button class="primary" data-recognize disabled>选择图片</button><button data-install>安装基础版</button><button data-cancel-install hidden>取消安装</button><button data-refresh>刷新状态</button><button data-cancel-document hidden>取消识别</button></div>
    <div data-install-panel hidden><progress data-install-progress max="100" aria-label="当前下载步骤进度"></progress><span class="ocr-note" data-install-status aria-live="polite"></span></div>
    <div class="ocr-results" data-results hidden></div>
    <details><summary>安装/识别日志</summary><pre class="ocr-log" data-log>尚无日志</pre></details>
  </div>`;
  dialog.hidden=true;document.querySelector('.tool-deck').append(dialog);

  const advanced=document.createElement('details');advanced.className='ocr-advanced';
  const summary=document.createElement('summary');summary.textContent='查看详情';advanced.append(summary);
  advanced.append(dialog.querySelector('.ocr-install-choices'),dialog.querySelector('[data-install-panel]'),dialog.querySelector('details'));
  const advancedActions=document.createElement('div');advancedActions.className='ocr-actions';
  for(const key of ['refresh'])advancedActions.append(dialog.querySelector('[data-'+key+']'));
  advanced.insertBefore(advancedActions,advanced.children[2]);dialog.querySelector('.ocr-box').append(advanced);
  // Install/configuration is owned by Settings, not the recognition workspace.
  const settingsHost=document.getElementById('ocr-module-controls');
  if(settingsHost){
    const installControls=document.createElement('div');installControls.className='ocr-settings-controls';
    for(const selector of ['.ocr-install-choices','[data-install]','[data-refresh]','[data-cancel-install]','[data-install-panel]','[data-word-install]','[data-status]','.ocr-grid','[data-document-options]']){const node=dialog.querySelector(selector);if(node)installControls.append(node);}
    settingsHost.append(installControls);
    const diagnostic=document.getElementById('ocr-diagnostic-log'),originalLog=dialog.querySelector('[data-log]');
    diagnostic.replaceWith(originalLog);originalLog.id='ocr-diagnostic-log';advanced.remove();
  }
  const find=selector=>dialog.querySelector(selector)||settingsHost?.querySelector(selector)||document.querySelector('#ocr-diagnostic-log'+(selector==='[data-log]'?'':' [data-never]'));
  const status=find('[data-status]');
  const recognize=dialog.querySelector('[data-recognize]');
  const recognitionProgress=document.createElement('progress');recognitionProgress.className='ocr-recognition-progress';recognitionProgress.max=100;recognitionProgress.value=0;recognitionProgress.setAttribute('aria-label','识别进度');recognize.after(recognitionProgress);
  const confirmation=document.createElement('div');confirmation.className='ocr-input-confirmation';recognitionProgress.after(confirmation);
  const shortName=name=>{const clean=String(name||'').split(/[\\/]/).at(-1);if(clean.length<=24)return clean;const dot=clean.lastIndexOf('.'),ext=dot>0?clean.slice(dot):'',base=dot>0?clean.slice(0,dot):clean;return base.slice(0,10)+'…'+base.slice(-Math.max(4,12-ext.length))+ext;};
  const confirmedInputs={};
  window.FormulaOCRInput=(id,input)=>{if(id&&!pending.has(id))return;confirmedInputs[input.kind]=input;confirmation.replaceChildren();confirmation.title=String(input.name||'').split(/[\\/]/).at(-1);if(input.kind==='document'){const name=document.createElement('span');name.textContent=shortName(input.name);confirmation.append(name);}else{const image=document.createElement('img');image.alt='所选图片';image.onerror=()=>{confirmation.textContent='▧';};if(input.thumbnail){image.src=input.thumbnail;if(input.thumbnail.startsWith('blob:'))image.onload=()=>{const canvas=document.createElement('canvas'),factor=Math.min(1,128/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);confirmedInputs.image={...input,thumbnail:canvas.toDataURL('image/png')};URL.revokeObjectURL(input.thumbnail);};}else{confirmation.textContent='▧';return;}confirmation.append(image);}};
  const setRecognitionProgress=active=>{recognitionProgress.classList.toggle('busy',active);if(active)recognitionProgress.removeAttribute('value');else recognitionProgress.value=0;};

  const install=find('[data-install]');
  const log=find('[data-log]');
  const cancelInstall=find('[data-cancel-install]');
  const installPanel=find('[data-install-panel]');
  const installStatus=find('[data-install-status]');
  const installProgress=find('[data-install-progress]');
  const engine=find('[data-engine]');
  const results=dialog.querySelector('[data-results]');
  function showRecognitionFailure(){results.hidden=false;results.replaceChildren();const failure=document.createElement('div');failure.className='ocr-failure';failure.textContent='识别失败 ';const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>recognize.click();failure.append(retry);results.append(failure);}

  const basicChoice=find('[data-basic-install]');
  const proChoice=find('[data-pro-install]');
  function syncInstallChoices(){
    // Pro implies Basic; the parent remains selected and locked while Pro is selected.
    if(proChoice.checked)basicChoice.checked=true;
    basicChoice.disabled=proChoice.checked;
    const basicInstalled=!!lastStatus?.engines?.pix2text?.installed;
    const proInstalled=!!lastStatus?.engines?.unimernet?.installed;
    const requested=proChoice.checked?'unimernet':basicChoice.checked?'pix2text':null;
    const installed=requested==='unimernet'?proInstalled:basicInstalled;
    install.hidden=false;install.disabled=!!lastStatus?.busy||!requested;
    install.textContent=!requested?'选择安装版本':installed?'已安装 · 验证/修复':requested==='unimernet'?(basicInstalled?'升级至专业版':'安装专业版'):'安装基础版';
    install.dataset.installEngine=requested||'';
  }
  basicChoice.addEventListener('change',syncInstallChoices);
  proChoice.addEventListener('change',syncInstallChoices);
  basicChoice.checked=true;
  let preferences={};try{preferences=JSON.parse(localStorage.getItem('formula-ocr-preferences')||'{}');}catch{}
  engine.value=['pix2text','unimernet'].includes(preferences.engine)?preferences.engine:'pix2text';
  let mode=preferences.mode==='page'?'page':'single';
  const savePreferences=()=>{try{localStorage.setItem('formula-ocr-preferences',JSON.stringify({engine:engine.value,mode,first:find('[data-first]').value,last:find('[data-last]').value}));}catch{}};
  if(preferences.first)find('[data-first]').value=preferences.first;if(preferences.last)find('[data-last]').value=preferences.last;
  for(const input of [find('[data-first]'),find('[data-last]')])input.addEventListener('change',savePreferences);
  if(settingsHost){
    engine.hidden=true;const group=document.createElement('div');group.className='segmented ocr-module-mode';group.setAttribute('role','radiogroup');group.setAttribute('aria-label','当前识别模块');
    for(const [value,label] of [['pix2text','基础识别'],['unimernet','专业识别']]){const button=document.createElement('button');button.type='button';button.dataset.ocrModule=value;button.textContent=label;button.setAttribute('role','radio');button.onclick=()=>{engine.value=value;engine.dispatchEvent(new Event('change'));};group.append(button);}engine.after(group);
    const label=document.createElement('label');label.textContent='当前识别模块';group.before(label);const method=document.createElement('label');method.textContent='识别方式';find('.ocr-mode').before(method);
  }

  let documentMode=false;
  const wordInstall=find('[data-word-install]');
  const cancelDocument=dialog.querySelector('[data-cancel-document]');
  let lastStatus=null;
  let pageFormulas=[];
  let recognizing=false;
  const selected=new Set();

  (settingsHost||dialog).querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
    mode=btn.dataset.mode;savePreferences();
    (settingsHost||dialog).querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x===btn);x.setAttribute('aria-checked',String(x===btn));});
    pageFormulas=[];selected.clear();results.hidden=true;results.innerHTML='';
    updateState();
  });

  function engineInfo(){return lastStatus?.engines?.[engine.value]||{};}
  function updateState(preserveStatus=false){
    const info=engineInfo();
    for(const option of engine.options){const available=!!lastStatus?.engines?.[option.value]?.installed;option.style.color=available?'#111827':'#a0a7b3';option.dataset.installed=String(available);}
    for(const button of document.querySelectorAll('[data-ocr-module]')){const chosen=button.dataset.ocrModule===engine.value;button.disabled=recognizing;button.classList.toggle('active',chosen);button.setAttribute('aria-checked',String(chosen));}
    engine.style.color=info.installed?'#111827':'#a0a7b3';engine.title=info.installed?'识别模块已安装':'识别模块未安装，可在设置 → 高级 → OCR 模块安装';

    const installed=!!info.installed;
    recognize.disabled=recognizing||!installed||(!!lastStatus?.busy&&!lastStatus?.installing)||(!!lastStatus?.installing&&(engine.value!=='pix2text'||lastStatus.installingEngine==='pix2text'))||((mode==='page'||documentMode)&&!lastStatus?.detectorInstalled);
    wordInstall.disabled=!!lastStatus?.busy||recognizing;
    wordInstall.textContent=lastStatus?.documentInstalled?'Word 组件已安装 · 验证/修复':'安装 Word 解析组件';
    install.disabled=!!lastStatus?.busy;
    const enhanced=engine.value==='unimernet';
    const label=enhanced?'专业识别（UniMERNet Tiny）':'基础识别（Pix2Text）';
    syncInstallChoices();

    for(const button of (settingsHost||dialog).querySelectorAll('[data-mode]')){button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-checked',String(button.dataset.mode===mode));}
    if(preserveStatus)return;
    if(lastStatus?.busy){status.textContent=lastStatus.installing?(lastStatus.installingEngine==='pix2text'?'基础识别正在安装或修复。':'专业版安装期间，已安装的基础识别仍可使用。'):'识别组件正在执行任务。';return;}
    if(installed){
      status.title=`${label} 已安装 · ${lastStatus?.bytesCalculating&& !lastStatus?.bytes ? "正在统计占用空间" : "总占用约 "+fmt(lastStatus?.bytes||0)} · ${lastStatus?.detectorInstalled?'MFD 整页公式检测已就绪':'MFD 尚未就绪，请验证/修复识别组件'}`;
    status.textContent='公式识别组件：已就绪'+((mode==='page'||documentMode)&&!lastStatus?.detectorInstalled?' · 整页检测待修复':'');
    }else if(lastStatus?.environmentExists){
      status.textContent='公式识别组件尚未安装';
    }else if(lastStatus?.pythonAvailable){
      status.textContent='公式识别组件尚未安装';
    }else{
      status.textContent='未找到兼容的 Python 3.10–3.12，请安装 Python 3.11 后重试。';
    }
  }

  async function refresh(){
    status.textContent='正在检查本地识别模型…';
    try{lastStatus=await request('ocrStatus');updateState();}
    catch(e){status.textContent=e.message;recognize.disabled=true;}
  }
  find('[data-refresh]').onclick=refresh;
  engine.onchange=()=>{savePreferences();pageFormulas=[];selected.clear();results.hidden=true;results.innerHTML='';updateState();};

  cancelInstall.onclick=async()=>{
    cancelInstall.disabled=true;
    installStatus.textContent="正在取消安装并结束当前下载进程…";
    try{await request("ocrCancelInstall");}catch(e){status.textContent=e.message;}
  };

  install.onclick=async()=>{
    const installEngine=install.dataset.installEngine;
    if(!installEngine)return;
    lastStatus={...lastStatus,busy:true,installing:true,installingEngine:installEngine};
    updateState(true);install.disabled=true;results.hidden=true;
    cancelInstall.hidden=false;cancelInstall.disabled=false;installPanel.hidden=false;installProgress.removeAttribute("value");installPhase="";
    const enhanced=installEngine==='unimernet';
    const label=enhanced?'专业版':'基础版';
    const startedAt=Date.now();
    const statePoll=setInterval(async()=>{try{lastStatus=await request('ocrStatus');updateState(true);}catch{}},3000);
    const ticker=setInterval(()=>{if(installPhase)installStatus.textContent=`${installPhase} · 已等待 ${Math.floor((Date.now()-startedAt)/1000)} 秒（尚无法获取准确下载百分比）`;},1000);
    status.textContent='正在安装识别组件…';
    try{
      const r=await request('ocrInstall',{engine:installEngine});
      if(r.log)log.textContent=r.log;
      status.textContent=r.message||`${label}安装完成`;
    }catch(e){status.textContent=/页码无效|用户已取消/.test(e.message)?e.message:'操作失败，请重试或查看详情';status.title=e.message;log.textContent=e.log||e.message;log.parentElement.open=false;advanced.open=false;if(recognizing)showRecognitionFailure();}
    finally{clearInterval(ticker);clearInterval(statePoll);installPhase="";installPanel.hidden=true;cancelInstall.hidden=true;install.disabled=false;try{lastStatus=await request("ocrStatus");updateState(true);}catch{}}
  };

  function insertLatex(latex){
    if(typeof window.FormulaImport!=='function')throw new Error('编辑器尚未就绪');
    window.FormulaImport((window.FormulaFormatLatex||formatRecognizedLatex)(latex),'tex');
  }
  function formatRecognizedLatex(latex){
    const input=String(latex||'');
    // Preserve comments/verbatim and single-line formulas; only recognized multiline environments.
    if(/%|\\verb|\\begin\{(?:verbatim|lstlisting)\}/.test(input))return input;
    const environments=new Set(['aligned','align','align*','gathered','gather','gather*','cases','matrix','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix','smallmatrix','array']);
    let out='',depth=0,braces=0;
    const newline=()=>{out=out.replace(/[ \t]+$/,'');if(!out.endsWith('\n'))out+='\n';out+='  '.repeat(depth);};
    for(let i=0;i<input.length;){
      const env=input.slice(i).match(/^\\(begin|end)\{([^}]+)\}/);
      if(env&&environments.has(env[2])){
        if(env[1]==='end'){depth=Math.max(0,depth-1);newline();out+=env[0];}
        else{out+=env[0];i+=env[0].length;
          // Array column specification belongs on the begin line.
          if(env[2]==='array'){const columns=input.slice(i).match(/^\s*\{[^{}]*\}/);if(columns){out+=columns[0];i+=columns[0].length;}}
          depth++;newline();continue;
        }
        i+=env[0].length;continue;
      }
      if(input[i]==='\\'){
        if(input[i+1]==='\\'&&depth&&braces===0){out+='\\\\';i+=2;
          const spacing=input.slice(i).match(/^\s*(?:\*)?(?:\[[^\]]*\])?/);if(spacing){out+=spacing[0].trim();i+=spacing[0].length;}
          newline();continue;
        }
        const command=input.slice(i).match(/^\\(?:[A-Za-z]+|.)/);if(command){out+=command[0];i+=command[0].length;continue;}
      }
      const ch=input[i++];if(ch==='{')braces++;if(ch==='}')braces=Math.max(0,braces-1);
      if(depth&&/\s/.test(ch)&&out.endsWith('\n'+'  '.repeat(depth)))continue;
      out+=ch;
    }
    return out;
  }
  window.FormulaFormatRecognizedLatex=formatRecognizedLatex;
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
      // MathJax 4 may emit several SVG fragments for one inline formula.
      target.replaceChildren(node.cloneNode(true));
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
      const meta=document.createElement('small');meta.textContent=`公式 ${index+1}${item.source?' · '+item.source:item.type?' · '+item.type:''}`;
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
    recognizing=true;setRecognitionProgress(true);recognize.disabled=true;const requestDocument=documentMode;const requestMode=documentMode?'page':mode;const requestEngine=engine.value;engine.disabled=true;document.querySelectorAll('[data-ocr-module]').forEach(button=>button.disabled=true);(settingsHost||dialog).querySelectorAll('[data-mode]').forEach(x=>x.disabled=true);results.hidden=true;results.innerHTML='';pageFormulas=[];selected.clear();
    wordInstall.disabled=true;cancelDocument.hidden=!requestDocument;cancelDocument.disabled=false;
    status.textContent=requestDocument?'请选择 PDF 或 Word 文档…':mode==='page'?'请选择整页教材/论文照片…':'请选择单个公式图片…';
    try{
      const first=Number(find('[data-first]').value),last=Number(find('[data-last]').value);
      if(requestDocument&&(!Number.isInteger(first)||first<1||!Number.isInteger(last)||last<0||(last>0&&(last<first||last-first>=20))))throw new Error('PDF 页码无效，每次最多识别 20 页。');
      const r=await request(requestDocument?'ocrDocument':'ocrRecognize',{engine:requestEngine,mode:requestMode,first,last});
      if(r.cancelled){status.textContent='已取消';return;}
      if(r.log)log.textContent=r.log;
      if(requestMode==='page'){
        renderPageResults(Array.isArray(r.formulas)?r.formulas:[],r.engine||engine.value);
        if(requestDocument){status.textContent=(r.sourceName?r.sourceName+' · ':'')+status.textContent;if(r.warnings?.length){status.textContent+=' · '+r.warnings.join(' ');log.textContent=r.warnings.join('\n')+'\n'+(r.log||'');}}
      }else{
        if(!r.latex)throw new Error('没有识别到公式');
        renderPageResults([{latex:r.latex}],r.engine||engine.value);insertLatex(r.latex);const first=results.querySelector('input');if(first){first.checked=true;selected.add(0);}
        status.textContent=`识别完成 · ${r.engine||engine.value} · 已送入编辑器`;

      }
    }catch(e){status.textContent=/页码无效|用户已取消/.test(e.message)?e.message:'操作失败，请重试或查看详情';status.title=e.message;log.textContent=e.log||e.message;log.parentElement.open=false;advanced.open=false;if(recognizing)showRecognitionFailure();}
    finally{cancelDocument.hidden=true;recognizing=false;setRecognitionProgress(false);engine.disabled=false;(settingsHost||dialog).querySelectorAll('[data-mode]').forEach(x=>x.disabled=false);const outcome=status.textContent;updateState();status.textContent=outcome;}
  };

  cancelDocument.onclick=async()=>{cancelDocument.disabled=true;status.textContent='正在取消文档识别并清理临时文件…';try{await request('ocrDocumentCancel');}catch(e){status.textContent=e.message;}};
  wordInstall.onclick=async()=>{
    wordInstall.disabled=true;installPanel.hidden=false;cancelInstall.hidden=false;cancelInstall.disabled=false;installProgress.removeAttribute('value');
    try{const r=await request('ocrDocumentInstall');status.textContent=r.message||'Word 组件已安装';log.textContent=r.log||'';}
    catch(e){status.textContent=/页码无效|用户已取消/.test(e.message)?e.message:'操作失败，请重试或查看详情';status.title=e.message;log.textContent=e.log||e.message;log.parentElement.open=false;advanced.open=false;if(recognizing)showRecognitionFailure();}
    finally{installPanel.hidden=true;cancelInstall.hidden=true;try{lastStatus=await request('ocrStatus');updateState(true);}catch{}wordInstall.disabled=false;}
  };
  function showPanel(isDocument){
    dialog.hidden=false;
    document.querySelector('.tool-deck').classList.add('show-recognition');
    for(const tab of document.querySelectorAll('.input-tabs button'))tab.classList.toggle('active',tab===(isDocument?documentTab:imageTab));
  }
  document.querySelector('.input-tabs').addEventListener('click',e=>{
    const tab=e.target.closest('button');if(!tab||tab===imageTab||tab===documentTab)return;
    dialog.hidden=true;document.querySelector('.tool-deck').classList.remove('show-recognition');
  });
  function openOCR(isDocument){
    if(recognizing){showPanel(isDocument);return;}
    documentMode=isDocument;dialog.querySelector('[data-title]').textContent=isDocument?'文档公式识别':'图片公式识别';
    find('[data-document-options]').hidden=settingsHost?false:!isDocument;
    find('.ocr-mode').parentElement.hidden=settingsHost?false:isDocument;
    recognize.textContent=isDocument?'选择文档':'选择图片';recognize.title=recognize.textContent;const currentInput=confirmedInputs[isDocument?'document':'image'];confirmation.replaceChildren();confirmation.title='';if(currentInput)window.FormulaOCRInput(null,currentInput);
    results.hidden=true;results.innerHTML='';pageFormulas=[];selected.clear();showPanel(isDocument);refresh();
  }
  // Intercept image-only paste; ordinary text keeps the editor's native paste behavior.
  document.addEventListener('paste',e=>{
    if(e.clipboardData?.getData('text/plain'))return;
    const image=[...(e.clipboardData?.items||[])].find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile();
    if(!image)return;
    e.preventDefault();recognizePastedImage(image);
  },true);
  const editorCard=document.querySelector('.editor-card');
  editorCard?.addEventListener('dragover',e=>{if([...e.dataTransfer.items].some(item=>item.kind==='file'&&item.type.startsWith('image/'))){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  editorCard?.addEventListener('drop',e=>{
    const files=[...(e.dataTransfer?.files||[])];
    if(!files.length||!files.every(file=>file.type.startsWith('image/')))return;
    e.preventDefault();
    if(files.length!==1){openOCR(false);status.textContent='请一次拖入一张图片。';return;}
    recognizePastedImage(files[0]);
  });
  async function recognizePastedImage(image){
    if(recognizing){status.textContent='已有识别任务正在运行。';return;}
    openOCR(false);window.FormulaOCRInput(null,{kind:'image',name:image.name||'剪贴板图片',thumbnail:URL.createObjectURL(image)});recognizing=true;setRecognitionProgress(true);recognize.disabled=true;
    status.textContent='正在识别剪贴板图片…';
    try{
      if(image.size>100*1024*1024)throw new Error('剪贴板图片超过 100 MB。');
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取剪贴板图片'));reader.readAsDataURL(image)});
      const r=await request('ocrRecognize',{engine:engine.value,mode,imageBase64:encoded});
      if(r.cancelled){status.textContent='已取消';return;}
      const candidates=mode==='page'?r.formulas:[{latex:r.latex,source:'剪贴板图片'}];
      if(!candidates?.length||!candidates[0]?.latex)throw new Error('没有识别到公式');
      // No automatic insertion: checking a candidate is the user's confirmation.
      renderPageResults(candidates,r.engine||engine.value);
      status.textContent='识别完成，请勾选要写入编辑器的公式。';
    }catch(e){status.textContent=/页码无效|用户已取消/.test(e.message)?e.message:'操作失败，请重试或查看详情';status.title=e.message;log.textContent=e.log||e.message;advanced.open=false;log.parentElement.open=false;if(recognizing)showRecognitionFailure();}
    finally{recognizing=false;setRecognitionProgress(false);const outcome=status.textContent;updateState();status.textContent=outcome;}
  }
  const imageTab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='图片识别');
  if(imageTab){imageTab.dataset.tab='image';imageTab.disabled=false;imageTab.title='本地图片公式识别';imageTab.onclick=()=>openOCR(false);}
  const documentTab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='文档识别');
  if(documentTab){documentTab.dataset.tab='document';documentTab.disabled=false;documentTab.title='PDF / Word 文档公式识别';documentTab.onclick=()=>openOCR(true);}
})();
