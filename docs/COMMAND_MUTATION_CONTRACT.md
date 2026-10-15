# Command mutation contract — A31

This inventory belongs to A31 of DEVELOPMENT_AUDIT.md, not a second product roadmap.

## Contract implemented in A31.1

CommandRegistry.enabled(id,args) checks both enabled and context; execute checks before calling the handler. Invalid/missing parameter context is a no-op. Mutation metadata (`none`, `document`, `asset`, `preference`) describes the affected store; it does not silently invent history behavior. `undoable` describes the current document transaction, not a promise that every user asset has Undo. Rejected handlers propagate their error and refresh command enabled state in finally.

Document mutations use the existing app editTransaction(title,execute): flush previous typing, capture boundary, execute, record result; nested native editor ownership/concurrency remains A25/A31.2 work. Core commands keep their existing transactions; new favorite restore uses the same helper. Clipboard/OCR/native and browser file imports call importContent through Registry. Errors are not swallowed by the import handler; external native callback reports rejection through registry.onError.

Asset-only mutations must not record a document Undo step. rememberFormula and removeFavorite persist the favorites collection; restoreFavorite changes the active document and is undoable. Parameterized favorite commands are omitted from native menu registration; UI supplies validated indexes. An unchanged derived source is not reparsed when saving a favorite, preserving its original authority.

## Mutation entry inventory and remaining audit

| Entry / store | Current route | A31 status / next verification |
|---|---|---|
| Structure/accent/script/root/brackets, matrix, styles | Registry→editTransaction | Existing; metadata document, regression retained |
| Templates and examples | insertTemplate→editTransaction | Existing; retained |
| Browser file import | filechooser→importContent command | A31.1 fixed and tested with real browser file selection |
| Native/OCR import | FormulaImport→importContent command | Existing; error propagation corrected |
| Favorite restore | restoreFavorite→editTransaction | A31.1 fixed; exact authority and Undo/Redo tests |
| Favorite save/remove | rememberFormula/removeFavorite, asset-only | A31.1 fixed; no document-history effect |
| New/clear, sourceAccept, replace/replaceAll | Registry→editTransaction | Existing; metadata document, regression retained |
| Source typing / IME / source indentation | Native input event→RevisionHistory.schedule | Explicit editor adapter retained; native IME/typing events stay native; A25 ownership remains |
| MathLive direct typing/menu | Adapter executeCommand and input→schedule | Existing adapter preserved and tested in A31.2; A25 ownership remains |
| Source/display mode switches via view shortcuts | Aliases→switchLatex/switchVisual command→editTransaction | A31.2 unified; preview focus remains view-only |
| Size/padding/colors/DPI | setDocumentSetting→validate→editTransaction→render | A31.2 complete; duplicate change-record listener removed |
| Preamble/Typst prelude/displayMode | setDocumentSetting with key whitelist | A31.2 complete; source edits are synchronized without losing authority |
| Math font and editor zoom | Font load then document commit / setEditorZoom preference | A31.2 complete; failed font load does not record a revision |
| Batch export | batchExport runtime scope + conflict gate + finally restore | A31.3 verified success/cancel/failure, no temporary persistence/history |
| Toolbar customize/drag/reset/display preference | setToolbarItem/moveToolbarItem/resetToolbar/setToolbarDisplay | A31.3 preference commands; two-row validation retained |
| Formula History remove/clear / version restore | clear/removeFormulaHistory asset commands; restoreFormulaVersion→importContent | A31.3 routed; History retention policy belongs A26 |
| Favorite library import / backup | importFavoriteLibrary / backupFavoriteLibrary | A31.3 asset import bypasses document transaction |
| Explicit local retry / tool path / OCR install and preferences | tryLocalTypesetting / scanLocalTools / chooseLocalTool / ocr.* | A31.3 runtime/preference adapters; native tools/OCR implementation retained |
| Output/copy/drag | Registry or bridge output; may sync pending source | Read-only export contract verified in A16; batch remains above |

