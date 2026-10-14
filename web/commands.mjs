export class CommandRegistry{
  constructor(onChange=()=>{}){this.commands=new Map();this.shortcuts=new Map();this.onChange=onChange;}
  register(command){if(this.commands.has(command.id))throw Error('Duplicate command: '+command.id);if(command.shortcut){const key=command.shortcut.toLowerCase();if(this.shortcuts.has(key))throw Error('Duplicate shortcut: '+key);if(['meta+q','meta+w'].includes(key))throw Error('Reserved native shortcut: '+key);this.shortcuts.set(key,command.id);}this.commands.set(command.id,{category:'公式',enabled:()=>true,context:()=>true,undoable:false,...command});}
  enabled(id){return !!this.commands.get(id)?.enabled();}
  async execute(id,args){const command=this.commands.get(id);if(!command||!this.enabled(id))return false;await command.execute(args);this.onChange();return true;}
  list(){return [...this.commands.values()].map(c=>({id:c.id,title:c.title,category:c.category,shortcut:c.shortcut||'',enabled:this.enabled(c.id),undoable:c.undoable}));}
  bindKeyboard(target=document){target.addEventListener('keydown',e=>{if(e.isComposing)return;const key=[e.metaKey||e.ctrlKey?'meta':'',e.altKey?'alt':'',e.shiftKey?'shift':'',e.key.toLowerCase()].filter(Boolean).join('+');const id=this.shortcuts.get(key);if(!id||this.keyboardContext?.(id,e)===false)return;e.preventDefault();this.execute(id).catch(error=>this.onError?.(error));},true);}
}
export class RevisionHistory{
  constructor(capture,restore,{limit=100,bytes=4*1024*1024}={}){this.capture=capture;this.restore=restore;this.limit=limit;this.bytes=bytes;this.entries=[];this.index=-1;this.restoring=false;this.timer=null;this.counter=0;}
  signature(value){return JSON.stringify([value.rawSource,value.editorMode,value.size,value.padding,value.color,value.transparent,value.scale,value.mathFont,value.displayMode,value.preamble,value.typstPreamble]);}
  record(title='编辑公式',type='edit'){if(this.restoring)return;clearTimeout(this.timer);this.timer=null;const snapshot=this.capture();if(JSON.stringify(snapshot).length>this.bytes){this.onOversize?.();return;}if(this.index>=0&&this.signature(this.entries[this.index].snapshot)===this.signature(snapshot)){for(const key of ['pane','focus','sourceSelection','sourceScroll','visualSelection'])this.entries[this.index].snapshot[key]=snapshot[key];return;}this.entries=this.entries.slice(0,this.index+1);this.entries.push({id:++this.counter,title,type,time:Date.now(),snapshot});while(this.entries.length>1&&(this.entries.length>this.limit||JSON.stringify(this.entries).length>this.bytes))this.entries.shift();this.index=this.entries.length-1;this.onChange?.();}
  schedule(title,type){if(this.restoring)return;clearTimeout(this.timer);this.pending={title,type};this.timer=setTimeout(()=>this.record(title,type),450);this.onChange?.();}
  flush(){if(this.timer){clearTimeout(this.timer);this.timer=null;this.record(this.pending?.title||'编辑公式',this.pending?.type||'edit');}}
  async go(index){this.flush();if(index<0||index>=this.entries.length)return;this.restoring=true;const previous=this.index;this.index=index;try{await this.restore(this.entries[index].snapshot);}catch(error){this.index=previous;throw error;}finally{this.restoring=false;}this.onChange?.();}
  async undo(){this.flush();if(this.index>0)await this.go(this.index-1);}
  async redo(){this.flush();if(this.index<this.entries.length-1)await this.go(this.index+1);}
  get canUndo(){return this.index>0||!!this.timer;}
  get canRedo(){return this.index<this.entries.length-1;}
}
