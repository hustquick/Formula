# Stage Regression Report — first five main audit items

Main items: A02, A16, A03, A31, A25. A25.1 and A25.2 count together as one main item. No next A item implemented during this stage.

| Area | Actual validation | Result |
| --- | --- | --- |
| Build | npm run build:vendor; native Swift compilation and resource/signature verification through install-local.sh | PASS |
| Static | node --check app.js, commands.mjs, edit-transactions.cjs; git diff --check | PASS |
| Unit/integration/editor | npm run test:editor: 40 suites, including FormulaContent, Visual/LaTeX/Typst, Undo/Redo/History, selection transformations, source completion and generated formatting | PASS, editor-tests.log |
| UI | source/visual focus/selection/scroll, tabs/settings and core frame at 760/1120/1440; exact placeholder recovery | PASS within 40-suite run |
| OCR UI bridge | ocr-behavior, document-behavior, clipboard-ocr: single/multi result import, selection, cancellation, errors, text/image paste routing | PASS, ocr-ui.log; bridge responses controlled, not claimed as native inference |
| OCR inference | Current actual Python runner with existing installed models, HF_HUB_OFFLINE=1 and TRANSFORMERS_OFFLINE=1: Basic JPG x+y=2, page 2 formulas, Pro JPG x+y=2 | PASS, ocr-single/page/pro.log; no warmup/install/download |
| Document parsing | Existing venv-document/bin/python tests/document-runner.py: 3 tests including real DOCX math/image ordering, external-image exclusion and invalid DOCX | PASS, document.log |
| OCR runner unit | python3 tests/ocr-runner.py geometry/routing: 2 tests | PASS |
| Output | output-color-export, output-colors in 40 suites: actual PNG/JPEG pixels and alpha; tests/native-background.cjs actual native PDF background/content/bounds | PASS |
| Native toolchain | tests/document-range.cjs, font-controls.cjs, font-native-reload.cjs, native-preview-size.cjs | PASS; native-size.log |
| Native app | Normal /Applications/Formula.app launch, immediate size change→Undo→Redo→Undo and cross Visual/Typst→Undo with original formula and output restored | PASS real UI, no mock |

## Failed attempts preserved in the report

- First document-runner invocation used system Python and failed 3 tests with missing pypandoc. Re-run in the already installed app document venv passed all 3; no dependency installation performed.
- Initial transaction build stopped a no-op transaction's pending automatic History observation: formula-content-editor timed out. Transaction completion now notifies History; final suite passes.
- Holding Undo's editor lock through preview rendering exposed an intermittent source-assist closing-delimiter failure (x{ vs x{}). Ordinary preview rendering no longer holds that lock; repeated targeted tests and final 40-suite pass.
- An intermediate source-surface run timed out while multiple native/model checks were running. Three isolated reruns and final complete suite passed; no timeout increase or assertion removal.
- A delayed-font test initially failed because the injected test loader lost its MathJax this binding. The test wrapper now calls original.apply(MathJax.loader,args).

## Limits and acceptance

This regression does not claim Word/WPS/Pages native editable equation interoperability (A24), full document ingestion quality benchmarking (A08/A09), or crash recovery (A40). No schema migration or user model/asset removal. A long async document mutation temporarily protects editing surfaces; preview painting alone does not. Signed ad-hoc local app is not a notarized public release. User acceptance and GitHub push remain separate and pending.

Final native deployment: install-local.sh backup 20261015-151859, /Applications/Formula.app, unchanged org.mathforge.desktop. Resource hash verified. Real final UI confirmed Typst source focus, Undo restoring exact original LaTeX, and immediate +2 input after Undo. Original formula/settings/favorites restored and compared.
