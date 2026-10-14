import {formatLatexSource} from '../web/format-latex.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const source = 'https://raw.githubusercontent.com/ubnm/LaTeXLive/master/json/map_input.json';
const jsonOutput = resolve('web/vendor/latexlive/map_input.json');
const jsOutput = resolve('web/vendor/latexlive/catalog.js');

function findSection(parsed, name) {
  const sections = Array.isArray(parsed?.shortcut) ? parsed.shortcut : [];
  return sections.find(section => section?.name === name && section?.layer1?.cont && section?.layer2?.cont);
}

// LaTeX Live contains several old plain-TeX constructions that MathJax can
// display but MathLive cannot edit reliably. Retain upstream provenance in the script; ship normalized readable source in both catalog representations.
function normalizeMathLiveLatex(latex) {
  let value = String(latex || '').replace(/\r\n/g, '\n').trim();
  // Old vector notation used throughout the physics templates:
  // \mathord{\buildrel{\lower3pt\hbox{$\scriptscriptstyle\rightharpoonup$}}\over F}
  // becomes the semantically equivalent, editable LaTeX \vec{F}.
  value = value.replace(
    /\\mathord\s*\{\s*\\buildrel\s*\{\s*\\lower3pt\s*\\hbox\s*\{\$\s*\\scriptscriptstyle\s*\\rightharpoonup\s*\$\}\s*\}\s*\\over\s*([A-Za-z]|\\[A-Za-z]+)\s*\}/g,
    (_, symbol) => `\\vec{${symbol}}`
  );
  return formatLatexSource(value);
}

function normalizeCatalog(parsed) {
  const runtime = structuredClone(parsed);
  let changed = 0;
  for (const section of runtime.shortcut || []) {
    const layer2 = section?.layer2?.cont || {};
    for (const group of Object.values(layer2)) {
      for (const entry of group?.cont || []) {
        if (!entry || typeof entry.latex !== 'string') continue;
        const normalized = normalizeMathLiveLatex(entry.latex);
        if (normalized !== entry.latex.trim()) changed += 1;
        entry.latex = normalized;
      }
    }
  }
  return {runtime, changed};
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
const {runtime, changed} = normalizeCatalog(parsed);
const runtimeTemplate = findSection(runtime, 'template');
const physics = runtimeTemplate?.layer2?.cont?.physics?.cont || [];
if (physics.some(entry => /\\buildrel|\\hbox/.test(entry?.latex || ''))) {
  throw new Error('Legacy physics TeX survived MathLive compatibility normalization');
}
await mkdir(dirname(jsonOutput), {recursive: true});
await writeFile(jsonOutput, JSON.stringify(runtime,null,2)+'\n', 'utf8');
await writeFile(jsOutput, `window.LaTeXLiveCatalog=${JSON.stringify(runtime)};\n`, 'utf8');
console.log(`Bundled LaTeXLive catalog: ${jsonOutput} (${Buffer.byteLength(text)} bytes)`);
console.log(`Generated file-safe catalog: ${jsOutput}; normalized ${changed} legacy formulas for MathLive`);
