# Host Equation / Clipboard adapter — 2026-10-16

Status: PARTIAL; no native editable host success claimed.

## Root cause and implementation

Original preview Command+C dispatched `exportFile(graphicKind(),true)`, followed by native `copyImage`. The system pasteboard contained PNG, SVG, Formula-private JSON and macOS synthesized TIFF aliases. No MathML or HTML math was offered. WPS therefore had no editable math candidate; original graphic format selection was not recorded as a specific PNG-vs-SVG read, so do not claim which it consumed.

`web/equation-clipboard.mjs` builds host-neutral representations from a captured FormulaObject. `copyEquation` flushes genuine pending edits, obtains revision-tagged MathML/source, wraps MathLive's MathML fragment in a namespace-correct math root, adds size/color/display, and derives graphic fallbacks. It guards identity/revision across asynchronous generation. It never converts preview DOM into the formula authority.

`EquationClipboard` in `macos/Formula.swift` writes **one NSPasteboardItem** atomically. Type order: registered MathML (UTF-16LE), registered MathML Presentation (UTF-16LE), org.w3.mathml/public.mathml (UTF-8), public.html containing MathML, org.mathforge.latex, plain LaTeX, private equation snapshot, SVG, PDF, PNG. Registered legacy names are mapped to macOS UTIs; plain strings with spaces/MIME delimiters are not valid data-provider UTIs. Order expresses preference but does not force a host's importer.

Command+C in preview uses Smart Copy. Source/auxiliary text selections keep native text semantics; visual selection retains selection-specific LaTeX Copy for now (exception). Explicit native Edit→Copy submenu contains Smart Copy, editable equation, LaTeX, Typst, MathML, SVG and image. Editable-only omits all graphics and uses MathML plain text as compatibility fallback; it does not claim the receiving app actually converts that text into a native equation. OMML was not previously implemented. A handcrafted OMML-in-HTML probe was rejected by WPS; no unsupported raw OMML clipboard claim is added.

## Real host matrix

Mac WPS Office 12.1.29166, fresh Document2/3/4 test tabs; original Document1 untouched.

| Host / strategy | Requested/read representation | Actual result | Native edit / modify | Layout / fallback |
|---|---|---|---|---|
| WPS original Formula preview Cmd+C→Cmd+V | Graphic-only pasteboard | Formula image | No native math entry confirmed | Visible, zero text words; graphic fallback |
| WPS math-only multi-format provider | Read log: public.utf8-plain-text then public.html; no math-specific type requested during paste | `x2` ordinary text; fraction structure lost | No Equation Object | Incorrect math layout; not image |
| WPS handcrafted OMML HTML probe | Read plain text then HTML | `x2` ordinary text | No Equation Object | Not successful; test only |
| WPS installed Formula Smart Copy (Document5) | Mathematical HTML result; exact read confirmed in equivalent editable-only replay below | Flattened ordinary text; fraction/scripts lost | No Equation Object | No image; size/baseline unsuitable |
| WPS installed editable-only (Document7), final registered-type provider replay | Read log: public.utf8-plain-text then public.html; no registered math type requested | Same flattened ordinary text | No Equation Object; native equation editing unavailable | No image; mathematical layout fails |
| WPS experimental Office Math RTF (Document6) | RTF-only payload | x2 text, both math-zone wrapper variants | No Equation Object | Probe not shipped |
| Word for Mac | NOT INSTALLED (user confirmed) | NOT TESTED | NOT TESTED | No claim |
| Apple Pages | NOT INSTALLED (user confirmed) | NOT TESTED | NOT TESTED | No claim |

WPS Insert→Insert LaTex with `\[\frac{x}{2}\]` produced a Picture Tools object. Insert→Equation does expose a separate native Equation Tools editor. Those are distinct capabilities. No assumption that the LaTeX insertion dialog creates a native equation.

Provider logs live at `/tmp/formula-clipboard-probe.log` and `/tmp/formula-clipboard-omml.log`. The probe's raw invalid registered-name types were rejected by AppKit, so only the valid org.w3/public MathML alternatives were offered in that early test. The final adapter fixes registration; its actual private NSPasteboard contents/encoding are tested by `tests/equation-pasteboard.cjs`. Do not generalize the early probe into proof that all WPS MathML formats are unsupported.

## Evidence / limitations

- `tests/equation-clipboard.cjs`: object revision, tampered legacy fields, Smart Copy math+HTML+SVG/PDF/PNG, editable-only excludes graphics, explicit commands.
- Updated command-shortcuts and focus-copy-matrix distinguish Smart Copy from explicit graphic copy, preserve text focus semantics.
- `tests/equation-pasteboard.cjs`: actual isolated NSPasteboard item, UTF16LE MathML, valid types/priority, graphics and invalid-write preservation; does not alter general clipboard.
- Native optimized compile and offline bundle build passed. Full editor regression: all 51 suites passed. Native private pasteboard test passed.
- User confirmed saved/quit and unlocked. `scripts/install-local.sh` passed; installed and launched `/Applications/Formula.app` (PID 91398 at check), `org.mathforge.desktop`, 1.6.2. Codesign verification passed; local and installed bundle SHA256 both `c0f21ecb8cff2d02b873d7068245364b7fb15082ba6a9ba511f9ed63c2bb6b2e`. Rollback app: `/Users/hustquick/Library/Application Support/Formula-Backups/20261016-085117/Formula.app`. This is ad-hoc local signing, not distribution notarization. Final type read log: `/tmp/formula-final-types-probe.log`.
- Windows host handles copyEquation to avoid a shared-frontend regression (HTML/text/image plus registered UTF16LE math formats); actual Windows clipboard/host behavior is untested.
- No push, no version bump, no OCR/user data modifications. Current FormulaObject work remains local.

References: [Microsoft MathML clipboard support](https://learn.microsoft.com/en-us/office/math/mathml) documents MathML/Presentation formats, UTF16LE and importer priorities, with Mac version requirements; [Apple Pages equation documentation](https://support.apple.com/en-ie/guide/pages/tanca5a4fbd9/mac) documents the equation dialog's LaTeX/MathML input, not automatic ordinary-document paste conversion.

## Final disposition

The requested native editable WPS clipboard outcome remains unresolved. No host in this environment has yet been proven to receive a native editable Equation Object. This is not COMPLETE and flattened text is not an acceptable math fallback. A real WPS-compatible native equation container/import path remains required; more ordering changes alone are unsupported by the read trace. Word/Pages require installation and actual separate tests. GitHub not pushed; user acceptance/push authorization remains pending. Existing user formula/source and settings were preserved during install and GUI tests.

## 2026-10-16 protocol update

The earlier MathML-only limitations above are historical. The macOS production adapter now publishes Writer OOXML and shared Slides/Sheets GVML in one pasteboard item, derived from the FormulaObject LaTeX through Pandoc/texmath. User acceptance confirmed editable formula objects in all three WPS hosts. See `docs/audit/2026-10-16/wps-three-hosts.md` for native payload captures, isolation experiments, implementation, validation and limitations. No target-host detection is required for the tested combination. Pages direct paste is not covered by this WPS acceptance.
