# A27 — layout snapshot coverage

COMPLETE technical validation, awaiting user experience. New batch count 1/5. No GitHub push.

Old transparency/DPI/font signature omissions had already been fixed. Inspection and tests retained those implementations. This iteration centralizes layout snapshot fields in web/document-settings.mjs and shares them across capture, signature and both restoration paths. No persisted key names/schema changed.

Reproduced actual font mismatch: select Bonum, capture state, select Newcm, import the saved project. Before the fix state.mathFont=bonum but outputJax.font.constructor.NAME=MathJaxNewcm. Shared restore now awaits applyMathFont where necessary, with awaited project/SVG/favorite callers. History already delegates through project import and receives the same fix.

PASS tests/history-settings.cjs: all layout field signatures; Visual/LaTeX/Typst Undo/Redo and complete snapshot fields; project/favorite/version restoration with actual MathJax font type; History observation/reload and direct revision restore.
PASS full 42-suite editor regression (editor-tests.log), build:vendor, node syntax checks, git diff --check, native Swift/resource/signature build/install/launch (install.log).

User additionally reported input A+/A− not visibly resizing source. Reproduced textarea17.6px vs syntax paint16px. applyEditorZoom now calls the existing source-surface refresh. PASS editor-zoom-paint in LaTeX/Typst/Visual, A+/A−, restart, 760/1120/1440 stable frames; text/selection/history/export size unchanged. Existing editor-zoom.cjs also passed.

Native /Applications/Formula.app backup 20261015-152546: opened temporary mathforge snapshot with Bonum,38pt,20px,red ink,blue background,600DPI; Undo restored original values. Actual LaTeX A+ showed enlarged highlighted source, A− restored it. Final source, mode (Visual), all layout/zoom values and favorites matched the original baseline; installed bundle bytes matched workspace. OCR models untouched.

Separate discovery during native inline-mode check: MathJax produces multiple SVG fragments and preview extracts only the first, so a long formula is visually incomplete. Recorded under next task A13. This is a renderer/source-preview issue, not loss of snapshot settings. A27 does not claim that renderer issue fixed.
