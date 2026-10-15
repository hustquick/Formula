const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 for(const mode of ['latex','typst']){
  await p.evaluate(mode=>FormulaCommands.execute(mode==='latex'?'switchLatex':'switchTypst'),mode);
  const text=mode==='latex'?'  \\frac{unfinished\n':'  frac(x,\n';
  const r=await p.evaluate(text=>{const s=document.querySelector('#source');s.value=text;s.dispatchEvent(new Event('input',{bubbles:true}));return JSON.parse(localStorage.getItem('mathforge'));},text);assert.equal(r.formulaContent.authority.text,text);assert.equal(r.formulaContent.validation,'pending');
  // Simulate fresh native/web process from the immediate durable snapshot,
  // without delivering blur/beforeunload or waiting for the parser timer.
  const q=await b.newPage();await q.addInitScript(s=>window.FormulaSavedState=s,r);await q.goto('file://'+process.cwd()+'/web/index.html');await q.waitForFunction(()=>window.FormulaCommands);assert.equal(await q.locator('#source').inputValue(),text);assert.equal(await q.evaluate(()=>FormulaTest.getState().editorMode),mode);await q.close();
  await p.evaluate(()=>FormulaCommands.execute('importContent',{text:'x',ext:'tex'}));
 }
 await p.evaluate(async()=>{await FormulaCommands.execute('switchToVisual');const m=document.querySelector('math-field');m.position=m.lastOffset;m.insert('\\placeholder{}',{silenceNotifications:false});m.dispatchEvent(new Event('input'));});
 const visual=await p.evaluate(()=>JSON.parse(localStorage.getItem('mathforge')));assert.match(visual.visualDraft,/placeholder/);
 const q=await b.newPage();await q.addInitScript(s=>window.FormulaSavedState=s,visual);await q.goto('file://'+process.cwd()+'/web/index.html');await q.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());assert.equal(await q.locator('math-field').evaluate(m=>m.getValue('latex')),visual.visualDraft);await q.close();
 console.log('PASS immediate LaTeX/Typst incomplete draft persistence and fresh-process exact recovery; visual placeholder durable recovery');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
