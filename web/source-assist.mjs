import macroData from './completion-data/macros.json';
import environmentData from './completion-data/environments.json';
export function fuzzyScore(query,word){
  if(word.startsWith(query))return 1000-word.length;
  let cursor=0,gaps=0,last=-1;
  for(const char of query){const at=word.indexOf(char,cursor);if(at<0)return -1;gaps+=last<0?at:at-last-1;last=at;cursor=at+1;}
  return 100-gaps-word.length;
}
export function installSourceAssist(source,getLanguage){
  const commands={latex:['frac','sqrt','sum','prod','int','iint','iiint','lim','sin','cos','tan','log','ln','alpha','beta','gamma','theta','pi','infty','mathrm','mathbf','mathcal','mathbb','text','begin{aligned}','begin{pmatrix}','begin{bmatrix}','begin{cases}'],typst:['frac','sqrt','sum','product','integral','lim','sin','cos','tan','log','alpha','beta','theta','pi','infinity','mat','cases']};
  commands.latex=[...new Set([...commands.latex,...macroData.map(item=>item.name)])];
  const environmentNames=[...new Set([...environmentData.map(item=>item.name),'aligned','gathered','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix','cases','matrix','smallmatrix'])];
  const typstMath=['frac','sqrt','root','binom','vec','mat','cases','op','accent','attach','cancel','class','equation','lr','mid','norm','abs','floor','ceil','round','bold','italic','upright','cal','bb','frak','sans','serif','mono','display','inline','script','sscript','limits','scripts','underbrace','overbrace','underbracket','overbracket','underline','overline','sum','product','integral','lim','sin','cos','tan','sinh','cosh','tanh','arcsin','arccos','arctan','log','ln','exp','det','min','max','gcd'];
  const typstSymbols=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega','infinity','partial','nabla','dot','times','plus.minus','minus.plus','arrow.r','arrow.l','arrow.r.double','arrow.l.r','lt.eq','gt.eq','eq.not','approx','in','in.not','subset','subset.eq','supset','supset.eq','union','sect','emptyset','NN','ZZ','QQ','RR','CC'];
  const typstCode=['set','show','let','import','include','context','if','else','for','while','return','text','align','page','block','box','figure','table','image','sym','math'];
  commands.typst=[...new Set([...typstMath,...typstSymbols])];
  const panel=document.createElement('div');panel.className='source-assist';panel.hidden=true;panel.setAttribute('role','listbox');panel.setAttribute('aria-label','源码补全候选');
  const ghost=document.createElement('span');ghost.className='source-ghost';ghost.hidden=true;ghost.setAttribute('aria-hidden','true');source.parentElement.append(panel,ghost);
  const mirror=document.createElement('div');mirror.style.cssText='position:fixed;visibility:hidden;pointer-events:none;left:-10000px;top:0;';document.body.append(mirror);
  let candidates=[],index=0,closing='',query='',start=0,environment=false,beginEnvironment=false,composing=false,dismissed='',signature='';
  const pairs={'{':'}','[':']','(':')'};
  function hide(){panel.hidden=true;ghost.hidden=true;source.removeAttribute('aria-activedescendant');}
  function locate(){
    const style=getComputedStyle(source),rect=source.getBoundingClientRect(),parent=source.parentElement.getBoundingClientRect();
    for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight','borderTopWidth','borderLeftWidth','boxSizing','tabSize'])mirror.style[key]=style[key];
    mirror.style.width=source.clientWidth+'px';mirror.style.whiteSpace='pre-wrap';mirror.style.overflowWrap='break-word';
    mirror.textContent=source.value.slice(0,source.selectionStart);const marker=document.createElement('span');marker.textContent='\u200b';mirror.append(marker);
    const x=rect.left-parent.left+marker.offsetLeft-source.scrollLeft,y=rect.top-parent.top+marker.offsetTop-source.scrollTop;
    const line=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5;
    ghost.style.left=x+'px';ghost.style.top=y+'px';ghost.style.font=style.font;ghost.style.lineHeight=style.lineHeight;
    ghost.hidden=!ghost.textContent||x<0||y<0||y+line>source.clientHeight;
    panel.style.left=Math.max(0,Math.min(x,source.clientWidth-220))+'px';panel.style.top=Math.max(0,Math.min(y+line,source.clientHeight-130))+'px';
  }
  function show(){
    panel.replaceChildren();source.removeAttribute('aria-activedescendant');
    candidates.forEach((word,i)=>{const button=document.createElement('button');button.type='button';button.id='source-candidate-'+i;button.setAttribute('role','option');button.setAttribute('aria-selected',String(i===index));button.textContent=(getLanguage()==='latex'&&!environment?'\\':'')+word;button.addEventListener('pointerdown',e=>e.preventDefault());button.onclick=()=>{index=i;accept();};panel.append(button);});
    if(candidates.length){source.setAttribute('aria-activedescendant','source-candidate-'+index);const word=candidates[index];ghost.textContent=word.startsWith(query)?word.slice(query.length)+(environment&&source.value[source.selectionStart]!=='}'?'}':''):'';panel.hidden=false;}
    else {ghost.textContent=closing;panel.hidden=true;}
    locate();
  }
  function refresh(){
    if(composing||document.activeElement!==source||source.selectionStart!==source.selectionEnd){hide();return;}
    const left=source.value.slice(0,source.selectionStart);signature=getLanguage()+':'+source.value+':'+source.selectionStart;
    if(signature===dismissed){hide();return;}
    const stack=[],tokens=getLanguage()==='latex'?left.replace(/\\[^A-Za-z]|%[^\n]*/g,''):left;
    for(const c of tokens){if(pairs[c])stack.push(pairs[c]);else if(Object.values(pairs).includes(c)&&stack.at(-1)===c)stack.pop();}
    closing=stack.at(-1)||'';
    // Existing closing delimiters are never duplicated by a virtual suggestion.
    if(source.value[source.selectionStart]===closing)closing='';
    environment=false;beginEnvironment=false;
    const beginMatch=getLanguage()==='latex'?left.match(/\\begin\{([A-Za-z*]*)$/):null;
    if(beginMatch){query=beginMatch[1];start=source.selectionStart-query.length;index=0;environment=true;beginEnvironment=true;candidates=environmentNames.map(word=>({word,score:fuzzyScore(query,word)})).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score).slice(0,12).map(item=>item.word);show();return;}
    const envMatch=getLanguage()==='latex'?left.match(/\\end\{([A-Za-z*]*)$/):null;
    if(envMatch){
      const open=[];const prefix=left.slice(0,left.length-envMatch[0].length).replace(/%[^\n]*/g,'');
      for(const token of prefix.matchAll(/\\(begin|end)\{([^{}]+)\}/g)){if(token[1]==='begin')open.push(token[2]);else if(open.at(-1)===token[2])open.pop();}
      const name=open.at(-1);query=envMatch[1];start=source.selectionStart-query.length;index=0;
      candidates=name&&fuzzyScore(query,name)>=0?[name]:[];environment=true;show();return;
    }
    const typstContext=getLanguage()==='typst'?left.match(/(?:^|[^A-Za-z0-9_.])((?:sym\.|math\.|#)?[A-Za-z][A-Za-z0-9_.]*)$/):null;
    const match=getLanguage()==='latex'?left.match(/\\([A-Za-z]{2,})$/):typstContext;
    query=match?.[1]||'';start=source.selectionStart-query.length;index=0;
    let pool=commands[getLanguage()];
    if(getLanguage()==='typst'){if(query.startsWith('sym.'))pool=typstSymbols.map(w=>'sym.'+w);else if(query.startsWith('math.'))pool=typstMath.map(w=>'math.'+w);else if(query.startsWith('#'))pool=typstCode.map(w=>'#'+w);}
    candidates=query.length>=2?pool.map(word=>({word,score:fuzzyScore(query,word)})).filter(x=>x.score>=0&&x.word!==query).sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word)).slice(0,6).map(x=>x.word):[];
    show();
  }
  function accept(){
    const perform=()=>{
    const word=candidates[index];source.focus();
    if(environment&&word){const end=source.selectionStart+(source.value[source.selectionStart]==='}'?1:0);source.setSelectionRange(start,end);document.execCommand('insertText',false,word+'}'+(beginEnvironment?'\n  \n\\end{'+word+'}':''));if(beginEnvironment)source.setSelectionRange(start+word.length+4,start+word.length+4);source.dispatchEvent(new Event('input',{bubbles:true}));dismissed=getLanguage()+':'+source.value+':'+source.selectionStart;hide();return;}
    if(word){if(word.startsWith(query))document.execCommand('insertText',false,word.slice(query.length));else{source.setSelectionRange(start,source.selectionStart);document.execCommand('insertText',false,word);}}
    else if(closing)document.execCommand('insertText',false,closing);
    source.dispatchEvent(new Event('input',{bubbles:true}));dismissed=getLanguage()+':'+source.value+':'+source.selectionStart;hide();
    };
    if(window.FormulaCommands)window.FormulaCommands.execute('sourceAccept',{execute:perform});else perform();
  }
  source.addEventListener('compositionstart',()=>{composing=true;hide()});source.addEventListener('compositionend',()=>{composing=false;refresh()});
  for(const event of ['input','click','focus','scroll'])source.addEventListener(event,refresh);
  source.addEventListener('blur',hide);window.addEventListener('resize',refresh);
  source.addEventListener('keyup',e=>{if(!['ArrowDown','ArrowUp','Escape','Tab','Enter'].includes(e.key))refresh();});
  source.addEventListener('keydown',e=>{
    if(composing||e.isComposing||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key==='Escape'){dismissed=signature;hide();return;}
    if(!panel.hidden&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();index=(index+(e.key==='ArrowDown'?1:-1)+candidates.length)%candidates.length;show();return;}
    if((e.key==='Tab'||e.key==='Enter'&&!panel.hidden)&&!e.shiftKey&&(!panel.hidden||!ghost.hidden)){e.preventDefault();accept();return;}
    if(Object.values(pairs).includes(e.key)&&source.selectionStart===source.selectionEnd&&source.value[source.selectionStart]===e.key){e.preventDefault();source.setSelectionRange(source.selectionStart+1,source.selectionStart+1);refresh();}
  });
  return {refresh};
}
