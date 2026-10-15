# A40 — Packaged Windows runtime verification (2026-10-15)

Status: PARTIAL, pending the user's Mac manual acceptance. Existing A01–A40 IDs, names and the other 39 states retained. This increment changes only A40 test/workflow coverage and evidence, with no product logic/version change. Same main workspace, Formula 1.6.1. Mac formal app and all user/model data untouched.

## Why this increment

The prior Windows run 38738977769 succeeded: production host tests ran on Windows, the package contained the new module, and the portable build was published. Its smoke check only inspected files; it did not start Formula.exe. This increment closes that runtime-evidence gap before evaluating A26 History persistence.

## Executed Windows evidence

[Run 38740469562](https://github.com/hustquick/Formula/actions/runs/38740469562), tested commit 0990a52825d2b3732957e85e9c8501ed89060e54: **success**. Host/IPC tests, build, packaged-file checks, actual packaged runtime, artifact upload and Windows download publication all succeeded.

The added tests/windows-document-runtime.cjs launches the normal dist/Formula-Windows-x64/Formula.exe built by Build-Windows.ps1. It asserts the actual app directory and version. It uses real Electron processes, production preload/main/frontend/Command Registry/FormulaContent, actual filesystem and normal app persistence. No DEV/Test/extra app copy is created. The test can only run on disposable Windows CI, so it cannot edit a user's local production profile.

Actual validated chain:

- Import exact whitespace/newline-preserving cfrac LaTeX, select Typst, set background and Save; disk retains original authority and settings.
- Quit and relaunch the same executable; same document id, clean state and Typst form recovered.
- Switch to original LaTeX, edit, use real Windows Ctrl+S keyboard event; original file updated without another save panel.
- Further edit, Undo/Redo and Save As cancellation preserve appropriate dirty/identity state.
- External file edit blocks Save; Save As writes a separate target while retaining external contents.
- New followed by native Open request/token acknowledgement establishes the selected file identity; successful re-open returns clean state.
- Save an editable visual placeholder tree, quit/relaunch again, verify identical tree/id/clean state.

Native Open/Save panel results are supplied programmatically to avoid desktop clicking. Their visual behavior and interaction feel are not claimed as human-tested. No screenshots, OCR recognition/installation/download or user data manipulation was performed. Existing tests/windows-document-session.cjs and windows-document-bridge.cjs again passed locally; node --check and git diff --check passed. The cloud workflow installs Playwright only after packaging, leaving the shipped runtime dependencies untouched.

## Scope and remaining acceptance

A40's Windows production integration is now verified on an actual Windows host, not only a Mac with Electron stubs. The complete B-table item remains PARTIAL because the user last explicitly reported the Mac Save → Quit → Reopen → Save flow has not been manually tested. The native Mac implementation was already built/installed/started and validated automatically in prior A40 increments; this increment does not reinstall it. Await that user check, then evaluate A26. Do not automatically start A26.

Mac run 38740469508 failed at the existing tests/ocr-preview.cjs:17 assertion expecting fragmented inline SVG, before A40 tests. This is retained as a separate known publication blocker; A13/A32/A35 are not modified or falsely marked complete here. No new Mac DMG publication is claimed. Windows 1.6.1 publication succeeded.

Evidence: windows-runtime-ci.txt records the actual cloud test output and tested SHA. WINDOWS_SAVE.md and RESTART_SAVE.md preserve prior implementation/testing boundaries as historical records.