A31 technical audit is COMPLETE after A31.3: every listed category is routed or has an explicit adapter boundary. This does not imply A25 Undo ownership or A26 History product completion. A31.1 does not imply serialized command execution, full MathLive history ownership, reversible asset deletion, or full rollback on mid-command errors.

## A31.2 settings and editor adapters

All size/padding/DPI/color/background/preamble/Typst prelude/displayMode/font changes enter setDocumentSetting. Whitelisted keys and types/ranges are validated before state mutation. Rejection restores that control and does not record history. No-op values do not record. UI controls send exactly one command; the old direct mutation and parallel history listeners were removed.

Synchronous settings record their transaction boundary without holding commandDepth open for asynchronous rendering. Font resources are loaded first; only successful/current requests commit font state through editTransaction. Undo font restoration calls the renderer adapter directly, rather than invoking another user command. Failure leaves prior font and revision intact. This is not a claim of full async command serialization.

Editor zoom is a preference command, persisted independently and excluded from document Undo. Mode aliases delegate to switchLatex/switchVisual so mouse/keyboard share transaction behavior. Source typing, IME, indentation and MathLive input remain native adapters feeding RevisionHistory.schedule; commandDepth prevents duplicate input recording during explicit commands. These are intentional adapter exceptions, not per-keystroke registry commands. Full mixed ownership is A25; batch/toolbars/History/configuration remain A31.3.

## A31.3 runtime and asset boundaries

Batch export checks for other in-flight Registry commands before snapshotting. During its temporary render scope, Registry rejects other commands, editor/settings surfaces are inert, state persistence and formula history/input history adapters are suppressed. Each save reply is checked: cancel stops the loop. A finally block restores by-value state/content, original visual placeholders, last-valid preview, runtime backend and UI context on success/cancel/failure; then reenables editing and persists only the restored state. Already-running native operations outside Registry are not claimed globally serialized.

Toolbar layout changes (checkbox/drag/remove/reset) and display mode use preference commands. Opening/closing customization and drag hover are transient UI only. Asset history clear/remove and version restore are named commands; library import/backup explicitly affect only asset state/output. History observation itself is a lifecycle adapter triggered by completed revisions, not a separate user command.

Local tool scan/path selection delegate through runtime/preference commands to existing native handlers. OCR adds ocr.* adapter commands around existing recognition/install/cancel/refresh handlers; preferences use ocr.savePreferences and pasted images use ocr.clipboardImage. These adapters preserve enabled checks and native cancellations, and do not download/install anything just by registration. OCR service internals still own progress/selection and native environment changes; they are not document mutations. Result import still enters importContent. Module select/input changes are preference-control adapters. No OCR engine was rewritten.

Render callbacks, startup migration, Undo restoration, keyboard focus/selection, panel state and live progress are intentional internal adapters. They do not need per-event Registry commands. Document semantics and nested/asynchronous transaction ownership are evaluated in A25; no claim of general rollback or complete user-asset Undo is made here.

## A25 transaction ownership (supersedes A31's async boundary limitation)

Document editTransaction now delegates to RevisionHistory.transaction. Editing, Undo/Redo and direct history navigation share one ordered queue; relative Undo/Redo targets are resolved when executed. Registry aliases still delegate to one leaf document transaction, not another independently queued outer transaction. Explicit child work uses the transaction context's run callback and commits once. A global commandDepth is only an input-recording suppression adapter, not ownership or a way to merge unrelated events.

The owner flushes pending typing, snapshots document state/context and preserves the redo branch. Successful work records one command revision. Throwing work restores the original document/context and history index/entries; rollback failure surfaces both errors as AggregateError. Asset/preference mutations remain outside document Undo. This does not implement persistent crash recovery (A40) or user-asset Undo.

Font loading and commit are now inside the same document transaction. Setting no-op checks run at execution time so a queued change back to the old value is not dropped. Editable surfaces retain their geometry and are inert only across outstanding asynchronous ownership; synchronous DOM insertions run before that guard. Focus requests made during that interval are reapplied when it ends. Ordinary preview painting uses the existing render revision guard and does not delay unlocking after Undo; async font replacement remains awaited. Completed/no-op transactions notify formula History so its pending observation is not lost.
