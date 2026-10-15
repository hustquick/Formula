const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const p=await browser.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 const history=()=>p.evaluate(()=>FormulaDocumentHistory.serialize());
 await command('clearFormulaHistory');
 await command('importContent',{text:'a',ext:'tex'});await command('importContent',{text:'b',ext:'tex'});await command('importContent',{text:'c',ext:'tex'});
 let h=await history();assert(h.formulas.some(x=>x.snapshot.rawSource==='a'));assert(h.formulas.some(x=>x.snapshot.rawSource==='b'));assert(h.versions.some(x=>x.before.rawSource==='a'&&x.after.rawSource==='b'));
 const last=h.versions.at(-1);assert.equal(last.title,'导入 / 识别公式');
 await p.reload();await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 await command('importContent',{text:'d',ext:'tex'});h=await history();assert(h.versions.some(x=>x.before.rawSource==='c'&&x.after.rawSource==='d'),'version chain continues after reload');
 const target=h.versions.find(x=>x.after.rawSource==='b');await command('restoreFormulaVersion',{id:target.id});assert.equal(await p.locator('#source').inputValue(),'b');
 await command('undo');assert.equal(await p.locator('#source').inputValue(),'d');await command('redo');assert.equal(await p.locator('#source').inputValue(),'b');
 await command('importContent',{text:'e',ext:'tex'});h=await history();assert(h.versions.some(x=>x.before.rawSource==='b'&&x.after.rawSource==='e'));assert(h.versions.some(x=>x.after.rawSource==='d'),'user history remains after Undo branches');
 await command('showHistory');await p.getByRole('textbox',{name:'搜索命令或历史'}).fill('a');assert(await p.getByRole('button',{name:'打开历史公式 a',exact:true}).count());await p.keyboard.press('Escape');
 // Imported provenance stays in older snapshots after subsequent source edits.
 const saved=await p.evaluate(()=>JSON.parse(JSON.stringify(FormulaTest.getState())));saved.formulaContent.authority.origin='ocr';saved.formulaContent.authority.recognition={raw:' e ',engine:'controlled-fixture'};
 await command('importContent',{text:JSON.stringify({format:'mathforge-equation',state:saved}),ext:'mathforge'});
 await p.locator('#source').fill('e+1');await p.evaluate(()=>{FormulaTest.readSource();FormulaRevisions.flush();});
 h=await history();assert(h.versions.some(x=>x.before.formulaContent?.authority.recognition?.raw===' e '&&x.after.rawSource==='e+1'));
 // Unfinished source is recorded with its exact whitespace, not an old preview.
 const unfinished='  \\frac{unfinished\n';await p.locator('#source').fill(unfinished);await p.evaluate(()=>{FormulaTest.readSource();FormulaRevisions.flush();});
 h=await history();assert(h.formulas.some(x=>x.snapshot.formulaContent.authority.text===unfinished));
 const incomplete=h.versions.at(-1);await command('importContent',{text:'x',ext:'tex'});await command('restoreFormulaVersion',{id:incomplete.id});assert.equal(await p.locator('#source').inputValue(),unfinished);
 await command('importContent',{text:'x',ext:'tex'});await command('switchToVisual');
 await p.evaluate(()=>{const m=document.querySelector('math-field');m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));FormulaRevisions.flush();});
 h=await history();const visual=h.versions.findLast(x=>x.after.visualLatex?.includes('placeholder'));assert(visual);
 await command('importContent',{text:'y',ext:'tex'});await command('restoreFormulaVersion',{id:visual.id});assert.equal(await p.locator('math-field').evaluate(m=>m.getValue('latex')),visual.after.visualLatex);
 const index=await p.evaluate(()=>FormulaRevisions.index);await command('clearFormulaHistory');assert.equal((await history()).formulas.length,0);assert.equal((await history()).versions.length,0);assert.equal(await p.evaluate(()=>FormulaRevisions.index),index);
 await p.reload();await p.waitForFunction(()=>window.FormulaCommands);assert.equal((await history()).formulas.length,0,'cleared history stays cleared after reload');
 await command('importContent',{text:'new edit',ext:'tex'});assert((await history()).formulas.length>0);
 console.log('PASS automatic command history, exact restart chain, search, restore/edit/Undo/Redo, retained old branches and incoming OCR metadata, invalid source, visual placeholders, clear/reload and Undo isolation');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
