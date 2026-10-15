# A40.1 — immediate editable draft recovery

Parent A40 PARTIAL. File URL/dirty/save-vs-save-as is A40.2 and not implemented here.

Reproduction: dispatch an incomplete LaTeX source input and inspect durable state in the same evaluation. Previously authority still contained the old efficiency formula until the 220ms parser timer ran. Source input now updates FormulaContent with exact text/pending validation and persists immediately, retaining deferred parse/render. Visual input also persists placeholder-only tree changes; optional visualDraft is restored once only when its placeholder-free mathematical projection matches the saved formula. Existing data remains readable without migration.

PASS tests/draft-recovery.cjs: LaTeX/Typst exact whitespace/newline/incomplete input saved synchronously; fresh native-launch-style page initialized from that immediate snapshot restores exact text without relying on blur/beforeunload; visual placeholder tree survives fresh launch. PASS all 44 editor suites, vendor build, native compile/signature/resource checks, install and launch; syntax/diff checks.

Real Mac: backup 20261015-193025, normal /Applications/Formula.app. Replaced current source with incomplete frac and immediately quit normally; new launch showed the incomplete source with its leading spaces and newline, correct syntax error and disabled stale export. Cmd-Z restored user's original sideset+nabla formula and yellow background. Original source/mode/settings/zoom/favorites compared equal. No forced crash of user's app, model operations, or GitHub write. Simulated fresh-process tests cover unflushed parser state; power-loss durability is not claimed.

Changed web/app.js, tests/draft-recovery.cjs, scripts/test-editor.cjs, DEVELOPMENT_AUDIT.md. Next A40.2: file identity/dirty, proper Save/Save As, cancellation/failure, actual file save/reopen.
