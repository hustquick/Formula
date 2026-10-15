const fonts=['newcm','asana','bonum','dejavu','fira','modern','pagella','schola','stix2','termes','tex'];
export function validateDocumentSetting(key,value){
  if(['size','padding','scale'].includes(key)){
    if(!['string','number'].includes(typeof value)||value==='')throw Error('请输入有效数值');
    const n=Number(value);if(!Number.isFinite(n)||(key==='size'&&(n<10||n>160))||(key==='padding'&&(n<0||n>80))||(key==='scale'&&n<=0))throw Error('字号范围 10–160 pt，留白范围 0–80 px，分辨率须大于零');return n;
  }
  if(['color','backgroundColor'].includes(key)){
    if(key==='backgroundColor'&&value==='transparent')return value;
    if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('请选择有效颜色');return value.toLowerCase();
  }
  if(['preamble','typstPreamble'].includes(key)&&typeof value==='string')return value;
  if(key==='displayMode'&&['inline','display'].includes(value))return value;
  if(key==='mathFont'&&fonts.includes(value))return value;
  throw Error('不支持的排版设置');
}
export const documentSettingControls={size:'size',padding:'padding',scale:'scale',color:'color',backgroundColor:'backgroundColor',preamble:'preamble',typstPreamble:'typst-preamble',displayMode:'display-mode',mathFont:'math-font'};

// Document layout fields shared by capture, deduplication and restoration.
// transparent is retained for compatibility; backgroundColor is canonical.
export const documentSnapshotSettingKeys=Object.freeze([...Object.keys(documentSettingControls),'transparent']);
export const captureDocumentSettings=value=>Object.fromEntries(documentSnapshotSettingKeys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
