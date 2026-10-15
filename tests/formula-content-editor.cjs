const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const p=await browser.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands);
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 const state=()=>p.evaluate(()=>FormulaTest.getState());
 const original='  '+String.raw`\cfrac{1}{x}`+'\n';
 await command('importContent',{text:original,ext:'tex'});await p.waitForFunction(()=>document.querySelector('#preview svg'));
 await command('switchTypst');let s=await state();const revision=s.formulaContent.revision;
 assert.equal(s.formulaContent.authority.text,original);assert.equal(s.formulaContent.representations.typst.fidelity,'unverified');
 await p.reload();await p.waitForFunction(()=>window.FormulaCommands&&document.querySelector('#preview svg'));
 await command('switchLatex');assert.equal(await p.locator('#source').inputValue(),original);
 await command('switchToVisual');await command('switchTypst');assert.equal((await state()).formulaContent.authority.text,original);
 await p.locator('#source').fill('2/x');await p.evaluate(()=>FormulaTest.readSource());
 assert.equal((await state()).formulaContent.authority.language,'typst');assert((await state()).formulaContent.revision>revision);
 await command('switchLatex');assert.match(await p.locator('#source').inputValue(),/2/);assert(!await p.locator('#source').inputValue().then(x=>x.includes('cfrac')));
 await command('undo');await command('undo');assert.equal((await state()).formulaContent.authority.text,original);
 await command('redo');assert.equal((await state()).formulaContent.authority.text,'2/x');
 const snapshot=await state();await command('importContent',{text:JSON.stringify({format:'mathforge-equation',state:snapshot}),ext:'mathforge'});
 assert.equal((await state()).formulaContent.authority.text,'2/x');
 await p.waitForFunction(()=>FormulaDocumentHistory.formulas.some(x=>x.snapshot.formulaContent?.authority.text==='2/x'));
 // Invalid edits are preserved as pending source, never replaced with old derived math.
 await command('switchLatex');await p.locator('#source').fill('\\frac{');await p.evaluate(()=>FormulaTest.readSource());await command('switchTypst');
 assert.equal(await p.locator('#source').inputValue(),'\\frac{');assert.equal((await state()).editorMode,'latex');
 assert.equal((await state()).formulaContent.authority.text,'\\frac{');assert(!((await state()).formulaContent.representations.typst));
 await command('importContent',{text:original,ext:'tex'});
 for(const width of [760,1120,1440]){
  await p.setViewportSize({width,height:1000});const before=await p.locator('.input-editors').boundingBox();
  for(const mode of ['switchToVisual','switchLatex','switchTypst','switchLatex']){
   await command(mode);const after=await p.locator('.input-editors').boundingBox();assert.equal(after.y,before.y);assert.equal(after.height,before.height);
  }
  assert.equal(await p.locator('#source').inputValue(),original);
 }
 console.log('PASS editor contract: Visual/LaTeX/Typst, exact reload, source edits, Undo/Redo, History, save/import and invalid-source protection');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
