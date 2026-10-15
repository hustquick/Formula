# A40.2 — session file identity and save behavior

Parent remains PARTIAL. New DocumentLifecycle tracks session id/name/savedSignature; dirty includes exact content and layout settings but excludes display zoom. Successful Save acknowledges only the captured signature, so edits during save remain dirty. Cancel/error retain identity and dirty. Project import adopts identity only on successful completion; native host binds a selected/read URL via an opaque one-use token, not project-provided paths. New formula resets identity. Native title and edited state use standard macOS window properties.

Native saveProject writes atomically to the current authorized URL for Save; first Save and Save As show NSSavePanel. Graphics export uses the existing independent save path. Fixed duplicated mathforge suffix exposed in native testing.

PASS document-lifecycle.cjs: identity, dirty editing, SaveAs intent, cancel/error, open token adoption, edits during save, new formula. PASS command shortcuts with separate saveProject vs export bridge actions. PASS all 45 editor regression suites (session-tests.log), build, syntax/diff checks and native compile/ad-hoc-signature/resource/install/launch (session-install.log).

Real app test: first Save opened panel; selected file saved, appended +1 then Cmd-S wrote +1 into that same file without another panel (disk JSON checked). Shift-Cmd-S showed panel; Cancel retained document. Undo restored original source. A test filename entered with slashes was normalized by NSSavePanel into a Desktop filename; after quitting, only that newly created test file was moved to /tmp/formula-a40-session-native.mathforge. No user file was removed. Final native backup 20261015-193549; original source/settings/favorites compared equal, app relaunched and fixed suffix panel verified/cancelled.

Remaining: persistent file identity after app restart, external file modification conflict protection, full save→close→open round trip and lifecycle interactions. Draft persistence from A40.1 remains independent. This is session Save behavior, not COMPLETE A40 and not Windows parity. No GitHub push or model changes.
