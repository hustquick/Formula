import {captureDocumentSettings} from './document-settings.mjs';
export class CommandRegistry{
  constructor(onChange=()=>{}){this.commands=new Map();this.shortcuts=new Map();this.onChange=onChange;this.executions=new Set();}
  register(command){if(this.commands.has(command.id))throw Error('Duplicate command: '+command.id);if(command.shortcut){const key=command.shortcut.toLowerCase();if(this.shortcuts.has(key))throw Error('Duplicate shortcut: '+key);if(['meta+q','meta+w'].includes(key))throw Error('Reserved native shortcut: '+key);this.shortcuts.set(key,command.id);}this.commands.set(command.id,{category:'公式',enabled:()=>true,context:()=>true,undoable:false,mutation:'none',...command});}
  enabled(id,args){const c=this.commands.get(id);return !!c&&this.executionContext?.(c,args)!==false&&!!c.enabled(args)&&!!c.context(args);}
  async execute(id,args){const command=this.commands.get(id);if(!command||!this.enabled(id,args))return false;const execution={id,mutation:command.mutation};this.executions.add(execution);try{await command.execute(args);return true;}finally{this.executions.delete(execution);this.onChange();}}
  list(){return [...this.commands.values()].map(c=>({id:c.id,title:c.title,category:c.category,shortcut:c.shortcut||'',enabled:this.enabled(c.id),undoable:c.undoable,mutation:c.mutation}));}
  bindKeyboard(target=document){target.addEventListener('keydown',e=>{if(e.isComposing)return;const key=[e.metaKey||e.ctrlKey?'meta':'',e.altKey?'alt':'',e.shiftKey?'shift':'',e.key.toLowerCase()].filter(Boolean).join('+');const id=this.shortcuts.get(key);if(!id||this.keyboardContext?.(id,e)===false)return;e.preventDefault();this.execute(id).catch(error=>this.onError?.(error));},true);}
}
export class RevisionHistory{
  constructor(capture,restore,{limit=100,bytes=4*1024*1024}={}){this.capture=capture;this.restore=restore;this.limit=limit;this.bytes=bytes;this.entries=[];this.index=-1;this.restoring=false;this.timer=null;this.counter=0;this.restoreQueue=null;}
  signature(value){return JSON.stringify([value.formulaObject?.content?.authority??value.formulaContent?.authority,value.formulaObject?.recognition,value.rawSource,value.editorMode,value.editorMode==='visual'?value.visualLatex:undefined,captureDocumentSettings(value)]);}
  record(title='编辑公式',type='edit'){if(this.restoring)return;clearTimeout(this.timer);this.timer=null;const snapshot=this.capture();if(JSON.stringify(snapshot).length>this.bytes){this.onOversize?.();return;}if(this.index>=0&&this.signature(this.entries[this.index].snapshot)===this.signature(snapshot)){for(const key of ['pane','focus','sourceSelection','sourceScroll','visualSelection'])this.entries[this.index].snapshot[key]=snapshot[key];return;}this.entries=this.entries.slice(0,this.index+1);this.entries.push({id:++this.counter,title,type,time:Date.now(),snapshot});while(this.entries.length>1&&(this.entries.length>this.limit||JSON.stringify(this.entries).length>this.bytes))this.entries.shift();this.index=this.entries.length-1;this.onChange?.();}
  schedule(title,type){if(this.restoring)return;clearTimeout(this.timer);this.pending={title,type};this.timer=setTimeout(()=>this.record(title,type),450);this.onChange?.();}
  flush(){if(this.timer){clearTimeout(this.timer);this.timer=null;this.record(this.pending?.title||'编辑公式',this.pending?.type||'edit');}}
  // Resolve relative navigation only when the previous restore has finished.
  // The first operation starts synchronously so MathLive's public command adapter
  // retains its immediate source/selection update semantics.
  enqueueRestore(operation){
    const run=async()=>operation();
    const result=this.restoreQueue?this.restoreQueue.then(run,run):run();
    const settled=result.catch(()=>{});this.restoreQueue=settled;
    settled.then(()=>{if(this.restoreQueue===settled)this.restoreQueue=null;});
    return result;
  }
  async withOwnership(operation){
    this.busy=true;this.onBusyChange?.(true);
    try{return await operation();}
    finally{this.busy=false;this.onBusyChange?.(false);}
  }
  transaction(title,execute){return this.enqueueRestore(()=>this.withOwnership(async()=>{
    this.flush();this.record('编辑公式');
    const before=this.capture(),entries=this.entries.slice(),index=this.index;
    // Only an explicitly passed child context joins this transaction. Unrelated
    // events always queue; a global depth flag cannot distinguish them.
    const context={run:child=>child(context)};
    this.inTransaction=true;
    try{const result=await execute(context);this.record(title,'command');return result;}
    catch(error){
      this.restoring=true;
      try{await this.restore(before);this.entries=entries;this.index=index;}
      catch(rollbackError){throw new AggregateError([error,rollbackError],'编辑失败，且恢复原公式失败');}
      finally{this.restoring=false;this.onChange?.();}
      throw error;
    }finally{this.inTransaction=false;this.onChange?.();}
  }));}
  async restoreIndex(index){
    this.flush();if(index<0||index>=this.entries.length)return;
    this.restoring=true;const previous=this.index,before=this.capture();this.index=index;
    try{await this.restore(this.entries[index].snapshot);}
    catch(error){
      this.index=previous;
      try{await this.restore(before);}catch(rollbackError){throw new AggregateError([error,rollbackError],'历史恢复失败，且恢复当前公式失败');}
      throw error;
    }finally{this.restoring=false;this.onChange?.();}
  }
  go(index){return this.enqueueRestore(()=>this.withOwnership(()=>this.restoreIndex(index)));}
  undo(){return this.enqueueRestore(()=>this.withOwnership(()=>{this.flush();return this.restoreIndex(this.index-1);}));}
  redo(){return this.enqueueRestore(()=>this.withOwnership(()=>{this.flush();return this.restoreIndex(this.index+1);}));}
  get canUndo(){return this.index>0||!!this.timer||!!this.busy;}
  get canRedo(){return this.index<this.entries.length-1||!!this.busy;}
}
