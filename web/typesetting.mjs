// One document, three editor representations. Old backend preferences are not policy.
export function migrateTypesetting(saved={}){
  const legacy=saved.engine??saved.renderer;
  const language=saved.sourceLanguage??saved.mode??saved.source_language;
  const inferred=['typst','local_typst'].includes(legacy)?'typst':'latex';
  const sourceLanguage=['latex','typst'].includes(language)?language:inferred;
  let editorMode=['visual','latex','typst'].includes(saved.editorMode)?saved.editorMode:
    (saved.viewMode==='visual'||saved.pane==='visual')?'visual':sourceLanguage;
  if(editorMode==='visual'&&sourceLanguage==='typst'&&!saved.latex&&saved.rawSource)editorMode='typst';
  const result={...saved,editorMode};
  for(const key of ['mode','engine','renderer','sourceLanguage','source_language','typesettingEngine','typesetting_engine','viewMode','pane','backend','localLatexEnabled','localTypstEnabled'])delete result[key];
  return result;
}
export function attachDerivedLanguage(state){
  Object.defineProperty(state,'sourceLanguage',{enumerable:false,configurable:true,get(){return this.editorMode==='typst'?'typst':'latex';},set(language){if(!['latex','typst'].includes(language))throw new Error('无效的源码语言');this.editorMode=language;}});return state;
}
export function classifyRenderError(message,source,language,backend='builtin'){
  if(backend==='local')return /未检测到|工具不可执行|No such file|not executable/i.test(message)?'environment':'local-failure';
  // Only positively identified unsupported features suggest a native retry.
  if(language==='typst'&&/(?:^|\n)\s*#(?:set|show|let|import|include|context)\b/.test(source))return 'capability';
  let depth=0;for(let i=0;i<source.length;i++){if(source[i]==='\\'){i++;continue;}if(source[i]==='{')depth++;if(source[i]==='}'&&--depth<0)return 'syntax';}
  if(depth!==0||/Missing|Extra|Expected|Unexpected|Unbalanced|Parse error|syntax error/i.test(message))return 'syntax';
  if(/Undefined control sequence|Unknown command|Unsupported (?:command|function|symbol)|not supported|内置模式只支持/i.test(message))return 'capability';
  return 'unknown';
}
