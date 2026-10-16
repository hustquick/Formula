// Exercise the production Python converter in browser bridge tests, not a mock OMML serializer.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
module.exports=async page=>{
 await page.exposeFunction('FormulaSourceConvertForTest',latex=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'formula-source-bridge-'));
  try{const input=path.join(dir,'source.tex'),output=path.join(dir,'output');fs.writeFileSync(input,latex);const python=process.env.FORMULA_DOCUMENT_PYTHON||path.join(os.homedir(),'Library/Application Support/MathForge/OCR/venv-document/bin/python3');const r=spawnSync(python,['macos/formula-latex-ooxml.py',input,output],{encoding:'utf8',timeout:30000});if(r.status!==0)throw Error(r.stderr||r.error?.message||'Source conversion failed');return {latex,omml:fs.readFileSync(path.join(output,'candidate.omml'),'utf8'),gvml:fs.readFileSync(path.join(output,'candidate.gvml')).toString('base64')};}finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
 await page.addInitScript(()=>{window.FormulaSourceEquationSupported=true;window.FormulaSourceTestReply=m=>{if(m.action==='prepareEquation')window.FormulaSourceConvertForTest(m.latex).then(result=>window.FormulaNativeReply(m.id,result),error=>window.FormulaNativeReply(m.id,{error:error.message}));}});
};
