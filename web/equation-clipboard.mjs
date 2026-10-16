// Host-neutral representations of one captured FormulaObject revision.
// A host chooses a supported type; ordering cannot override host preferences.
export function equationClipboard(object,{latex,mathml,graphics={},editableOnly=false}){
  if(!object?.identity?.formulaId||typeof latex!=='string'||typeof mathml!=='string'||!mathml.startsWith('<math'))throw Error('当前公式没有可用的可编辑数学表示');
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->'+mathml+'<!--EndFragment--></body></html>';
  return {formulaId:object.identity.formulaId,revision:object.revision,sourceRevision:object.content.revision,mathml,html,latex,text:editableOnly?mathml:latex,equation:JSON.stringify({format:'mathforge-equation',version:1,state:{formulaObject:object}}),...(editableOnly?{}:graphics)};
}
