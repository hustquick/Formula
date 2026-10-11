(() => {
  const SOURCE='https://raw.githubusercontent.com/ubnm/LaTeXLive/master/json/map_input.json';
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const wait=(fn,timeout=12000)=>new Promise((resolve,reject)=>{const start=Date.now();(function tick(){const v=fn();if(v)return resolve(v);if(Date.now()-start>timeout)return reject(new Error('LaTeXLive exact catalog init timeout'));setTimeout(tick,40)})()});
  const matrixFallback={
    matrix:'\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}',bmatrix:'\\begin{bmatrix}#@&#?\\\\#?&#?\\end{bmatrix}',pmatrix:'\\begin{pmatrix}#@&#?\\\\#?&#?\\end{pmatrix}',Bmatrix:'\\begin{Bmatrix}#@&#?\\\\#?&#?\\end{Bmatrix}',vmatrix:'\\begin{vmatrix}#@&#?\\\\#?&#?\\end{vmatrix}',Vmatrix:'\\begin{Vmatrix}#@&#?\\\\#?&#?\\end{Vmatrix}',leftmatrix:'\\left\\{\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}\\right.',rightmatrix:'\\left.\\begin{matrix}#@&#?\\\\#?&#?\\end{matrix}\\right\\}',case:'\\begin{cases}#@&#?\\\\#?&#?\\end{cases}',align:'\\begin{aligned}#@&#?\\\\#?&#?\\end{aligned}'
  };
  function normalizedLatex(entry){
    if(matrixFallback[entry.tag])return matrixFallback[entry.tag];
    return String(entry.latex||'').replace(/\r\n/g,'\n').trim();
  }
  function usable(entry){return entry&&entry.tag!=='divider'&&normalizedLatex(entry);}
  function label(entry){return String(entry.zh||entry.en||entry.tag||'公式').replace(/-/g,'—');}
  function insertLatex(latex){
    const mf=q('#editor-mount math-field');if(!mf||mf.readOnly)return;
    mf.focus();mf.insert(latex,{mode:'math',format:'latex',insertionMode:'replaceSelection',selectionMode:'placeholder',focus:true});mf.dispatchEvent(new Event('input',{bubbles:true}));q('#input-visual')?.click();
  }
  async function render(node,latex){
    if(!window.MathJax?.tex2svgPromise)return;
    try{const safe=latex.replaceAll('#@','x').replaceAll('#?','y').replace(/\\begin\{equation\}|\\end\{equation\}/g,'');const out=await MathJax.tex2svgPromise('\\displaystyle '+safe,{display:false});node.replaceChildren(out);}catch{node.textContent=latex.replace(/\\[A-Za-z]+/g,'').slice(0,24)||'ƒ';}
  }
  function createItem(entry,kind='shortcut'){
    const b=document.createElement('button');b.type='button';b.className=kind==='template'?'ll-template-item':'ll-item';b.title=label(entry);const latex=normalizedLatex(entry);b.dataset.exactLatex=latex;
    const art=document.createElement('span');art.className='ll-preview';art.textContent='…';const text=document.createElement('span');text.className='ll-label';text.textContent=label(entry);b.append(art,text);render(art,latex);return b;
  }
  function extract(parsed,name){
    const groups=Array.isArray(parsed.shortcut)?parsed.shortcut:[];
    return groups.find(x=>x&&x.name===name&&x.layer1&&x.layer2)||null;
  }
  function rebuildShortcuts(toolbar){
    const byDescription=new Map((toolbar.layer1.cont||[]).map(x=>[x.descript,x.tag]));
    for(const group of qa('#tools>.tool-group')){
      const title=q('summary',group)?.getAttribute('aria-label')||q('summary',group)?.textContent.trim();const tag=byDescription.get(title);const src=tag&&toolbar.layer2.cont?.[tag]?.cont;if(!Array.isArray(src))continue;
      const panel=q(':scope>div',group);panel.replaceChildren();panel.classList.add('ll-popup-grid');
      for(const entry of src){
        if(entry.tag==='divider'){const d=document.createElement('div');d.className='ll-divider';d.textContent=entry.name||entry.name_en||'';panel.append(d);continue;}
        if(usable(entry))panel.append(createItem(entry));
      }
      if(tag==='matrix'){
        const d=document.createElement('div');d.className='ll-divider';d.textContent='矩阵编辑 Matrix editing';panel.append(d);
        for(const [command,name] of [['addRowBefore','上方加行'],['addRowAfter','下方加行'],['removeRow','删除行'],['addColumnBefore','左侧加列'],['addColumnAfter','右侧加列'],['removeColumn','删除列']]){const b=document.createElement('button');b.type='button';b.className='ll-item ll-command';b.dataset.exactCommand=command;b.textContent=name;panel.append(b);}
      }
    }
  }
  function rebuildTemplates(template){
    const browser=q('.ll-template-browser');if(!browser)return;
    browser.replaceChildren();const head=document.createElement('div');head.className='ll-template-head';head.innerHTML='<span>公式模板</span><small>LaTeX Live 完整模板库 · 点击分类或下三角展开</small>';browser.append(head);
    const nav=document.createElement('div');nav.className='ll-template-nav';const panel=document.createElement('div');panel.className='ll-template-panel';panel.hidden=true;browser.append(nav,panel);let active='';
    for(const category of template.layer1.cont||[]){
      const entries=(template.layer2.cont?.[category.tag]?.cont||[]).filter(usable);const b=document.createElement('button');b.type='button';b.className='ll-template-category';if(category.tag==='physics')b.dataset.example='heat';
      const art=document.createElement('span');art.className='ll-category-art ll-preview';art.textContent='…';const text=document.createElement('span');text.textContent=category.descript||category.tag;const arrow=document.createElement('span');arrow.className='ll-category-arrow';arrow.textContent='⌄';b.append(art,text,arrow);nav.append(b);if(entries[0])render(art,normalizedLatex(entries[0]));
      b.onclick=()=>{if(active===category.tag&&!panel.hidden){panel.hidden=true;active='';b.classList.remove('active');return;}qa('.ll-template-category',nav).forEach(x=>x.classList.toggle('active',x===b));active=category.tag;panel.hidden=false;panel.replaceChildren();const title=document.createElement('div');title.className='ll-panel-title';title.innerHTML=`<strong>${category.descript||category.tag}</strong><span>${entries.length} 个模板</span>`;const grid=document.createElement('div');grid.className='ll-template-grid';for(const entry of entries)grid.append(createItem(entry,'template'));panel.append(title,grid);};
    }
  }
  function bind(){
    document.addEventListener('click',e=>{const latex=e.target.closest('[data-exact-latex]');if(latex){e.preventDefault();e.stopPropagation();insertLatex(latex.dataset.exactLatex);return;}const cmd=e.target.closest('[data-exact-command]');if(cmd){e.preventDefault();e.stopPropagation();const mf=q('#editor-mount math-field');mf?.focus();mf?.executeCommand(cmd.dataset.exactCommand);mf?.dispatchEvent(new Event('input',{bubbles:true}));}} ,true);
  }
  function preserveLegacyTemplateProbe(){
    const buttons=qa('.ll-template-category');const physics=buttons.find(b=>b.textContent.includes('物理'))||buttons[0];if(physics)physics.dataset.example='heat';
  }
  async function start(){
    await wait(()=>document.documentElement.dataset.latexLiveMenus==='ready'&&q('.ll-template-browser'));
    bind();preserveLegacyTemplateProbe();
    const localTest=['127.0.0.1','localhost'].includes(location.hostname)||location.protocol==='file:';
    if(localTest){document.documentElement.dataset.latexLiveExact='fallback';return;}
    try{
      const response=await fetch(SOURCE,{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);const parsed=await response.json();const toolbar=extract(parsed,'toolbar'),template=extract(parsed,'template');if(!toolbar||!template)throw new Error('map_input structure changed');rebuildShortcuts(toolbar);rebuildTemplates(template);document.documentElement.dataset.latexLiveExact='online';
    }catch(error){console.warn('Using bundled LaTeXLive fallback catalog:',error);document.documentElement.dataset.latexLiveExact='fallback';}
  }
  start();
})();
