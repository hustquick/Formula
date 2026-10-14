// Editing semantics live here; formatting is applied only after the editor transaction.
// Metadata is resolved once for every insertion path, including custom toolbar entries.
export function insertionPolicy(template){
  const t=String(template).trim();
  if(/^\\(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|gcd|det|min|max)(?:_\{[^}]*\})?(?:\{\}|\(\))?$/.test(t))return {behavior:'wrap',target:'argument'};
  if(/^\\(?:int|iint|iiint|oint|oiint|oiiint|sum|prod|coprod|lim|limsup|liminf)\b/.test(t))return {behavior:'fill-specific-slot',target:'body'};
  if(t.includes('#@'))return {behavior:'fill-specific-slot',target:'marked'};
  if(t.includes('{}')||t.includes('#?'))return {behavior:'fill-primary-slot',target:'operand'};
  if(/^\\left/.test(t))return {behavior:'wrap',target:'body'};
  return {behavior:'replace',target:null};
}
export function selectionStructure(template,selected=''){
  let t=String(template).trim(),operand=selected||'#?';
  const policy=insertionPolicy(t);
  if(policy.target==='argument'){
    const command=t.match(/^\\[A-Za-z]+/)[0];
    const index=t.match(/_\{([^}]*)\}/)?.[1];
    return command+(index!==undefined?'_{'+(index||'#?')+'}':'')+'\\left('+operand+'\\right)';
  }
  if(policy.behavior==='fill-specific-slot'&&policy.target==='body'){
    const command=t.match(/^\\[A-Za-z]+/)[0];
    const suffix=(t.slice(command.length).match(/^(?:[_^](?:\{[^}]*\}|[^\s]))*/)?.[0]||'').replace(/\{\}/g,'{#?}').trim();
    const bounds=suffix||(['\\lim','\\limsup','\\liminf'].includes(command)?'_{#?}':'_{#?}^{#?}');
    return command+bounds+' '+operand+(/^\\(?:int|iint|iiint|oint|oiint|oiiint)$/.test(command)?'\\,\\mathrm{d}{#?}':'');
  }
  const accents=/^\\(?:hat|widehat|tilde|widetilde|bar|overline|underline|vec|dot|ddot|breve|check|acute|grave|overbrace|underbrace|overleftarrow|overrightarrow|overleftrightarrow|not|mathrm|mathbf|mathbb|mathcal|mathfrak|text)\{(?:#\?|#@)?\}$/;
  if(accents.test(t))return t.replace(/\{(?:#\?|#@)?\}$/,()=>'{'+operand+'}');
  if(/^(?:#@)?[_^]/.test(t)){
    const suffix=t.replace(/^#@/,'').replace(/\{\}/g,'{#?}');
    return '{'+operand+'}'+suffix;
  }
  if(/^\\(?:overset|underset)\{\}\{\}$/.test(t))return t.replace(/\{\}\{\}$/,'{#?}{'+operand+'}');
  if(/^\\(?:frac|dfrac|tfrac|cfrac|binom)\{\}\{\}$/.test(t))return t.replace(/\{\}\{\}$/,'{'+operand+'}{#?}');
  if(/^\\sqrt(?:\[[^\]]*\])?\{(?:#\?|#@)?\}$/.test(t))return t.replace('[]','[#?]').replace(/\{(?:#\?|#@)?\}$/,()=>'{'+operand+'}');
  if(/^\\(?:int|iint|iiint|oint|sum|prod|lim)\b/.test(t)&&!t.includes('#@'))return t.replace(/\{\}/g,'{#?}')+operand;
  if(/^\\(?:sin|cos|tan|log|ln|exp|gcd)\(\)$/.test(t))return t.replace('()', '('+operand+')');
  if(/^\\begin\{(?:[pbBvV]?matrix|smallmatrix|cases|aligned|gathered|array)\}/.test(t)&&!t.includes('#@')&&t.includes('#?'))return t.replace('#?',()=>operand);
  if(t.includes('#@'))return t.replaceAll('#@',operand);
  if(/^\\left/.test(t)&&/\\right/.test(t))return t.replace(/(\\right)/,()=>operand+'\\right');
  // Empty operand slots in remaining structure templates use the selection in the first slot.
  if(t.includes('{}')){let first=true;return t.replace(/\{\}/g,()=>{const value=first?operand:'#?';first=false;return '{'+value+'}';});}
  if(t.includes('#?'))return t.replace('#?',()=>operand);
  return t;
}
export function applyVisualStructure(mf,template,{transform=true}={}){
  if(mf.readOnly)return false;
  const selection=JSON.parse(JSON.stringify(mf.selection));
  const selected=mf.selectionIsCollapsed?'':mf.getValue(selection,'latex');
  const structure=transform?selectionStructure(template,selected):template;
  mf.focus();mf.selection=selection;
  // MathLive 0.111.1 coalesces consecutive inserts of the same atom type.
  // Establish an undo boundary without resetting existing undo/redo history.
  if(typeof mf._mathfield?.stopCoalescingUndo==='function')mf._mathfield.stopCoalescingUndo();
  mf.insert(structure,{mode:'math',format:'latex',insertionMode:'replaceSelection',selectionMode:'placeholder',silenceNotifications:false,focus:true});
  mf.dispatchEvent(new Event('input',{bubbles:true}));return true;
}
