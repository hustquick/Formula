const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const command=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 await command('importContent',{text:'x+y+z+w',ext:'tex'});await command('setDocumentSetting',{key:'displayMode',value:'inline'});
 const r=await p.evaluate(async()=>{const s=FormulaTest.getState(),container=await MathJax.tex2svgPromise(s.latex,{display:false}),expected=[...container.querySelectorAll('svg')].reduce((n,svg)=>n+svg.querySelectorAll('[data-c]').length,0),actual=document.querySelector('#preview svg').querySelectorAll('[data-c]').length;return{fragments:container.querySelectorAll('svg').length,expected,actual};});
 assert.equal(r.fragments,1,'a complete formula must be one exportable SVG');assert.equal(r.actual,r.expected,'preview contains every math glyph');
 await command('switchToVisual');await p.evaluate(()=>{const m=document.querySelector('math-field');m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));FormulaRevisions.flush();});
 const before=await p.evaluate(()=>{const m=document.querySelector('math-field');return {latex:m.getValue('latex'),selection:JSON.stringify(m.selection)};});await p.evaluate(()=>FormulaTest.readSource());const after=await p.evaluate(()=>{const m=document.querySelector('math-field');return {latex:m.getValue('latex'),selection:JSON.stringify(m.selection)};});assert.deepEqual(after,before,'re-reading unchanged source preserves visual placeholder and selection');
 // Continuous editing crosses representations without creating independent documents.
 await command('importContent',{text:'x+y',ext:'tex'});await command('switchTypst');
 await p.locator('#source').fill('a + b');await p.evaluate(()=>FormulaTest.readSource());await command('switchToVisual');
 await p.evaluate(()=>{const m=document.querySelector('math-field');m.focus();m.select();});await command('accent.hat');
 await command('switchLatex');const wrapped=await p.locator('#source').inputValue();assert.match(wrapped,/\\hat/);assert.match(wrapped,/a/);assert.match(wrapped,/b/);
 await command('undo');await command('undo');assert(!await p.locator('#source').inputValue().then(x=>x.includes('hat')));await command('redo');await command('redo');assert.equal(await p.locator('#source').inputValue(),wrapped);
 for(const language of ['tex','typ']){await command('importContent',{text:'a+b+c+d',ext:language});await p.evaluate(()=>FormulaTest.readSource());const svg=await p.evaluate(()=>FormulaTest.getSVG());assert(svg);assert(await p.locator('#preview svg [data-c]').count()>=7);const metadata=await p.locator('#preview metadata').textContent();assert.equal(JSON.parse(metadata).state.rawSource,'a+b+c+d');}
 // A syntax failure keeps original text and last-valid preview; correction
 // replaces the stale image and metadata with the current document.
 await command('switchLatex');await p.locator('#source').fill('\\frac{');await p.evaluate(()=>FormulaTest.readSource());assert.equal(await p.locator('#source').inputValue(),'\\frac{');assert.equal(await p.evaluate(()=>FormulaTest.getSVG()),null);
 await p.locator('#source').fill('m+n+p');await p.evaluate(()=>FormulaTest.readSource());assert(await p.evaluate(()=>FormulaTest.getSVG()));assert.equal(JSON.parse(await p.locator('#preview metadata').textContent()).state.rawSource,'m+n+p');
 console.log('PASS complete inline preview/export glyphs and unchanged-source visual placeholder/selection continuity');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
