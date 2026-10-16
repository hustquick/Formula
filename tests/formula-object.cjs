const assert=require('node:assert/strict');
(async()=>{
 const {FormulaObject}=await import('../web/formula-object.mjs');
 const f=new FormulaObject(null,{text:'x',formatting:{size:32},mode:'latex'});const id=f.identity.formulaId;
 f.parsed('x');const n=f.revision;f.edit('latex','x+1');assert.equal(f.revision,n+1);assert.equal(f.get('typst'),null);
 f.parsed('x+1');f.resolve('typst',()=> 'x+1');const r=f.revision;f.setPresentation('typst');assert.equal(f.revision,r);
 f.edit('typst','x+2');assert.equal(f.get('latex'),null);assert.equal(f.identity.formulaId,id);
 f.edit('latex','z','ocr',{engine:'fixture',formulas:[{latex:'z',bbox:[1,2,3,4]}]});f.parsed('z');f.edit('latex','z+1');assert.equal(f.recognition.engine,'fixture');assert.equal(f.identity.formulaId,id);
 f.parsed('z+1');f.cache('mathml','<math/>','fixture');f.setFormatting({size:40});assert.equal(f.cached('mathml'),null);
 const saved=f.snapshot();const loaded=new FormulaObject(saved,{text:'CORRUPTED',language:'latex'});assert.deepEqual(loaded.snapshot(),saved);
 saved.content.authority.text='outside';assert.equal(f.authority.text,'z+1');
 for(const rep of Object.values(f.serialize().representations))assert.equal(rep.revision,f.revision);
 console.log('PASS object lineage, source revisions, presentation stability, OCR metadata, formatting/cache invalidation, authoritative restore and immutable revision snapshots');
})().catch(e=>{console.error(e);process.exit(1)});
