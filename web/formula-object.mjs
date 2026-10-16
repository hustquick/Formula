import {FormulaContent} from './formula-content.mjs';
import {captureDocumentSettings} from './document-settings.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
export class FormulaObject extends FormulaContent{
  constructor(saved,{language='latex',text='',origin='legacy',formatting={},mode=language}={}){
    const record=saved?.objectVersion===1?saved:null;
    const content=record?.content??saved;
    if(record&&(!content||!['latex','typst'].includes(content.authority?.language)||typeof content.authority.text!=='string'||!Number.isSafeInteger(content.revision)||content.revision<0))throw Error('Invalid FormulaObject snapshot');
    if(record&&(content.representations?.[content.authority.language]?.text!==content.authority.text||content.representations[content.authority.language].revision!==content.revision))throw Error('Inconsistent FormulaObject authority');
    // An object snapshot is authoritative; compatibility source cannot veto it.
    const active=record?.content?.authority?.language??language;
    super(content,{language:record?active:language,text:record?(content.representations?.[active]?.text??content.authority.text):text,origin});
    this.authority.timestamp??=Date.now();
    this.identity=clone(record?.identity??{formulaId:crypto.randomUUID()});
    this.objectRevision=record?.revision??this.revision;
    this.presentation=clone(record?.presentation??{mode});
    this.formatting=clone(record?.formatting??formatting);
    this.provenance=clone(record?.provenance??[]);
    this.recognition=clone(record?.recognition??null);
    this.derived=clone(record?.derived??{});
    this.nativeMath=clone(record?.nativeMath??null);
  }
  edit(language,text,origin='source',metadata){
    const changed=super.edit(language,text,origin);
    if(changed){this.nativeMath=null;this.objectRevision++;this.derived={};this.authority.timestamp=Date.now();this.provenance.push({revision:this.objectRevision,origin,language,time:this.authority.timestamp});}
    if(metadata){this.recognition=clone(metadata);if(!changed){this.objectRevision++;this.authority.timestamp=Date.now();this.provenance.push({revision:this.objectRevision,origin,language,time:this.authority.timestamp});}this.authority.origin=origin;}
    return changed;
  }
  attachNativeMath(record){
    if(record?.format!=='wps-native-math'||typeof record.omml!=='string'||typeof record.package!=='string'||record.latex!==this.get('latex')?.text)throw Error('Invalid native math record');
    this.nativeMath=clone({...record,sourceRevision:this.revision});this.objectRevision++;this.derived={};
  }
  originalNativeMath(){return this.nativeMath?.sourceRevision===this.revision?clone(this.nativeMath):null;}
  setPresentation(mode){if(!['visual','latex','typst'].includes(mode))throw Error('Invalid presentation');this.presentation.mode=mode;}
  setVisual(tree){
    const previous=this.cached('visual');
    if(previous!==null&&previous!==tree||previous===null&&tree.includes('\\placeholder')){this.objectRevision++;this.derived={};}
    this.cache('visual',tree,'MathLive@0.111.1');
  }
  setFormatting(settings){const next=captureDocumentSettings(settings);if(JSON.stringify(next)!==JSON.stringify(this.formatting)){this.formatting=clone(next);this.objectRevision++;this.derived={};}}
  cache(format,value,producer){this.derived[format]={value,revision:this.objectRevision,sourceRevision:this.revision,producer};return value;}
  cached(format){const r=this.derived[format];return r?.revision===this.objectRevision?r.value:null;}
  snapshot(){return clone({objectVersion:1,identity:this.identity,revision:this.objectRevision,content:super.serialize(),presentation:this.presentation,formatting:this.formatting,provenance:this.provenance,recognition:this.recognition,nativeMath:this.originalNativeMath(),derived:Object.fromEntries(Object.entries(this.derived).filter(([key])=>key==='visual'||key==='mathml'))});}
}
