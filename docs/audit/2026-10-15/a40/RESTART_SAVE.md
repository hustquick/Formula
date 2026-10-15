# A40 — Restart, file identity and save integrity (2026-10-15)

Status: PARTIAL. Work only in /Users/hustquick/Documents/Projects/Formula, local main. Original A01–A40 IDs/names retained; only A40 status/evidence refreshed. Initial B-table state: 15 COMPLETE, 19 PARTIAL, one BROKEN (A15), one MISSING (A06), one ARCHITECTURE RISK (A35), three TEST COVERAGE MISSING (A24/A29/A33). Older detail sections are historical and do not override the B table.

Dependencies: A16 → A31 → A25 → A27 → A13 provide content/transactions/snapshots/synchronization. A40 protects persistence before A26 History and A01/A33 whole workflows. No adjacent A item was implemented. User additionally requested main-branch delivery and software version 1.6.1 (macOS build 21, matching Windows package version).

## Reproduction and repairs

- Actual native-method fixture reproduced delayed Save As overwriting a destination after the active document changed. It now rejects before writing.
- Atomic versioned host record pairs the draft and file identity; state and document are delivered together. A successful native write updates its path/digest/signature before replying. The path comes from native Open/Save panels only.
- Old split session records are not considered paired; their draft still loads from state.json, but first Save may require selecting a destination again. No legacy file/model removal or data migration.
- Open baseline hashes the bytes actually imported, so external modification before the frontend acknowledgement does not authorize overwriting changed contents.
- Representation form affects document dirty state. Reopening saved visual placeholders restores the editable tree after the parsed projection. Invalid exact source remains saveable and recoverable.

## Executed validation

- native-document-save.cjs: real production Swift methods, real temporary filesystem, separate process restart/in-place save; panel callback simulated. Covers Save/Save As, stale callbacks, cancel, invalid destination, external edits/deletion, open-byte binding/token consumption, New and legacy identity isolation. No app bundle created and no user data path used.
- document-roundtrip.cjs: real frontend Commands and FormulaContent, actual temporary file payload, fresh page state, Save/restart/Open/edit/Undo/Redo, LaTeX authority cached in Typst, layout settings, mode dirty state, visual placeholders and incomplete source. Native bridge responses simulated; this is not claimed as AppKit panel acceptance.
- 21 related suites: 19 initially passed; two template suites timed out because the migrated folder lacked the ignored offline LaTeXLive catalog. Reused the catalog from the existing formal app, reran both unchanged suites, both passed (126 actual template renders). Initial failures retained in regression output.
- native-document-conflict.cjs PASS; vendor build PASS; merged production Swift native compile PASS with two existing allowedFileTypes deprecation warnings. No OCR inference/install/download executed; OCR/clipboard/document interface regression uses controlled bridge fixtures.

## Completion boundary

A40 cannot be marked COMPLETE: Windows saveProject/file-identity native bridge remains unimplemented; Windows runtime was not tested; new native Mac panel/quit/reopen interaction is reserved for user acceptance. Crash/power-loss durability of in-flight asynchronous JS messages and writes racing from non-cooperating external processes are not claimed. Existing models, OCR venvs and user assets are untouched. Next candidate after confirming this Mac increment: A26, subject to the remaining A40 persistence dependency. Stop after this item.

## Formal app deployment and main delivery

Updated the existing /Applications/Formula.app in place after the user saved and quit. Compiled binary, Info.plist and current runtime resources were replaced inside that existing bundle; no DEV/Test/temporary app bundle was created. Rollback-only archive of changed app files: /tmp/formula-a40-install-rollback.tar.gz (no user data). codesign --verify --deep --strict PASS; complete selected web-resource SHA256 manifest PASS; current app bundle hash matches the workspace. Version 1.6.1, build 21, unchanged org.mathforge.desktop. App process confirmed. Original content authority, editor mode, layout/output settings and favorites compared equal before/after launch. New atomic host session verified against the current draft without exposing user content.

Local main contains the merge of the already synchronized latest workspace. origin/main's 1.6.0 tree matched the original feature release tree exactly (squash-history difference); latest workspace content was retained during the merge. User explicitly requested pushing to main and updating the software version. This is separate from full A40 user acceptance. Automatic remote CI/release results are not claimed by this local report.
