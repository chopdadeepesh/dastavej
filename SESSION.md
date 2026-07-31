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
- Bundled in `public/Templates/` (root-level .docx + category subfolders: `affidavit`, `agreement`, `leave and license`, `POA`, `Release`, `sale deed`).
- Categories defined in `src/data/templates.js` (manifest with `unsupported` flags).
- `.doc` files (legacy, NOT browser-parseable) are marked unsupported and shown with a warning in the sidebar.
- Original untouched templates: `C:\Users\LENOVO\Desktop\Web Project\Templates`.

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
- **Open issue:** exported .docx text ordering was jumbled; root cause (run-index drift from empty runs/paragraphs) was just fixed in renderer + exporter. **Not yet verified.**
- **Next:** load `public/Templates/affidavit/Affidivate same name.docx`, export without edits, open the .docx and confirm text order matches the editor view. Then verify formatting (fonts, spacing, alignment, tables) and edit → re-export round-trip.
