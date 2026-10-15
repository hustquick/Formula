# A13 — Visual / source / preview synchronization

COMPLETE technical validation; awaiting user experience. New batch 2/5, no GitHub push.

Changed web/index.html: svg.linebreaks.inline=false, as documented by MathJax https://docs.mathjax.org/en/stable/output/linebreaks.html for single-image consumers. Previously x+y+z+w generated four SVGs but scheduleRender extracted the first only. Inline math sizing remains inline; all glyphs now appear in one preview/export SVG.

Changed web/app.js readSource: when Visual mode's placeholder-free mathematical content already matches, retain the existing MathLive tree instead of resetting it. Repeated source synchronization previously removed placeholder{} and changed selection [7,8] to [7,7]. Actual changed source still updates the visual tree.

Added tests/source-preview-sync.cjs and suite entry: complete inline SVG/glyphs; visual placeholders/selection; Typst manual editing→visual hat→LaTeX→Undo/Redo; LaTeX/Typst output metadata; invalid source preservation/recovery. Existing selection, content/History, generated-format and UI tests retained.

PASS all 43 editor suites (editor-tests.log); build:vendor, native Swift/resource/ad-hoc-signature verification, backup/install/launch (install.log); git diff --check. No standalone lint/typecheck configured; node syntax checks and native compilation used.

Real Mac /Applications/Formula.app backup 20261015-192646: user latest sideset+nabla formula and yellow background captured before normal quit. Test replaced source with x+y+z+w and selected inline; actual screenshot showed all four variables and three plus signs, 300×54px. Two Undo operations restored original formula/display mode. Source/mode/layout/zoom/favorites matched baseline; installed app bundle matched workspace. No model download or user asset removal.

No new AST/lossless conversion claim: A14/A17 still own complex language fidelity, A40 owns lifecycle. Next dependency item A40.
