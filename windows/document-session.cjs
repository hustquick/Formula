// Host-owned file identity. Project metadata never authorizes a filesystem path.
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
function atomicWrite(file,bytes){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=path.join(path.dirname(file),'.'+path.basename(file)+'.'+randomUUID()+'.tmp');
 let mode=0o600;try{mode=fs.statSync(file).mode&0o777;}catch{}
 try{fs.writeFileSync(temporary,bytes,{flag:'wx',mode});fs.renameSync(temporary,file);}
 finally{try{fs.unlinkSync(temporary);}catch{}}
}
class DocumentSession{
 constructor(directory){
  this.stateFile=path.join(directory,'state.json');this.sessionFile=path.join(directory,'document-session.json');this.pending=new Map();
  const saved=readJSON(this.sessionFile,null);
  this.session=saved?.version===1&&typeof saved.id==='string'&&saved.id&&saved.draft&&typeof saved.draft==='object'&&!Array.isArray(saved.draft)?saved:null;
  this.state=this.session?.draft??readJSON(this.stateFile,{});
  this.file=this.session&&typeof this.session.path==='string'&&path.isAbsolute(this.session.path)&&/^[a-f0-9]{64}$/.test(this.session.digest||'')?this.session.path:null;
  this.fileDigest=this.file?this.session.digest:null;
 }
 launch(){
  const s=this.session;
  return clone({state:this.state,identity:s?{id:s.id,name:s.name,savedSignature:s.savedSignature??null}:null});
 }
 record(state,status){
  if(!status||typeof status.id!=='string'||!status.id)throw Error('公式文档身份无效');
  if(!state||typeof state!=='object'||Array.isArray(state))throw Error('公式草稿无效');
  if(status.id!==this.session?.id){this.file=null;this.fileDigest=null;}
  const session={version:1,id:status.id,name:status.name||'未命名公式',savedSignature:status.savedSignature??null,draft:clone(state)};
  if(this.file&&this.fileDigest){session.path=this.file;session.digest=this.fileDigest;}
  atomicWrite(this.sessionFile,JSON.stringify(session));
  this.session=session;this.state=session.draft;
  // Compatibility record; launch always prefers the paired session.
  atomicWrite(this.stateFile,JSON.stringify(this.state));
 }
 async save(data,chooseFile){
  const id=data.documentID;
  if(!this.session||typeof id!=='string'||id!==this.session.id||typeof data.base64!=='string'||typeof data.signature!=='string')throw Error('公式文档状态无效');
  let file=this.file;
  if(data.saveAs===true||!file){
   const result=await chooseFile(data.name||'equation.mathforge');
   if(result.canceled||!result.filePath)return {cancelled:true};
   file=result.filePath;
  }else{
   let current;try{current=digest(fs.readFileSync(file));}catch{}
   if(!this.fileDigest||current!==this.fileDigest)throw Error('文件已被其他程序修改、移动或删除。当前编辑已保留，请使用“另存为”保存副本。');
  }
  if(id!==this.session?.id)throw Error('当前公式已改变，旧保存操作已取消');
  const bytes=Buffer.from(data.base64,'base64');
  atomicWrite(file,bytes);
  this.file=file;this.fileDigest=digest(bytes);
  this.record(this.state,{...this.session,name:path.basename(file),savedSignature:data.signature});
  return {saved:true,name:path.basename(file)};
 }
 prepareOpen(file){
  const bytes=fs.readFileSync(file),text=bytes.toString('utf8'),ext=path.extname(file).slice(1).toLowerCase();
  let project=false;try{project=['mathforge','json'].includes(ext)&&JSON.parse(text).format==='mathforge-equation';}catch{}
  if(!project)return {text,ext};
  const token=randomUUID();this.pending.clear();this.pending.set(token,{file,digest:digest(bytes)});
  return {text,ext,name:path.basename(file),token};
 }
 opened(token,id){
  const selected=this.pending.get(token);this.pending.delete(token);
  if(!selected||!id||id!==this.session?.id)return false;
  this.file=selected.file;this.fileDigest=selected.digest;
  this.record(this.state,this.session);return true;
 }
}
module.exports={DocumentSession};
