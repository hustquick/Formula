import {captureDocumentSettings} from './document-settings.mjs';
export function documentSignature(state){return JSON.stringify([state.formulaContent?.authority?.text??state.rawSource,state.formulaContent?.authority?.language??state.editorMode,state.editorMode==='visual'?state.visualDraft:undefined,captureDocumentSettings(state)]);}
// File identity is session-owned by the native host, never restored from an
// imported project's metadata. Draft recovery remains independent of that file.
export class DocumentLifecycle{
  constructor(saved){this.id=typeof saved?.id==='string'?saved.id:crypto.randomUUID();this.name=typeof saved?.name==='string'?saved.name:'未命名公式';this.savedSignature=typeof saved?.savedSignature==='string'?saved.savedSignature:null;}
  adopt(name,state){this.id=crypto.randomUUID();this.name=name;this.savedSignature=documentSignature(state);}
  getStatus(state){return{id:this.id,name:this.name,dirty:this.savedSignature!==documentSignature(state),savedSignature:this.savedSignature};}
  saved(name,signature){this.name=name||this.name;this.savedSignature=signature;}
}
