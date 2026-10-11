import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const source = 'https://raw.githubusercontent.com/ubnm/LaTeXLive/master/json/map_input.json';
const output = resolve('web/vendor/latexlive/map_input.json');

function findSection(parsed, name) {
  const sections = Array.isArray(parsed?.shortcut) ? parsed.shortcut : [];
  return sections.find(section => section?.name === name && section?.layer1?.cont && section?.layer2?.cont);
}

const response = await fetch(source, {headers: {'user-agent': 'Formula-build'}});
if (!response.ok) throw new Error(`LaTeXLive catalog download failed: HTTP ${response.status}`);
const text = await response.text();
const parsed = JSON.parse(text);
const toolbar = findSection(parsed, 'toolbar');
const template = findSection(parsed, 'template');
if (!toolbar || !template) throw new Error('LaTeXLive map_input.json structure changed');
if (toolbar.layer1.cont.length !== 10) throw new Error(`Expected 10 shortcut categories, got ${toolbar.layer1.cont.length}`);
if (template.layer1.cont.length !== 10) throw new Error(`Expected 10 template categories, got ${template.layer1.cont.length}`);
for (const category of [...toolbar.layer1.cont, ...template.layer1.cont]) {
  const items = (category.tag && (toolbar.layer2.cont[category.tag] || template.layer2.cont[category.tag]))?.cont;
  if (!Array.isArray(items) || !items.length) throw new Error(`Empty LaTeXLive category: ${category.tag}`);
}
await mkdir(dirname(output), {recursive: true});
await writeFile(output, text, 'utf8');
console.log(`Bundled LaTeXLive catalog: ${output} (${Buffer.byteLength(text)} bytes)`);
