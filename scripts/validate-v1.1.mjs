import {readFile, stat} from 'node:fs/promises';

const read = path => readFile(path, 'utf8');
const fail = message => { throw new Error(`v1.1.0 validation failed: ${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };

const [catalogText, exact, css, html, plist, build] = await Promise.all([
  read('web/vendor/latexlive/map_input.json'),
  read('web/latexlive-exact.js'),
  read('web/v1.1.css'),
  read('web/index.html'),
  read('macos/Info.plist'),
  read('scripts/build-dmg.sh')
]);
const catalog = JSON.parse(catalogText);
const sections = Object.fromEntries((catalog.shortcut || []).map(section => [section.name, section]));
const toolbar = sections.toolbar;
const template = sections.template;
expect(toolbar && template, 'toolbar/template sections missing from LaTeX Live catalog');

const expectedShortcut = ['常用符号','希腊字母','分数微分','根式角标','极限对数','三角函数','积分运算','大型运算','括号取整','数组矩阵'];
const expectedTemplate = ['代数','几何','不等式','积分','矩阵','三角','统计','数列','物理','化学'];
const shortcutNames = toolbar.layer1?.cont?.map(x => x.descript) || [];
const templateNames = template.layer1?.cont?.map(x => x.descript) || [];
expect(JSON.stringify(shortcutNames) === JSON.stringify(expectedShortcut), `shortcut category mismatch: ${shortcutNames.join(', ')}`);
expect(JSON.stringify(templateNames) === JSON.stringify(expectedTemplate), `template category mismatch: ${templateNames.join(', ')}`);

const realItems = entry => entry?.tag !== 'divider' && String(entry?.latex || '').trim();
let shortcutItems = 0, templateItems = 0;
for (const category of toolbar.layer1.cont) {
  const items = toolbar.layer2?.cont?.[category.tag]?.cont;
  expect(Array.isArray(items) && items.length > 0, `shortcut category ${category.tag} empty`);
  shortcutItems += items.filter(realItems).length;
}
for (const category of template.layer1.cont) {
  const items = template.layer2?.cont?.[category.tag]?.cont;
  expect(Array.isArray(items) && items.length > 0, `template category ${category.tag} empty`);
  templateItems += items.filter(realItems).length;
}
expect(shortcutItems > 150, `shortcut catalog unexpectedly small (${shortcutItems})`);
expect(templateItems > 50, `template catalog unexpectedly small (${templateItems})`);

expect(exact.includes("dataset.formulaVersion='1.1.0'"), 'runtime version marker missing');
expect(exact.includes('viewportPlace('), 'floating panel viewport placement missing');
expect(exact.includes("ArrowRight") && exact.includes("ArrowDown") && exact.includes("Escape"), 'keyboard menu navigation missing');
expect(exact.includes('enhanceToolbarCustomization'), 'Finder-like toolbar customization enhancement missing');
expect(css.includes('position:fixed!important') && css.includes('.ll-template-panel'), 'template/shortcut floating palette CSS missing');
expect(css.includes('.primary-tools.customizing') && css.includes('#toolbar-remove'), 'toolbar drag customization CSS missing');
expect(css.includes('#tools[data-tab="quick"]'), 'ten-category shortcut strip CSS missing');
expect(html.includes('id="toolbar-display"'), 'toolbar icon/text display selector missing');
expect(!/numeric[-_ ]?(keypad|keyboard)|数字键盘/i.test(html), 'numeric keypad should not be present');
expect(plist.includes('<key>CFBundleShortVersionString</key><string>1.1.0</string>'), 'Info.plist is not v1.1.0');
expect(build.includes('vendor/latexlive/catalog.js') && build.includes('vendor/latexlive/map_input.json'), 'DMG does not verify both offline catalog files');
expect((await stat('web/v1.1.css')).size > 4000, 'v1.1 visual layer unexpectedly small');

console.log(`PASS v1.1.0: ${shortcutNames.length} shortcut categories / ${shortcutItems} shortcut items; ${templateNames.length} template categories / ${templateItems} template items; floating menus, Finder toolbar customization, offline catalog and DMG gates verified.`);
