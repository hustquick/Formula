// Exact source records and meaningful versions are separate from Undo snapshots.
const clone=value=>JSON.parse(JSON.stringify(value));
const valid=snapshot=>snapshot&&typeof snapshot.rawSource==='string';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export function formulaIdentity(snapshot){
  const authority=snapshot.formulaObject?.content?.authority??snapshot.formulaContent?.authority;
  return JSON.stringify(authority?[authority.language,authority.text]:[snapshot.latex||'',snapshot.rawSource||'']);
}
function contentSignature(snapshot){return JSON.stringify([formulaIdentity(snapshot),snapshot.formulaObject?.content?.authority??snapshot.formulaContent?.authority,snapshot.formulaObject?.recognition,snapshot.visualLatex?.includes('\\placeholder')?snapshot.visualLatex:undefined]);}
export class FormulaHistory{
  constructor(saved={}, {limit=100,bytes:budget=4*1024*1024}={}){
    saved=saved&&typeof saved==='object'?saved:{};this.limit=limit;this.bytes=budget;
    this.formulas=(Array.isArray(saved.formulas)?saved.formulas:[]).filter(x=>x&&typeof x.id==='string'&&valid(x.snapshot)).slice(0,limit).map(x=>({...clone(x),key:formulaIdentity(x.snapshot)}));
    this.versions=(Array.isArray(saved.versions)?saved.versions:[]).filter(x=>x&&typeof x.id==='string'&&valid(x.before)&&valid(x.after)).slice(-limit).map(clone);
    this.previous=valid(saved.previous)?clone(saved.previous):clone(this.formulas[0]?.snapshot??this.versions.at(-1)?.after??null);
    this.clearedSignature=typeof saved.clearedSignature==='string'?saved.clearedSignature:null;
    this.trim();
  }
  trim(){
    while(this.versions.length>this.limit||bytes(this.serialize())>this.bytes&&this.versions.length)this.versions.shift();
    while(this.formulas.length>this.limit||bytes(this.serialize())>this.bytes&&this.formulas.length)this.formulas.pop();
    if(bytes(this.serialize())>this.bytes)this.previous=null;
    if(bytes(this.serialize())>this.bytes)this.clearedSignature=null;
  }
  observe(snapshot,title='编辑公式'){
    if(!valid(snapshot))return false;
    const signature=contentSignature(snapshot);
    if(signature===this.clearedSignature)return false;
    if(!snapshot.rawSource&&!this.previous)return false;
    const key=formulaIdentity(snapshot),now=Date.now(),copy=JSON.parse(JSON.stringify(snapshot));
    if(bytes({version:1,formulas:[{id:'x'.repeat(36),key,time:now,snapshot:copy}],versions:[],previous:copy,clearedSignature:null})>this.bytes){this.onOversize?.();return false;}
    this.clearedSignature=null;
    const existing=this.formulas.find(x=>x.key===key);
    if(existing){existing.snapshot=copy;existing.time=now;this.formulas=this.formulas.filter(x=>x!==existing);this.formulas.unshift(existing);}
    else this.formulas.unshift({id:crypto.randomUUID(),key,time:now,snapshot:copy});
    if(this.previous&&contentSignature(this.previous)!==signature)this.versions.push({id:crypto.randomUUID(),time:now,title,before:this.previous,after:copy});
    this.previous=copy;this.trim();return true;
  }
  remove(id){this.formulas=this.formulas.filter(x=>x.id!==id);}
  clear(snapshot=this.previous){this.clearedSignature=valid(snapshot)?contentSignature(snapshot):null;this.formulas=[];this.versions=[];this.previous=null;}
  serialize(){return clone({version:1,formulas:this.formulas,versions:this.versions,previous:this.previous,clearedSignature:this.clearedSignature});}
}
