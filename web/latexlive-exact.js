(() => {
  const LOCAL_SCRIPT='vendor/latexlive/catalog.js';
  const REMOTE_SOURCE='https://raw.githubusercontent.com/ubnm/LaTeXLive/master/json/map_input.json';
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const wait=(fn,timeout=12000)=>new Promise((resolve,reject)=>{const start=Date.now();(function tick(){const v=fn();if(v)return resolve(v);if(Date.now()-start>timeout)return reject(new Error('LaTeXLive exact catalog init timeout'));setTimeout(tick,40)})()});

  if(!q('link[data-formula-v11]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='v1.1.css';link.dataset.formulaV11='';document.head.append(link);
  }

  const matrixFallback={
    matrix:'\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}',
    bmatrix:'\\begin{bmatrix}#@&#?\\\\#?&#?\\end{bmatrix}',
    pmatrix:'\\begin{pmatrix}#@&#?\\\\#?&#?\\end{pmatrix}',
    Bmatrix:'\\begin{Bmatrix}#@&#?\\\\#?&#?\\end{Bmatrix}',
    vmatrix:'\\begin{vmatrix}#@&#?\\\\#?&#?\\end{vmatrix}',
    Vmatrix:'\\begin{Vmatrix}#@&#?\\\\#?&#?\\end{Vmatrix}',
    leftmatrix:'\\left\\{\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}\\right.',
    rightmatrix:'\\left.\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}\\right\\}',
    case:'\\begin{cases}#@&#?\\\\#?&#?\\end{cases}',
    align:'\\begin{aligned}#@&#?\\\\#?&#?\\end{aligned}'
  };

  function normalizedLatex(entry){
    if(matrixFallback[entry?.tag])return matrixFallback[entry.tag];
    let latex=String(entry?.latex||'').replace(/\r\n/g,'\n').replace(/^%[^\n]*mhchem[^\n]*(?:\n|$)/gmi,'').trim();
    // Audited physics entries: replace differential d, preserving I_d and variables.
    if(/^physics_(?:1|2|7|8|10|11|12)$/.test(entry?.tag||'')){
      latex=latex.replace(/Id(?=[l\s])/g,String.raw`I\mathrm{d}`);
      latex=latex.replace(/(^|[^A-Za-z\\_])d(?=\s|[t{^]|\\vec)/g,(_,prefix)=>prefix+String.raw`\mathrm{d}`);
    }
    if(entry?.tag==='physics_6')latex=latex.replace(String.raw`\rm{d}`,String.raw`\mathrm{d}`);
    return latex;
  }
  function usable(entry){return entry&&entry.tag!=='divider'&&normalizedLatex(entry);}
  function label(entry){if(entry?.englishOperator){const command=normalizedLatex(entry).match(/\\([A-Za-z]+)/);return command?command[1]:({'+':'plus','-':'minus','=':'equals','<':'less than','>':'greater than'}[normalizedLatex(entry)]||(entry.en&&entry.en!=='-'?entry.en:entry.tag));}
    const meaningful=value=>value&&value.trim()!=='-'&&value.trim()!=='—';return String([entry?.zh,entry?.en,entry?.tag].find(meaningful)||'公式');}
  function extract(parsed,name){
    const groups=Array.isArray(parsed?.shortcut)?parsed.shortcut:[];
    return groups.find(x=>x&&x.name===name&&x.layer1&&x.layer2)||null;
  }
  function validate(parsed){
    const toolbar=extract(parsed,'toolbar'),template=extract(parsed,'template');
    if(!toolbar||!template)throw new Error('LaTeX Live map_input structure changed');
    if(toolbar.layer1.cont?.length!==10)throw new Error(`Expected 10 shortcut categories, got ${toolbar.layer1.cont?.length||0}`);
    if(template.layer1.cont?.length!==10)throw new Error(`Expected 10 template categories, got ${template.layer1.cont?.length||0}`);
    for(const category of toolbar.layer1.cont){if(!Array.isArray(toolbar.layer2.cont?.[category.tag]?.cont))throw new Error('Missing shortcut category '+category.tag);}
    for(const category of template.layer1.cont){if(!Array.isArray(template.layer2.cont?.[category.tag]?.cont))throw new Error('Missing template category '+category.tag);}
    return {toolbar,template};
  }

  function insertLatex(latex,transform=true){
    const mf=q('#editor-mount math-field');if(!mf||mf.readOnly)return;
    latex=window.FormulaFormatLatex?.(latex)||latex;

    window.FormulaApplyVisualStructure(mf,latex,{transform});
    mf.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function executeMatrixCommand(command){
    const mf=q('#editor-mount math-field');if(!mf||mf.readOnly)return;
    if(window.FormulaExecuteMatrixCommand){window.FormulaExecuteMatrixCommand(command);return;}
    mf.focus();const ok=mf.executeCommand(command);mf.dispatchEvent(new Event('input',{bubbles:true}));
    if(ok===false&&q('#status'))q('#status').textContent='请先点击矩阵或多行公式中的单元格';
  }
  function previewLatex(latex){latex=latex.replace(/\\sqrt\[\]\{\}/g,'\\sqrt[3]{x}').replace(/\{\}/g,'{x}');if(/^[\^_]/.test(latex))latex='x'+latex;return latex.replaceAll('#@','x').replaceAll('#?','y').replace(/\\begin\{equation\*?\}|\\end\{equation\*?\}/g,'').replace(/\\label\{[^}]*\}/g,'');}
  async function render(node,latex){
    try{await wait(()=>window.MathJax?.tex2svgPromise);await MathJax.startup.promise;const out=await MathJax.tex2svgPromise('\\displaystyle '+previewLatex(latex),{display:true});node.replaceChildren(out);node.dataset.rendered='1';}
    catch{node.textContent=latex.replace(/\\[A-Za-z]+/g,'').replace(/[{}]/g,'').trim().slice(0,28)||'ƒ';node.dataset.rendered='fallback';}
  }
  function createItem(entry,kind='shortcut'){
    const b=document.createElement('button');b.type='button';b.className=kind==='template'?'ll-template-item':'ll-item';
    const latex=normalizedLatex(entry);b.dataset.exactLatex=latex;b.dataset.exactTag=entry.tag||'';b.title=label(entry);b.setAttribute('role','menuitem');
    const art=document.createElement('span');art.className='ll-preview';art.setAttribute('aria-hidden','true');art.textContent='…';
    const text=document.createElement('span');text.className='ll-label';text.textContent=label(entry);if(kind==='template'&&/^[A-Za-z]+_\d+$/.test(text.textContent)){text.hidden=true;b.title='';b.setAttribute('aria-label',latex);}b.append(art,text);render(art,latex);return b;
  }

  function viewportPlace(panel,anchor,{gap=6}={}){
    if(!panel||!anchor||panel.hidden)return;
    panel.style.visibility='hidden';panel.style.left='8px';panel.style.top='8px';
    requestAnimationFrame(()=>{
      const ar=anchor.getBoundingClientRect(),pr=panel.getBoundingClientRect();let left=ar.left,top=ar.bottom+gap;
      if(left+pr.width>innerWidth-8)left=Math.max(8,innerWidth-pr.width-8);
      if(top+pr.height>innerHeight-8){const above=ar.top-pr.height-gap;top=above>=8?above:Math.max(8,innerHeight-pr.height-8);}
      panel.style.left=Math.round(left)+'px';panel.style.top=Math.round(top)+'px';panel.style.visibility='visible';
    });
  }
  function focusableItems(panel){return qa('button:not([disabled])',panel).filter(x=>x.offsetParent!==null);}
  function gridMove(panel,current,key){
    const items=focusableItems(panel);if(!items.length)return;let i=Math.max(0,items.indexOf(current));
    const cols=Math.max(1,Math.round(panel.clientWidth/Math.max(88,current?.getBoundingClientRect().width||100)));
    if(key==='ArrowRight')i=(i+1)%items.length;else if(key==='ArrowLeft')i=(i-1+items.length)%items.length;else if(key==='ArrowDown')i=Math.min(items.length-1,i+cols);else if(key==='ArrowUp')i=Math.max(0,i-cols);else if(key==='Home')i=0;else if(key==='End')i=items.length-1;else return;items[i].focus();
  }
  function closeAllFloating({focusEditor=false}={}){
    for(const group of qa('#tools>.tool-group'))group.open=false;
    const panel=q('.ll-template-panel');if(panel)panel.hidden=true;
    qa('.ll-template-category').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});document.body.classList.remove('formula-menu-open');
    if(focusEditor)q('#editor-mount math-field')?.focus();
  }

  function rebuildShortcuts(toolbar){
    const byDescription=new Map((toolbar.layer1.cont||[]).map(x=>[x.descript,x.tag]));
    for(const group of qa('#tools>.tool-group')){
      const summary=q('summary',group),title=summary?.getAttribute('aria-label')||summary?.textContent.trim();const tag=byDescription.get(title),src=tag&&toolbar.layer2.cont?.[tag]?.cont;if(!Array.isArray(src))continue;
      const panel=q(':scope>div',group);panel.replaceChildren();panel.classList.add('ll-popup-grid');panel.dataset.exactCategory=tag;panel.setAttribute('role','menu');panel.setAttribute('aria-label',title+'选项');summary?.setAttribute('aria-haspopup','menu');
      for(const entry of src){if(entry.tag==='divider'){const d=document.createElement('div');d.className='ll-divider';d.textContent=entry.name||entry.name_en||'';d.setAttribute('role','presentation');panel.append(d);continue;}if(usable(entry))panel.append(createItem(tag==='symbol'?{...entry,englishOperator:true}:entry));}
      if(tag==='matrix'){
        const d=document.createElement('div');d.className='ll-divider';d.textContent='矩阵编辑 Matrix editing';d.setAttribute('role','presentation');panel.append(d);
        for(const [command,name] of [['addRowBefore','上方加行'],['addRowAfter','下方加行'],['removeRow','删除行'],['addColumnBefore','左侧加列'],['addColumnAfter','右侧加列'],['removeColumn','删除列']]){const b=document.createElement('button');b.type='button';b.className='ll-item ll-command';b.dataset.exactCommand=command;b.textContent=name;b.setAttribute('role','menuitem');panel.append(b);}
      }
      group.addEventListener('toggle',()=>{summary?.setAttribute('aria-expanded',String(group.open));if(!group.open)return;for(const other of qa('#tools>.tool-group'))if(other!==group)other.open=false;document.body.classList.add('formula-menu-open');viewportPlace(panel,summary);});
      panel.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();gridMove(panel,e.target.closest('button'),e.key);}if(e.key==='Escape'){e.preventDefault();closeAllFloating();summary?.focus();}});
    }
  }

  function rebuildTemplates(template){
    const browser=q('.ll-template-browser');if(!browser)return;browser.replaceChildren();
    const nav=document.createElement('div');nav.className='ll-template-nav';nav.setAttribute('role','toolbar');nav.setAttribute('aria-label','公式模板分类');
    const panel=document.createElement('div');panel.className='ll-template-panel';panel.hidden=true;panel.setAttribute('role','menu');browser.append(nav,panel);let active='';
    const covers={algebra:String.raw`y=ax+b`,inequality:String.raw`\lvert a+b\rvert\leqslant\lvert a\rvert+\lvert b\rvert`,calculous:String.raw`\int_{a}^{b} f(x)\,\mathrm{d}x`,array:String.raw`\begin{pmatrix}a & b \\ c & d\end{pmatrix}`,physics:String.raw`E=mc^2`,chemistry:String.raw`\mathrm{2H_2+O_2=2H_2O}`};
    for(const category of template.layer1.cont||[]){
      const categoryName=category.tag==='calculous'?'微积分':category.descript||category.tag;
      const entries=(template.layer2.cont?.[category.tag]?.cont||[]).filter(usable);const b=document.createElement('button');b.type='button';b.className='ll-template-category';b.dataset.templateTag=category.tag;b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');if(category.tag==='physics')b.dataset.example='heat';
      const art=document.createElement('span');art.className='ll-category-art ll-preview';art.setAttribute('aria-hidden','true');art.textContent='…';const text=document.createElement('span');text.textContent=categoryName;const arrow=document.createElement('span');arrow.className='ll-category-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';b.append(art,text,arrow);nav.append(b);const cover=covers[category.tag]||normalizedLatex(entries[0]);art.dataset.coverLatex=cover;render(art,cover);
      b.onclick=e=>{e.preventDefault();e.stopPropagation();if(active===category.tag&&!panel.hidden){panel.hidden=true;active='';b.classList.remove('active');b.setAttribute('aria-expanded','false');document.body.classList.remove('formula-menu-open');return;}qa('.ll-template-category',nav).forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-expanded',String(x===b));});active=category.tag;panel.hidden=false;panel.dataset.templateTag=category.tag;panel.replaceChildren();const title=document.createElement('div');title.className='ll-panel-title';title.innerHTML=`<strong>${categoryName}</strong><span>${entries.length} 个模板</span>`;const grid=document.createElement('div');grid.className='ll-template-grid';for(const entry of entries)grid.append(createItem(entry,'template'));panel.append(title,grid);document.body.classList.add('formula-menu-open');viewportPlace(panel,b);};
      b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const buttons=qa('.ll-template-category',nav),i=buttons.indexOf(b),next=e.key==='ArrowRight'?(i+1)%buttons.length:(i-1+buttons.length)%buttons.length;buttons[next].focus();}if(e.key==='ArrowDown'&&!panel.hidden){e.preventDefault();focusableItems(panel)[0]?.focus();}});
    }
    panel.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();gridMove(panel,e.target.closest('button'),e.key);}if(e.key==='Escape'){e.preventDefault();const trigger=q(`.ll-template-category[data-template-tag="${panel.dataset.templateTag}"]`);closeAllFloating();trigger?.focus();}});
  }

  function bindGlobalEvents(){
    document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-exact-latex],[data-exact-command]'))e.preventDefault();},true);
    document.addEventListener('click',e=>{const latex=e.target.closest('[data-exact-latex]');if(latex){e.preventDefault();e.stopPropagation();insertLatex(latex.dataset.exactLatex,!latex.classList.contains('ll-template-item'));closeAllFloating();return;}const cmd=e.target.closest('[data-exact-command]');if(cmd){e.preventDefault();e.stopPropagation();executeMatrixCommand(cmd.dataset.exactCommand);closeAllFloating();return;}if(!e.target.closest('.tool-group,.ll-template-browser'))closeAllFloating();},true);
    document.addEventListener('keydown',e=>{const panel=q('.ll-template-panel');if(e.key==='Escape'&&(qa('#tools>.tool-group').some(x=>x.open)||(panel&&!panel.hidden))){e.preventDefault();closeAllFloating({focusEditor:true});}});
    window.addEventListener('resize',()=>closeAllFloating());window.addEventListener('blur',()=>closeAllFloating());document.addEventListener('scroll',e=>{if(!e.target.closest?.('.ll-popup-grid,.ll-template-panel'))closeAllFloating();},true);
  }
  function enhanceToolbarCustomization(){
    const button=q('#customize-toolbar'),options=q('#toolbar-options'),remove=q('#toolbar-remove');if(!button)return;const sync=()=>{const active=button.getAttribute('aria-expanded')==='true';document.body.classList.toggle('formula-customizing-toolbar',active);button.textContent=active?'完成':'自定义工具栏';if(active){options?.setAttribute('aria-label','可用工具');remove?.setAttribute('aria-label','拖到这里移除工具');}};new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['aria-expanded']});button.addEventListener('click',()=>requestAnimationFrame(sync));sync();
  }
  function preserveLegacyTemplateProbe(){const buttons=qa('.ll-template-category');const physics=buttons.find(b=>b.textContent.includes('物理'))||buttons[0];if(physics)physics.dataset.example='heat';}
  function loadBundledScript(){if(window.LaTeXLiveCatalog)return Promise.resolve(window.LaTeXLiveCatalog);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=LOCAL_SCRIPT;script.onload=()=>window.LaTeXLiveCatalog?resolve(window.LaTeXLiveCatalog):reject(new Error('catalog.js loaded without data'));script.onerror=()=>reject(new Error('catalog.js not found'));document.head.append(script);});}
  async function loadRemote(){const response=await fetch(REMOTE_SOURCE,{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}
  function applyCatalog(parsed,source){
    const {toolbar,template}=validate(parsed);rebuildShortcuts(toolbar);rebuildTemplates(template);preserveLegacyTemplateProbe();enhanceToolbarCustomization();document.documentElement.dataset.latexLiveExact=source;document.documentElement.dataset.formulaVersion='1.1.0';
    window.FormulaCatalogInfo={source,shortcutCategories:toolbar.layer1.cont.length,templateCategories:template.layer1.cont.length,shortcutItems:toolbar.layer1.cont.reduce((n,c)=>n+(toolbar.layer2.cont[c.tag]?.cont||[]).filter(usable).length,0),templateItems:template.layer1.cont.reduce((n,c)=>n+(template.layer2.cont[c.tag]?.cont||[]).filter(usable).length,0)};
  }
  async function start(){
    await wait(()=>document.documentElement.dataset.latexLiveMenus==='ready'&&q('.ll-template-browser'));bindGlobalEvents();preserveLegacyTemplateProbe();
    try{applyCatalog(await loadBundledScript(),'bundled');return;}catch(localError){console.warn('Bundled LaTeXLive catalog unavailable:',localError);}
    const localTest=['127.0.0.1','localhost'].includes(location.hostname)||location.protocol==='file:';
    if(localTest){document.documentElement.dataset.latexLiveExact='fallback';enhanceToolbarCustomization();return;}
    try{applyCatalog(await loadRemote(),'online');}catch(error){console.warn('Using built-in LaTeXLive fallback catalog:',error);document.documentElement.dataset.latexLiveExact='fallback';enhanceToolbarCustomization();}
  }
  start();
})();
