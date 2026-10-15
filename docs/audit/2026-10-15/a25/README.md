> 后续状态：A25.2已完成，父项A25现为COMPLETE；以下为A25.1当时记录。最新证据见 transactions/README.md 和原DEVELOPMENT_AUDIT.md。

# A25.1 — history restoration boundary

Parent A25 remains PARTIAL. This subtask fixes a reproduced loss without claiming complete transaction ownership.

## Reproduction and change

In Visual mode import x, append `\placeholder{}`, flush revisions, Undo, Redo. Previously the revision index did not increase and Redo restored x without its placeholder. Generated non-placeholder source remains x, so the old signature incorrectly deduplicated the change. The signature now includes placeholder-preserving visualLatex only for Visual mode; source mode does not gain normalization-only revisions.

RevisionHistory now queues go/undo/redo restoration. Relative navigation resolves its target after prior restoration finishes. Restore errors reset the history index, emit change notification, and do not poison subsequent queued work. The first operation still begins synchronously for the pinned MathLive adapter.

## Executed validation

- PASS tests/undo-ownership.cjs: delayed concurrent Undo/Undo/Redo are ordered, max concurrent restores=1; failure recovery; real Chromium MathLive placeholder survival; public MathLive/Registry/keyboard mixing; pending source; LaTeX/Typst round trip and preview.
- PASS node --check web/commands.mjs and tests/undo-ownership.cjs.
- PASS npm run build:vendor.
- PASS npm run test:editor: all 39 suites (editor-tests.log).
- PASS scripts/install-local.sh: native Swift compilation, current offline resource manifest, ad-hoc signature verification, backup replacement and launch. Backup ~/Library/Application Support/Formula-Backups/20261015-150530/Formula.app (install.log).
- PASS real /Applications/Formula.app UI: append +1 to current LaTeX, preview 761→844px, ⌘Z original761px, ⇧⌘Z 844px, ⌘Z original761px. Original source, mode, output settings and favorites compared against before-test state.json and matched.

No new UI or layout change, model download, schema migration, GitHub push, or user acceptance claimed.

## Remaining under A25.2

This is a restoration queue, not a global editing queue. Audit/fix overlapping async document commands vs Undo and nested editTransaction ownership; verify failure rollback and preservation of input during async restores. Do not mark A25 COMPLETE or advance to A27 until these pass. Main completed count remains four; stage regression awaits the fifth completed item.
