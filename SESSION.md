# SESSION.md — Project Context

> Purpose: remember the context and state of this project across sessions. Read this before doing any work.

## Project
- **App:** Dastavej (दस्तावेज) — view, edit, and export Indian legal document Word templates (.docx) in the browser with formatting preserved.
- **Location:** `C:\Users\LENOVO\Desktop\dastavej`
- **Stack:** React + Vite, Tailwind CSS, JSZip, file-saver, lucide-react, mammoth (unused), TipTap (unused), docx (unused).
- **Constraint:** Frontend only — no backend. All templates bundled in the app. Open-source libraries only.

## Current Approach (final, after rejected attempts)
1. **Parse:** `src/utils/docxTemplateParser.js` opens the .docx ZIP, parses `word/document.xml` (+ `styles.xml`, `theme/theme1.xml`) via DOMParser, and produces a `paragraphs` array (`{type: 'paragraph', runs:[...]}` or `{type:'table', rows:[...]}`), plus page settings, styles, and theme. Resolves fonts (ascii + eastAsia fallback chain), sizes (half-points), paragraph spacing/indent, alignment.
2. **Edit:** `src/components/DocumentEditor.jsx` renders the document in a single `contentEditable` div, page-accurate (page size/margins in px via twips). Each run is a `<span data-run={idx}>` with inline styles. Edited texts are captured from the DOM on blur via `captureEdits()`.
3. **Export:** `src/utils/docxExporter.js` clones the ORIGINAL `document.xml`, replaces only the `<w:t>` text of edited runs, rebuilds the ZIP, and downloads via file-saver. Formatting is preserved because only text nodes change.

## Critical: Run-Index Alignment (bug recently fixed — DO NOT regress)
Renderer, initial text map, and exporter MUST assign identical sequential indices to runs.
- `buildTextMap()` (DocumentEditor) keys = `` `run-${idx}` `` — same prefix as exporter lookup.
- `captureEdits()` reads `span[data-run]`, stores as `` `run-${idx}` ``.
- Exporter: `runIndex++` runs for EVERY `<w:r>` element, INCLUDING empty ones and empty paragraphs.
- Renderer: `runIndexRef.current++` fires for every run; empty paragraphs still increment the counter (render `<br/>` but advance index). Empty runs get NO `data-run` span.
- Traversal order must match: body children → `p`/`tbl`; tables → `tr` → `tc` → `p` → `r`; hyperlink runs included.
- Symptom if broken: exported .docx has jumbled/misplaced text.

## Templates
- Bundled in `public/Templates/` — 82 .docx files. Structure (2026-07-31): root-level misc files; categories `affidavit`, `agreement`, `correction deed`, `kruti dev` (35 files, legacy-encoded — show gibberish in browser), `leave and license`, `POA`, `Release`, `sale deed`, `Token`, `Will`; many categories split into `english`/`hindi`/`marathi` subfolders. Template files auto-discovered recursively (subfolders become categories in the manifest).
- Categories defined in `src/data/templates.js` (imports auto-generated `src/data/templates.gen.js` from the Vite plugin; DO NOT use `require()` here — browser ESM has no `require`).
- All legacy `.doc` files were converted to `.docx` via Word COM (July 2026).
- Original untouched templates: `C:\Users\LENOVO\Desktop\Web Project\Templates`.
- Fonts: Google Fonts `Noto Sans Devanagari` loaded via `<link>` in `index.html`; wired into fallback stacks in `DocumentEditor.jsx` (`resolveFont`) and default editor font. Display-only — exporter never rewrites fonts. Kruti Dev-encoded files show Latin gibberish in browser (non-Unicode text).

## Key Files
| File | Role |
|---|---|
| `src/App.jsx` | Layout: top bar + `TemplateBrowser` sidebar + `DocumentEditor` |
| `src/components/TemplateBrowser.jsx` | Sidebar: category tree, search, .doc warnings |
| `src/components/DocumentEditor.jsx` | Page-accurate contentEditable editor, `data-run` spans, run index, export button |
| `src/utils/docxTemplateParser.js` | .docx ZIP → paragraphs/tables with resolved formatting |
| `src/utils/docxExporter.js` | Original-XML text replacement + ZIP rebuild + download |
| `src/components/Toolbar.jsx` | TipTap toolbar — UNUSED in current approach |
| `src/utils/docxReader.js`, `src/utils/docxWriter.js` | Leftovers from rejected mammoth/docx.js approach — UNUSED, not imported |
| `src/index.css` | Tailwind + `.document-content` styles |
| `package.json` | React 19, Vite 8, scripts: `dev`, `build`, `preview` |

## Rejected Approaches (do not re-propose)
- mammoth.js (lossy HTML conversion — loses fidelity) → `docxReader.js`
- TipTap editor (over-engineered, formatting mismatch) → `Toolbar.jsx`
- Input-box / per-field editing
- docx.js (docxWriter.js) — rebuilds doc from scratch, loses original formatting

## Current State / Next Steps
- `npx vite build` passes (Vite 8.1.5, ~320 KB bundle).
- Dev server: `npm run dev` (default port 5173; may pick 5174 if busy).
- **DEPLOYED:** GitHub Pages at `https://chopdadeepesh.github.io/dastavej/` (repo `chopdadeepesh/dastavej`, public, Pages source = GitHub Actions, workflow `.github/workflows/deploy.yml`). Git identity configured globally.
- **Open issue (VERIFIED FIXED 2026-07-31):** run-index alignment between renderer and exporter was verified end-to-end with a Node harness (jsdom + JSZip, replicating all traversals) against ALL current templates (82 files). Result: parser, renderer, and exporter run sequences are identical for 81/82; only VML-textbox text is excluded (see below). Three real bugs found & fixed during verification:
  1. `collectRuns` skipped `w:tbl` entirely (dropped table runs, desynced all indices after a mid-document table). Now recurses `tbl→tr→tc→p`.
  2. Editing a run with zero `<w:t>` children (e.g. only `w:tab`/`w:br`) crashed the whole export via `removeChild(undefined)`. Now guards `textElements.length > 0`.
  3. Runs nested in inline containers (`w:smartTag`, `w:ins`/`w:del`, `w:fldSimple`, etc.) were missed by BOTH parser and exporter (e.g. Token templates had smart-tag runs "SALE"/"Nagpur"). Both now walk paragraph children in document order, recursing into those containers — parser and exporter must keep this identical.
- **KNOWN LIMITATION:** text inside VML textboxes (`w:pict` → `w:textbox` → `w:txbxContent`, e.g. stamp/seal in `correction deed/english/NARULE CORRECTION DEED.docx`) is NOT shown in the editor preview (would render inline in the wrong place) but IS preserved untouched on export; parser==exporter so edits still land correctly.
- Round-trip harness: `C:\Users\LENOVO\AppData\Local\Temp\opencode\docxtest\verify.mjs` + `roundtrip.mjs` + `inspect.mjs` (temp, not in repo).
- **Remaining manual check:** open an exported file in Word to confirm visual formatting (fonts/spacing/alignment/tables) matches the editor preview.
- **Next:** open an exported .docx from the app in Word and confirm visual formatting matches the editor preview (fonts, spacing, alignment, tables).
