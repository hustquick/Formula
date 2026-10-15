# A40 — Windows document save bridge (2026-10-15)

Status: PARTIAL. Same A40 item, same /Users/hustquick/Documents/Projects/Formula workspace, current main. No new branch/application/environment or OCR operations. Other 39 B-table task statuses retained. Product version remains 1.6.1 while this same A40 increment awaits acceptance.

## Evidence and scope

Before this increment, windows/main.cjs handled graphics `save` but had no `saveProject` action. The shared frontend used saveProject for Formula Save, leaving the request to time out. preload loaded only state, ignored FormulaSavedLifecycle, and dropped native Open name/token. Thus Windows could not establish the host-owned persistent file identity already supported by the Mac implementation.

Added a small host-only DocumentSession module used by the existing Electron main/preload. It atomically pairs state/id/signature and the host-selected file path/digest; only native Open/Save results establish a target. Project or frontend metadata paths are ignored. The existing state.json is still maintained for compatibility; launch prefers the coherent paired record. Old split/corrupt records do not bind a file path.

Save reuses the authorized target, validates its original digest, and reports external edits/deletion without writing. Save As always uses the existing Electron native panel. Cancellation/errors preserve saved identity; a delayed panel is rejected after New/Open changes the document id. Successful writes atomically replace the file and update the paired record before replying. The Open token is one-use, hashes the bytes actually read, and is passed intact through preload into FormulaImport. Graphics export keeps its independent path and cannot reassign document identity. Dirty state is reflected in the existing window title, without layout changes.

Build-Windows.ps1 copies the new host module into the existing package. The existing Windows workflow now runs the two focused host/bridge tests with explicit failure propagation and verifies the packaged module exists; this wires A40 coverage only, not a redesign of the A32 CI system.

## Executed tests

- windows-document-session.cjs PASS: production module, real temporary filesystem, exact source/provenance/settings payload, normal Save/Save As, cancellation/error and temp cleanup, independent Node process restart, external modification/deletion, stale Save As, New and forged-path isolation, one-use native Open token/byte baseline, coherent recovery despite a stale legacy state file, corrupt/legacy records.
- windows-document-bridge.cjs PASS: executes the actual main.cjs and preload.cjs with Electron UI/IPC surfaces simulated. Covers launch injection, Save reply ids, no-panel in-place saving, Open name/token forwarding/adoption, conflict/error replies, stale panel rejection and graphics-export isolation. Actual filesystem operations and production DocumentSession run unmodified. The first test attempt hit a cross-VM Array prototype comparison in the harness; Array.from normalization fixed only that test comparison.
- Related regression PASS: document-roundtrip, document-lifecycle, draft-recovery, formula-content-editor, command-shortcuts, runtime-mutation-scope, output-actions. Total nine suites, zero failures.
- node --check for main/preload/session/new test files and git diff --check PASS.

## Acceptance and deployment boundary

These tests ran on the user's Mac, not a Windows Electron window. No new Windows package, Windows installation or GUI launch was executed locally. Mac code/resources/installed app were not changed this increment: existing /Applications/Formula.app remains the previously installed 1.6.1; no restart needed and no user data touched. The user explicitly answered that the Mac Save → Quit → Reopen → Save flow has not been manually tested yet. A40 therefore remains PARTIAL; code coverage alone is not full acceptance. Stop before A26.

The prior main commit's cloud Windows portable build succeeded. Its cloud macOS build failed before A40 tests at tests/ocr-preview.cjs, which still asserts fragmented inline SVG despite A13's single-SVG output. This is observed prior CI state, not a failure of this Windows save increment and not fixed under another A item here. A35/A32 statuses are not changed. No current-increment cloud test/build result is claimed.
