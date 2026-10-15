# A25.2 — async editing transaction ownership

## Root causes reproduced

1. Delayed sourceAccept mutates x→x+1, then waits before the old editTransaction finally records. Concurrent Undo previously jumped to the formula before x; Redo could not represent the intended transaction.
2. A failed editor callback previously recorded its partially changed text in finally, instead of restoring the original document and redo branch.
3. Setting early no-op checks could discard a queued return to the original value.
4. Async inert intervals initially lost mode-switch focus requests. A real Mac switch exposed focus remaining on the Typst button; focus intent is now restored on release.

## Implementation

web/commands.mjs: shared ordered owner for transaction/go/undo/redo; explicit child context joins one transaction; failed document editing restores snapshot and pre-edit redo branch; failed restoration attempts recovery and exposes aggregate failure if needed; busy Undo/Redo requests can queue; completion notifies History, including no-op transactions.

web/app.js: editTransaction adapter uses that owner. Font resource loading is inside its transaction. Setting no-op checks happen when executed. Async owner protects editor surfaces without changing geometry; synchronous DOM edits execute before inert applies. Focus intent is retained. Ordinary render completion does not hold the Undo input lock; existing render revision guards discard stale previews. Batch rejects a direct history restoration owner too. Formula History does not observe partially completed transactions.

Tests: tests/edit-transactions.cjs plus updated tests/undo-ownership.cjs, integrated into scripts/test-editor.cjs. Tests cover async edit→Undo→Redo, failure rollback with source selection and redo retained, queued settings, delayed font→Undo, real mode-button focus, explicit nested success/failure, recovery failure reporting/unlock; existing MathLive/keyboard/source/Typst history matrices remain in the suite.

## Scope

No source schema or user asset migration, model download or unrelated UI change. This completes operation ownership, not A26 History product policy, A27 snapshot field inventory, A40 lifecycle/crash recovery or A24 Office interoperability. Asynchronous document mutation temporarily protects editor input; commands/Undo remain queued. Preview painting alone does not extend that protection.

See STAGE_REGRESSION.md for final results and initial failed runs corrected during validation. No GitHub push or user acceptance claimed.

Final local backup: ~/Library/Application Support/Formula-Backups/20261015-151859/Formula.app. Final app bundle SHA256 matched the workspace. Real native Typst button now focuses the source field; Undo restores original LaTeX. After Undo, immediate typing +2 worked and preview updated; test input was undone. Original source/mode/output/favorites matched before-test values.
