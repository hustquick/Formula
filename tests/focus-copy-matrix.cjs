const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [760, 1120, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.addInitScript(() => {
        window.messages = [];
        window.webkit = { messageHandlers: { mathforge: { postMessage: m => messages.push(m) } } };
      });
      await page.goto('file://' + process.cwd() + '/web/index.html');
      await page.waitForFunction(() => window.FormulaCommands);
      const press = key => page.keyboard.press('ControlOrMeta+' + key);
      const clear = () => page.evaluate(() => messages.length = 0);
      const assertNative = async () => {
        assert(await page.evaluate(() => messages.some(m => m.action === 'nativeEdit' && m.edit === 'copy')));
        assert(!await page.evaluate(() => messages.some(m => ['copyImage', 'copy'].includes(m.action))));
      };
      await press('k');
      await page.locator('.command-overlay>input').fill('hat');
      await press('a');
      await clear(); await press('c');
      assert(!await page.evaluate(() => messages.some(m => ['copyImage', 'copy'].includes(m.action))));
      await page.evaluate(() => FormulaCommands.execute('copy'));
      await assertNative();
      await page.keyboard.press('Escape');
      await page.evaluate(() => FormulaCommands.execute('settings'));
      await page.locator('#tool-dialog details').evaluateAll(nodes => nodes.forEach(n => n.open = true));
      for (const selector of ['#preamble', '#typst-preamble', '#batch-source']) {
        // Seed copy-only fixtures without triggering asynchronous preamble recompilation.
        await page.locator(selector).evaluate(n => { n.value = 'alpha'; n.focus(); n.setSelectionRange(0, n.value.length); });
        await clear(); await press('c');
        assert.deepEqual(await page.locator(selector).evaluate(n => [n.selectionStart, n.selectionEnd]), [0, 5]);
        assert(!await page.evaluate(() => messages.some(m => ['copyImage', 'copy'].includes(m.action))), selector);
        await page.evaluate(() => FormulaCommands.execute('copy'));
        await assertNative();
      }
      await page.locator('#close-tools').click();
      for (const language of ['latex', 'typst']) {
        await page.locator('#mode-' + language).click();
        await page.locator('#source').fill('x+y');
        await page.evaluate(() => FormulaTest.readSource());
        await page.locator('#source').evaluate(n => { n.focus(); n.setSelectionRange(0, 1); });
        await clear(); await press('c');
        assert(await page.evaluate(() => messages.some(m => m.action === 'copy' && m.text === 'x')));
        assert(!await page.evaluate(() => messages.some(m => m.action === 'copyImage')));
        await page.locator('#source').evaluate(n => n.setSelectionRange(1, 1));
        await clear(); await press('c'); await assertNative();
      }
      // Read-only diagnostics and selectable labels must use the responder's text copy.
      await page.evaluate(() => {
        const log = document.createElement('pre'); log.id = 'copy-fixture'; log.tabIndex = 0;
        log.textContent = 'diagnostic sample'; document.body.append(log); log.focus();
        const range = document.createRange(); range.selectNodeContents(log);
        getSelection().removeAllRanges(); getSelection().addRange(range);
      });
      await clear(); await press('c'); await assertNative();
      await page.evaluate(() => { getSelection().removeAllRanges(); document.getElementById('copy-fixture').remove(); });
      await page.locator('#input-visual').click();
      await page.locator('math-field').evaluate(n => { n.focus(); n.select(); });
      await clear(); await press('c');
      assert(await page.evaluate(() => messages.some(m => m.action === 'copy' && /x/.test(m.text))));
      await page.locator('#preview').focus();
      await clear(); await press('c');
      await page.waitForFunction(() => messages.some(m => m.action === 'copyImage'));
      console.log(`PASS A02 focus/selection/native menu routing, LaTeX/Typst/visual/preview at ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
