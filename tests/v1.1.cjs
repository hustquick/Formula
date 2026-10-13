const assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.MATHFORGE_BROWSER?{executablePath:process.env.MATHFORGE_BROWSER,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MATHFORGE_URL||'http://127.0.0.1:8765');
  await page.waitForFunction(()=>window.FormulaTest&&document.querySelector('#preview svg'));
  await page.waitForFunction(()=>document.documentElement.dataset.formulaVersion==='1.1.0'&&window.FormulaCatalogInfo);

  const info=await page.evaluate(()=>window.FormulaCatalogInfo);
  assert.equal(info.shortcutCategories,10);assert.equal(info.templateCategories,10);
  assert(info.shortcutItems>150,`shortcut items ${info.shortcutItems}`);assert(info.templateItems>50,`template items ${info.templateItems}`);
  assert.equal(await page.locator('.tool-group').count(),10);
  assert.equal(await page.locator('[class*="numeric-keypad"],[id*="numeric-keypad"],[class*="number-keyboard"],[id*="number-keyboard"]').count(),0);

  // Shortcut secondary palettes float without changing the editor geometry.
  const editorBefore=await page.locator('.input-editors').boundingBox();
  const symbol=page.locator('.tool-group summary[aria-label="常用符号"]');await symbol.click();
  const symbolPanel=page.locator('.tool-group[open]>.ll-popup-grid');await symbolPanel.waitFor({state:'visible'});
  assert.equal(await symbolPanel.evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.deepEqual(await page.locator('.input-editors').boundingBox(),editorBefore);
  const shortcutCount=await symbolPanel.locator('[data-exact-latex]').count();assert(shortcutCount>20);
  await symbolPanel.locator('[data-exact-latex]').first().focus();const firstFocused=await page.evaluate(()=>document.activeElement?.dataset?.exactTag||'');
  await page.keyboard.press('ArrowRight');const secondFocused=await page.evaluate(()=>document.activeElement?.dataset?.exactTag||'');assert.notEqual(firstFocused,secondFocused);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.tool-group[open]').count(),0);

  // Template categories and all their second-level content are detached palettes.
  await page.locator('[data-tab=templates]').click();await page.waitForFunction(()=>document.querySelectorAll('.ll-template-category').length===10);
  assert.equal(await page.locator('.ll-template-category').count(),10);
  const templateBefore=await page.locator('.input-editors').boundingBox();
  const algebra=page.locator('.ll-template-category').filter({hasText:'代数'}).first();await algebra.click();
  const templatePanel=page.locator('.ll-template-panel');await templatePanel.waitFor({state:'visible'});
  assert.equal(await templatePanel.evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.deepEqual(await page.locator('.input-editors').boundingBox(),templateBefore);
  assert(await templatePanel.locator('[data-exact-latex]').count()>5);
  const oldSource=await page.locator('#source').inputValue();await templatePanel.locator('[data-exact-latex]').first().click();
  await page.waitForFunction(old=>document.querySelector('#source').value!==old,oldSource);
  assert(await templatePanel.isHidden());

  // Finder-like toolbar customization and display mode persist as dedicated controls.
  await page.locator('[data-tab=custom]').click();await page.locator('#customize-toolbar').click();
  assert.equal(await page.locator('#customize-toolbar').getAttribute('aria-expanded'),'true');
  assert(await page.locator('#toolbar-options').isVisible());assert(await page.locator('#toolbar-remove').isVisible());
  await page.locator('#toolbar-display input[value=icons]') .check();assert.equal(await page.locator('#tools').getAttribute('data-display'),'icons');
  await page.locator('#toolbar-display input[value=both]') .check();assert.equal(await page.locator('#tools').getAttribute('data-display'),'both');
  await page.locator('#customize-toolbar').click();assert.equal(await page.locator('#customize-toolbar').getAttribute('aria-expanded'),'false');

  assert.deepEqual(errors,[]);
  await browser.close();
  console.log(`PASS v1.1.0 E2E: ${info.shortcutItems} shortcut items, ${info.templateItems} template items, floating menus, keyboard navigation, Finder toolbar customization.`);
})().catch(e=>{console.error(e);process.exit(1)});
