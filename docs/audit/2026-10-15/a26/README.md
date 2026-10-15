# A26 — Automatic formula history (2026-10-15)

Status: COMPLETE for the defined data/automated acceptance scope; user experience remains pending. Only A26's original B-table row/detail updated. A40 remains PARTIAL: the user's next-round request is not recorded as Mac acceptance. Working directory unchanged, local main; no new application or OCR environment.

## Repairs

- Exact authority language/text identifies records; render normalization no longer merges distinct original source. Cached Visual/LaTeX/Typst representations retain the original authority. Versions retain authority/provenance and editable placeholder structure. Layout and representation metadata update the full snapshot without producing spurious content versions.
- Document commands retain stable Before and successful After at transaction boundaries; rapid imports do not depend on an idle timeout. Existing typed-input grouping remains. History is separate from Undo and retains older branches after Restore/Undo/new editing.
- previous is serialized/restored; saved snapshots are cloned by value. Existing recognized records and ids retained, legacy keys recalculated, malformed entries excluded. Versions already merged/lost by old code cannot be recreated.
- Unfinished exact source is recorded; preview uses its source fallback instead of displaying stale mathematical content. Version restore uses the current shared restore/transaction path and restores editable visual placeholders.
- Existing clear action now clears formula records and versions. Undo/current editor are untouched. A signature for the active content prevents immediate refilling on view/reload until content changes; clearing history does not clear the current document.
- At most 100 formula records and 100 versions, with a shared 4MiB UTF-8 storage budget. Oversized observations explicitly notify and preserve the live formula plus prior History; quota write failures still use the existing visible error and keep the previous persisted store.

## Executed validation

New formula-history.cjs reproduced the old authority-collapse failure before changes. PASS module coverage for restart continuity, metadata, invalid source, deep copies, clearing/reload, bounded UTF-8 sizes, oversize and legacy shape checks.

New formula-history-editor.cjs PASS actual browser frontend/Commands/history UI for rapid imports, reload, search, restore/edit/Undo/Redo, retained old branches, incoming controlled OCR metadata, incomplete source, visual placeholder restore, clearing/reload and Undo isolation. The first editor attempt used a nonexistent selector; the harness was corrected to the existing accessible search textbox, without changing product assertions.

21 related suites PASS (regression.txt): History, settings, finish UX, content contract/sync, drafts and file roundtrip, transaction/Undo ownership, batch scope, shortcuts/commands, selection, 126 templates, copy/export, and OCR/clipboard/document interfaces. OCR bridge fixture coverage is not a real model-inference or full raw-recognition claim. Vendor build, node syntax and git diff checks PASS.

## Formal Mac deployment

User confirmed saving and quitting. Updated the existing /Applications/Formula.app in place to 1.6.2 build22. Native Swift logic did not change: the existing compiled executable was reused, not claimed recompiled. Frontend resources and version metadata updated, codesign --verify --deep --strict and resource hashes passed, process confirmed. Original authority, representation, layout/output settings and favorites compared equal before/after launch. Resource rollback archive: /tmp/formula-a26-app-rollback.tar.gz. No extra app bundle or model download. No GUI screenshot/click acceptance performed.

## Completion and next candidate

Defined History recording, persistence, restoration, cleanup and error boundaries are exercised. COMPLETE is technical acceptance, not the user's visual/native acceptance or an assertion that upstream missing OCR metadata can be reconstructed. A40 manual acceptance remains pending. Next candidate A15 (language/renderer decoupling): verify existing implementation first because original BROKEN evidence may be stale. Stop after this item. Prior Mac release CI is blocked by tests/ocr-preview.cjs expecting pre-A13 fragmented SVG; A32/A35 were not modified in this item.
