// User-facing formula records and meaningful versions are separate from Undo snapshots.
export function formulaIdentity(snapshot){return String(snapshot.latex||snapshot.rawSource||'').replace(/\\(?:left|right)\b/g,'').replace(/\s+/g,'');}
export class FormulaHistory{
  constructor(saved={}){this.formulas=Array.isArray(saved.formulas)?saved.formulas.slice(0,100):[];this.versions=Array.isArray(saved.versions)?saved.versions.slice(-100):[];this.previous=null;}
  observe(snapshot,title='编辑公式'){
    if(!snapshot.rawSource?.trim())return false;
    const key=formulaIdentity(snapshot),now=Date.now(),copy=JSON.parse(JSON.stringify(snapshot));
    const existing=this.formulas.find(x=>x.key===key);
    if(existing){existing.snapshot=copy;existing.time=now;this.formulas=this.formulas.filter(x=>x!==existing);this.formulas.unshift(existing);}
    else this.formulas.unshift({id:crypto.randomUUID(),key,time:now,snapshot:copy});
    this.formulas=this.formulas.slice(0,100);
    if(this.previous&&formulaIdentity(this.previous)!==key)this.versions.push({id:crypto.randomUUID(),time:now,title,before:this.previous,after:copy});
    this.versions=this.versions.slice(-100);this.previous=copy;return true;
  }
  remove(id){this.formulas=this.formulas.filter(x=>x.id!==id);}
  clear(){this.formulas=[];}
  serialize(){return{formulas:this.formulas,versions:this.versions};}
}
