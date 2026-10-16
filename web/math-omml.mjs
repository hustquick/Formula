// Presentation MathML -> Office Math. Unsupported structures fail explicitly.
const M='http://schemas.openxmlformats.org/officeDocument/2006/math';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function mathmlToOMML(mathml){
 const doc=new DOMParser().parseFromString(mathml,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='math')throw Error('MathML 无效');
 const wrap=(tag,s)=>`<m:${tag}>${s}</m:${tag}>`;
 const run=(s,n)=>{
  // Emit only properties that differ from Office Math defaults. Plain style
  // on digits/operators makes WPS export redundant \mathrm wrappers.
  const variant=n?.closest('[mathvariant]')?.getAttribute('mathvariant');
  const style=({normal:'p',bold:'b',italic:'i','bold-italic':'bi'})[variant]
   ?? (!variant&&n&&/\p{L}/u.test(s)&&(n.localName==='mo'||n.localName==='mi'&&[...s].length>1)?'p':null);
  const effectiveStyle=style==='p'&&!/\p{L}/u.test(s)?null:style;
  const props=n?.localName==='mtext'||n?.localName==='ms'?'<m:nor/>':effectiveStyle?`<m:sty m:val="${effectiveStyle}"/>`:'';
  return `<m:r>${props?`<m:rPr>${props}</m:rPr>`:''}<m:t xml:space="preserve">${esc(s)}</m:t></m:r>`;
 };
 function node(n){
  const c=[...n.children],part=(i,t)=>wrap(t,node(c[i]));
  const all=()=>{
   let result='';
   for(let i=0;i<c.length;i++){
    const token=c[i];
    // Known operator names must be functions, not a styled run merged with =.
    if(['mo','mi'].includes(token.localName)&&/^(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp)$/.test(token.textContent)){
     let argument=i+1;
     while(c[argument]?.localName==='mo'&&['\u2061','\u2062'].includes(c[argument].textContent))argument++;
     if(c[argument]){result+=wrap('func',wrap('fName',run(token.textContent,token))+wrap('e',node(c[argument])));i=argument;continue;}
    }
    result+=node(token);
   }
   return result;
  };
  switch(n.localName){
   case 'math':case 'mrow':case 'mstyle':case 'mpadded':return all();
   case 'semantics':return c.length?node(c[0]):'';
   case 'annotation':case 'annotation-xml':return '';
   case 'mo':if(['\u2061','\u2062'].includes(n.textContent))return '';return run(n.textContent,n);
   case 'mi':case 'mn':case 'mtext':case 'ms':return run(n.textContent,n);
   case 'mspace':return run(' ');
   case 'mfrac':if(c.length===2)return wrap('f',part(0,'num')+part(1,'den'));break;
   case 'msqrt':return wrap('rad','<m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>'+wrap('e',all()));
   case 'mroot':if(c.length===2)return wrap('rad',part(1,'deg')+part(0,'e'));break;
   case 'msup':case 'msub':if(c.length===2)return wrap(n.localName==='msup'?'sSup':'sSub',part(0,'e')+part(1,n.localName==='msup'?'sup':'sub'));break;
   case 'msubsup':if(c.length===3)return wrap('sSubSup',part(0,'e')+part(1,'sub')+part(2,'sup'));break;
   case 'mfenced':{
    const open=n.getAttribute('open')??'(',close=n.getAttribute('close')??')',seps=(n.getAttribute('separators')??',').replace(/\s/g,'');
    return wrap('d',`<m:dPr><m:begChr m:val="${esc(open)}"/><m:endChr m:val="${esc(close)}"/><m:sepChr m:val=""/></m:dPr>`+wrap('e',c.map((v,i)=>(i&&seps?run(seps[Math.min(i-1,seps.length-1)]):'')+node(v)).join('')));
   }
   case 'mtable':return wrap('m',c.map(row=>{if(!['mtr','mlabeledtr'].includes(row.localName)||row.localName==='mlabeledtr')throw Error('OMML 暂不支持带标签矩阵');return wrap('mr',[...row.children].map(cell=>{if(cell.localName!=='mtd')throw Error('无效矩阵');return wrap('e',node(cell))}).join(''))}).join(''));
   case 'mtd':return all();
   case 'mover':case 'munder':case 'munderover':{
    if(c.length<2)break;
    if(n.localName==='mover'&&(n.getAttribute('accent')==='true'||['¯','‾','^','ˆ','~','˜','→','˙','¨'].includes(c[1].textContent)))return wrap('acc',`<m:accPr><m:chr m:val="${esc(c[1].textContent)}"/></m:accPr>`+part(0,'e'));
    if(n.localName==='munder')return wrap('limLow',part(0,'e')+part(1,'lim'));
    if(n.localName==='mover')return wrap('limUpp',part(0,'e')+part(1,'lim'));
    if(c.length===3)return wrap('limUpp',wrap('e',wrap('limLow',part(0,'e')+part(1,'lim')))+part(2,'lim'));break;
   }
   default:throw Error('OMML 暂不支持数学结构：'+n.localName);
  }
  throw Error('无效数学结构：'+n.localName);
 }
 return `<m:oMath xmlns:m="${M}">${node(doc.documentElement)}</m:oMath>`;
}
