import {documentSnapshotSettingKeys} from './document-settings.mjs';
// The only live compatibility adapter. Legacy writes never promote content.
export function installFormulaProjection(state,current,normalize){
  for(const key of ['latex','rawSource'])Object.defineProperty(state,key,{enumerable:true,configurable:true,
    get:()=>{const object=current();return normalize(key==='latex'?(object.get('latex')?.text??''):(object.get(state.sourceLanguage)?.text??object.authority.text));},set:()=>{}});
  Object.defineProperty(state,'visualDraft',{enumerable:true,configurable:true,get:()=>current().cached('visual')??undefined,set:()=>{}});
  for(const key of documentSnapshotSettingKeys)Object.defineProperty(state,key,{enumerable:true,configurable:true,
    get:()=>current().formatting[key],set:value=>current().setFormatting({...current().formatting,[key]:value})});
  Object.defineProperty(state,'editorMode',{enumerable:true,configurable:true,get:()=>current().presentation.mode,set:mode=>current().setPresentation(mode)});
}
