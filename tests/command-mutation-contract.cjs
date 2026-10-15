const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const {CommandRegistry}=await import('../web/commands.mjs');let executed=0,changed=0;
 const r=new CommandRegistry(()=>changed++);r.register({id:'guarded',title:'Guarded',mutation:'document',context:args=>args?.allowed===true,execute:()=>executed++});
 assert.equal(await r.execute('guarded'),false);assert.equal(executed,0);assert.equal(changed,0);assert.equal(await r.execute('guarded',{allowed:true}),true);assert.equal(executed,1);assert.equal(changed,1);
 r.register({id:'failed',title:'Failed',execute:()=>{throw Error('fixture failure')}});await assert.rejects(()=>r.execute('failed'),/fixture failure/);assert.equal(changed,2);assert.equal(r.list().find(c=>c.id==='guarded').mutation,'document');
 const b=await chromium.launch();try{const p=await b.newPage();await p.goto('file://'+process.cwd()+'/web/index.html');await p.waitForFunction(()=>window.FormulaCommands&&FormulaTest.getSVG());
 const execute=(id,args)=>p.evaluate(({id,args})=>FormulaCommands.execute(id,args),{id,args});
 const original=String.raw`\cfrac{1}{x}`;
 await execute('importContent',{text:original,ext:'tex'});await execute('switchTypst');
 const before=await p.evaluate(()=>({authority:FormulaTest.getState().formulaContent.authority,index:FormulaRevisions.index}));
 await p.locator('#remember').click();await p.waitForFunction(()=>FormulaTest.getState().history.length===1);
 assert.deepEqual(await p.evaluate(()=>FormulaTest.getState().formulaContent.authority),before.authority);assert.equal(await p.evaluate(()=>FormulaRevisions.index),before.index,'saving an asset is not a document edit');
 await execute('importContent',{text:'y+2',ext:'tex'});await p.getByRole('button',{name:'收藏夹',exact:true}).click();await p.locator('#history .favorite-preview').first().click();
 await p.waitForFunction(()=>FormulaTest.getState().editorMode==='typst');assert.equal((await p.evaluate(()=>FormulaTest.getState())).formulaContent.authority.text,original);
 await execute('undo');assert.equal(await p.locator('#source').inputValue(),'y+2');await execute('redo');assert.equal((await p.evaluate(()=>FormulaTest.getState())).formulaContent.authority.text,original);
 const state=await p.evaluate(()=>({source:document.querySelector('#source').value,index:FormulaRevisions.index,authority:FormulaTest.getState().formulaContent.authority}));
 assert.equal(await execute('restoreFavorite',{index:-1}),false);assert.equal(await execute('removeFavorite',{index:99}),false);
 await p.locator('#history [aria-label="删除收藏"]').click();assert.equal(await p.evaluate(()=>FormulaTest.getState().history.length),0);
 assert.deepEqual(await p.evaluate(()=>({source:document.querySelector('#source').value,index:FormulaRevisions.index,authority:FormulaTest.getState().formulaContent.authority})),state);
 await assert.rejects(()=>execute('importContent',{text:'not json',ext:'mathforge'}));assert.deepEqual(await p.evaluate(()=>({source:document.querySelector('#source').value,index:FormulaRevisions.index,authority:FormulaTest.getState().formulaContent.authority})),state);
 // Browser import must enter the same document command as native/OCR import.
 let calls=0;await p.evaluate(()=>{window.importCalls=0;const r=FormulaCommands,old=r.execute.bind(r);r.execute=(id,args)=>{if(id==='importContent')window.importCalls++;return old(id,args);};});
 const chooser=p.waitForEvent('filechooser');await execute('openFormula');const file=await chooser;await file.setFiles({name:'fixture.tex',mimeType:'text/plain',buffer:Buffer.from('z+3')});
 await p.waitForFunction(()=>document.querySelector('#source').value==='z+3');assert.equal(await p.evaluate(()=>window.importCalls),1);await execute('undo');assert.equal(await p.locator('#source').inputValue(),state.source);
 console.log('PASS command context/metadata/error refresh, favorite restore transaction+Undo/Redo, asset isolation, original-source preservation and real browser file import routing');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
