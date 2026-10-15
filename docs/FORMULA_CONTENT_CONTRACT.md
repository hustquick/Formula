# Formula content / representation contract

A16, schemaVersion 1. This is a source representation model, not a semantic AST and not the A40 document lifecycle/identity model.

## Authority and representations

`state.formulaContent.authority` is the exact source of the last real edit: language, text and origin (`source`, `visual`, `import`, `generated`, `legacy`). Whitespace and delimiters in handwritten/imported source are retained. A mode switch or read-only export does not become an edit.

`revision` increases on actual text changes. Each representation has text, revision, sourceLanguage, kind and fidelity. Original source is `original/exact`; converted source is `derived/unverified`, with converter attribution. Conversion success is not a semantic equivalence guarantee. `conversions` records available/unsupported at a revision and error detail; failed conversion keeps the authority intact. Existing UI failure protection still prevents destructive switches. `validation: parsed` means the conversion/adapter accepted source, not that the math is proven correct or that every renderer supports it.

Editing either source or the visual formula invalidates all earlier derived representations. An unchanged generated representation uses its cached LaTeX; reloading it cannot turn cfrac into frac by reverse conversion. No-op visual focus/mode changes do not promote MathLive's normalized spelling over user source. Actual visual edits become new LaTeX authority and retain generated formatting.

## Compatibility and integration

`latex`, `rawSource`, `editorMode` remain compatibility projections for existing rendering, native bridge and older readers. `rawSource` is normalized for rendering; exact source belongs to the content record. They are not separate editable documents. All source reads, mode switches, template loads, visual edits, imports, new/clear, revision capture/restore and persisted state use FormulaContent. On import/reload, caches are accepted only if active text and revision match; stale/malformed or missing records fall back to active legacy source without trusting a possibly stale alternate. Known pre-1.4.1 swapped-source repair remains before adoption.

Snapshots serialize the model by value. Undo signatures include authority so identical derived text cannot hide a change of original source. Project/SVG metadata, favorites and History carry it with existing state. No migration moves files or deletes legacy fields. Old software can read projections but cannot preserve the new provenance if it resaves a file.

## Boundaries

Converter coverage and native Typst/LaTeX language support are unchanged (A14/A17). Unsupported source is preserved and failure is explicit; unverified conversion does not claim losslessness. Command transaction ownership (A31/A25), History policy (A26), persistent document IDs/recovery (A40) remain separate tasks. No engine/UI redesign or new controls.
