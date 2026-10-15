const assert=require('node:assert/strict');
(async()=>{
 const {FormulaHistory}=await import('../web/formula-history.mjs');
 const snap=(text,extra={})=>({rawSource:text,latex:'x',editorMode:'latex',formulaContent:{authority:{language:'latex',text,origin:'source'},representations:{}},...extra});
 const h=new FormulaHistory();h.observe(snap('\\text{a b}'));h.observe(snap('\\text{ab}'));
 assert.equal(h.formulas.length,2,'different exact authorities must not collapse under the same rendered LaTeX');
 const persisted=JSON.parse(JSON.stringify(h.serialize())),restored=new FormulaHistory(persisted);
 restored.observe(snap('next'),'输入源码');assert.equal(restored.versions.at(-1).before.rawSource,'\\text{ab}');assert.equal(restored.versions.at(-1).title,'输入源码');
 const mode=new FormulaHistory();const original=snap('\\cfrac{1}{x}');mode.observe(original);mode.observe({...original,rawSource:'1/x',editorMode:'typst'});assert.equal(mode.formulas.length,1);assert.equal(mode.versions.length,0);assert.equal(mode.formulas[0].snapshot.editorMode,'typst');
 mode.observe({...original,rawSource:'\\frac{',formulaContent:{authority:{language:'latex',text:'\\frac{',origin:'source'},validation:'pending'}});assert.equal(mode.versions.at(-1).after.rawSource,'\\frac{');
 const saved=restored.serialize();saved.formulas[0].snapshot.rawSource='outside mutation';assert.notEqual(restored.formulas[0].snapshot.rawSource,'outside mutation');
 restored.clear(restored.previous);const clean=new FormulaHistory(JSON.parse(JSON.stringify(restored.serialize())));assert.equal(clean.formulas.length,0);assert.equal(clean.versions.length,0);clean.observe(snap('next'));assert.equal(clean.formulas.length,0,'opening/reloading does not refill cleared history');clean.observe(snap('new edit'));assert.equal(clean.formulas.length,1);
 const small=new FormulaHistory({}, {limit:3,bytes:4000});for(let i=0;i<15;i++)small.observe(snap('x'+i));assert(small.formulas.length<=3&&small.versions.length<=3);assert(Buffer.byteLength(JSON.stringify(small.serialize()))<=4000);
 const before=small.serialize();let oversize=false;small.onOversize=()=>oversize=true;assert.equal(small.observe(snap('大'.repeat(5000))),false);assert(oversize);assert.deepEqual(small.serialize(),before);
 const legacy=new FormulaHistory({formulas:[null,{id:'old',snapshot:{rawSource:'legacy',latex:'legacy'}}],versions:[{},null]});assert.equal(legacy.formulas.length,1);assert.equal(legacy.versions.length,0);legacy.observe(snap('current'));assert.equal(legacy.versions[0].before.rawSource,'legacy');
 console.log('PASS exact authority identity, continuous restart versions, representation metadata, invalid source, immutable snapshots, clear/reload, bounded UTF-8 storage, oversize isolation and legacy validation');
})().catch(error=>{console.error(error);process.exit(1)});
