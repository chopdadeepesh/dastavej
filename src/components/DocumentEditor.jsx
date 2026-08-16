import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { parseDocx } from "../utils/docxTemplateParser";
import { exportDocx } from "../utils/docxExporter";
import {
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Check,
  Pencil,
} from "lucide-react";

function twipsToPt(twips) {
  return parseInt(twips) / 20;
}

function twipsToPx(twips) {
  return (parseInt(twips) / 20) * (96 / 72);
}

function resolveFont(run, resolvedStyle, template) {
  const { styles, theme } = template;
  let fontName = run.formatting.fontFamily;
  if (!fontName && resolvedStyle?.font?.ascii) fontName = resolvedStyle.font.ascii;
  if (!fontName && styles?.defaultFont?.ascii) fontName = styles.defaultFont.ascii;
  if (!fontName && theme?.fonts?.major?.latin) fontName = theme.fonts.major.latin;
  if (!fontName && theme?.fonts?.minor?.latin) fontName = theme.fonts.minor.latin;

  let eastAsiaFont = run.formatting.eastAsiaFont;
  if (!eastAsiaFont && resolvedStyle?.font?.eastAsia) eastAsiaFont = resolvedStyle.font.eastAsia;
  if (!eastAsiaFont && styles?.defaultFont?.eastAsia) eastAsiaFont = styles.defaultFont.eastAsia;
  if (!eastAsiaFont && theme?.fonts?.major?.eastAsia) eastAsiaFont = theme.fonts.major.eastAsia;
  if (!eastAsiaFont && theme?.fonts?.minor?.eastAsia) eastAsiaFont = theme.fonts.minor.eastAsia;

  const fontStack = [];
  if (fontName) fontStack.push(fontName);
  if (eastAsiaFont) fontStack.push(eastAsiaFont);
  fontStack.push("Noto Sans Devanagari", "Times New Roman", "serif");
  return fontStack.join(", ");
}

function resolveSize(run, resolvedStyle, template) {
  let size = run.formatting.size;
  if (!size && resolvedStyle?.size?.halfPts) size = resolvedStyle.size.halfPts / 2;
  if (!size && template?.styles?.defaultSize?.halfPts) size = template.styles.defaultSize.halfPts / 2;
  return size || 11;
}

const measureCtx = (() => {
  try {
    return document.createElement("canvas").getContext("2d");
  } catch {
    return null;
  }
})();

function measureTextWidth(text, pt, fontFamily) {
  if (!measureCtx || !text) return 0;
  measureCtx.font = `${pt * (96 / 72)}px ${fontFamily}`;
  return measureCtx.measureText(text).width;
}

const pxToTwips = (px) => px * 15;

function nextTabStop(cursorTwips, stops, defaultTab) {
  for (const s of stops) {
    if (s.pos > cursorTwips + 1) return s.pos;
  }
  const base = Math.floor(cursorTwips / defaultTab) * defaultTab;
  return base + defaultTab;
}

function buildTextMap(paragraphs) {
  const map = {};
  let idx = 0;
  function walk(elements) {
    for (const element of elements) {
      if (element.type === "paragraph") {
        for (const run of element.runs) {
          map[`run-${idx}`] = run.text;
          idx++;
        }
      } else if (element.type === "table") {
        for (const row of element.rows) {
          for (const cell of row.cells) {
            walk(cell.paragraphs);
          }
        }
      }
    }
  }
  walk(paragraphs);
  return map;
}

export default function DocumentEditor({ file }) {
  const [template, setTemplate] = useState(null);
  const [editedTexts, setEditedTexts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const documentRef = useRef(null);
  const runIndexRef = useRef(0);

  const loadDocument = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseDocx(file.path);
      setTemplate(result);
      const originalTexts = buildTextMap(result.paragraphs);
      setEditedTexts(originalTexts);
    } catch (err) {
      console.error(err);
      setError("Failed to load document. " + err.message);
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const captureEdits = useCallback(() => {
    if (!documentRef.current) return;
    const spans = documentRef.current.querySelectorAll("span[data-run]");
    const updates = {};
    spans.forEach((span) => {
      const idx = span.getAttribute("data-run");
      if (idx !== null) {
        updates[`run-${idx}`] = span.textContent;
      }
    });
    setEditedTexts((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleExport = async () => {
    if (!template) return;
    captureEdits();
    setExporting(true);
    setExportSuccess(false);
    try {
      const fileName = file ? `edited-${file.name}` : "edited-document.docx";
      await exportDocx(template, editedTexts, fileName);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">No Template Selected</h3>
          <p className="text-sm text-slate-500">Select a template from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  const renderRun = (run, resolvedStyle, runIdx) => {
    const f = run.formatting;
    const fontFamily = resolveFont(run, resolvedStyle, template);
    const fontSize = resolveSize(run, resolvedStyle, template);

    return (
      <span
        key={`run-${runIdx}`}
        data-run={runIdx}
        style={{
          fontWeight: f.bold ? "bold" : "normal",
          fontStyle: f.italic ? "italic" : "normal",
          textDecoration: [
            f.underline ? "underline" : "",
            f.strike ? "line-through" : "",
          ].filter(Boolean).join(" ") || "none",
          fontSize: `${fontSize}pt`,
          fontFamily: fontFamily,
          color: f.color ? `#${f.color}` : "#000",
          backgroundColor: f.highlight ? getHighlightColor(f.highlight) : (f.shading ? `#${f.shading}` : "transparent"),
        }}
      >
        {run.text}
      </span>
    );
  };

  const renderParagraph = (para, pIdx) => {
    const pStyle = {};
    if (para.alignment) {
      const alignMap = { center: "center", right: "right", both: "justify", left: "left" };
      pStyle.textAlign = alignMap[para.alignment.toLowerCase()] || "left";
    }
    if (para.spacing?.line) {
      const line = parseInt(para.spacing.line);
      pStyle.lineHeight = para.spacing.lineRule === "auto" ? line / 240 : line / 20;
    } else {
      pStyle.lineHeight = 1.15;
    }
    if (para.spacing?.before) pStyle.marginTop = `${twipsToPt(para.spacing.before)}pt`;
    if (para.spacing?.after) pStyle.marginBottom = `${twipsToPt(para.spacing.after)}pt`;
    if (para.indentation?.firstLine) pStyle.textIndent = `${twipsToPt(para.indentation.firstLine)}pt`;
    if (para.indentation?.left) pStyle.marginLeft = `${twipsToPt(para.indentation.left)}pt`;

    if (para.resolvedStyle?.pProps?.spacing) {
      const s = para.resolvedStyle.pProps.spacing;
      if (!pStyle.lineHeight && s.line) {
        const line = parseInt(s.line);
        pStyle.lineHeight = s.lineRule === "auto" ? line / 240 : line / 20;
      }
      if (!pStyle.marginTop && s.before) pStyle.marginTop = `${twipsToPt(s.before)}pt`;
      if (!pStyle.marginBottom && s.after) pStyle.marginBottom = `${twipsToPt(s.after)}pt`;
    }

    const isEmpty = para.runs.every((r) => !r.text.trim());

    if (isEmpty) {
      return (
        <p key={pIdx} style={pStyle}>
          {para.runs.map((run, rIdx) => {
            runIndexRef.current++;
            return null;
          })}
          <br />
        </p>
      );
    }

    const tabStops = para.tabStops || [];
    const defaultTab = template?.settings?.defaultTabStop || 720;
    let cursorTwips = parseInt(para.indentation?.left) || 0;

    return (
      <p key={pIdx} style={pStyle}>
        {para.runs.map((run, rIdx) => {
          const idx = runIndexRef.current++;
          if (run.break) {
            return <br key={`r-${rIdx}`} />;
          }
          if (run.tab) {
            const fontFamily = resolveFont(run, para.resolvedStyle, template);
            const fontSize = resolveSize(run, para.resolvedStyle, template);
            const textWidthTwips = pxToTwips(
              measureTextWidth(run.text, fontSize, fontFamily)
            );
            const target = nextTabStop(
              cursorTwips + textWidthTwips,
              tabStops,
              defaultTab
            );
            const wTwips = Math.max(target - (cursorTwips + textWidthTwips), 1);
            cursorTwips = target;
            const spacer = (
              <span
                style={{
                  display: "inline-block",
                  width: `${twipsToPx(wTwips)}px`,
                }}
              />
            );
            if (run.text) {
              return (
                <Fragment key={`r-${rIdx}`}>
                  {renderRun(run, para.resolvedStyle, idx)}
                  {spacer}
                </Fragment>
              );
            }
            return (
              <Fragment key={`r-${rIdx}`}>
                <span data-run={idx} />
                {spacer}
              </Fragment>
            );
          }
          const fontFamily = resolveFont(run, para.resolvedStyle, template);
          const fontSize = resolveSize(run, para.resolvedStyle, template);
          cursorTwips += pxToTwips(
            measureTextWidth(run.text, fontSize, fontFamily)
          );
          return renderRun(run, para.resolvedStyle, idx);
        })}
      </p>
    );
  };

  const renderTable = (table, tIdx) => {
    const tblStyle = { borderCollapse: "collapse", width: "100%", margin: "8pt 0" };
    const defaultBorder = "1px solid #000";

    const getBorderStyle = (side) => {
      if (table.props?.borders?.[side]) {
        const b = table.props.borders[side];
        const sz = b.sz ? `${parseInt(b.sz) / 8}px` : "1px";
        const color = b.color && b.color !== "auto" ? `#${b.color}` : "#000";
        return `${sz} solid ${color}`;
      }
      return defaultBorder;
    };

    return (
      <table key={tIdx} style={tblStyle}>
        <tbody>
          {table.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.cells.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    borderTop: getBorderStyle("top"),
                    borderLeft: getBorderStyle("left"),
                    borderBottom: getBorderStyle("bottom"),
                    borderRight: getBorderStyle("right"),
                    padding: "4pt 8pt",
                    verticalAlign: "top",
                  }}
                >
                  {cell.paragraphs.map((p, pIdx) => (
                    <div key={pIdx}>{renderParagraph(p, pIdx)}</div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  runIndexRef.current = 0;

  const page = template?.pageSettings;
  const pageWidthPx = page ? twipsToPx(page.pageWidth) : 816;
  const pageHeightPx = page ? twipsToPx(page.pageHeight) : 1056;
  const marginTop = page ? twipsToPx(page.marginTop) : 96;
  const marginBottom = page ? twipsToPx(page.marginBottom) : 96;
  const marginLeft = page ? twipsToPx(page.marginLeft) : 120;
  const marginRight = page ? twipsToPx(page.marginRight) : 120;

  const defaultFont = template?.theme?.fonts?.minor?.latin || template?.styles?.defaultFont?.ascii || "Times New Roman";
  const defaultFontEA = template?.theme?.fonts?.minor?.eastAsia || template?.styles?.defaultFont?.eastAsia || "";
  const defaultSize = template?.styles?.defaultSize?.halfPts ? template.styles.defaultSize.halfPts / 2 : 11;

  const fontStack = [defaultFont];
  if (defaultFontEA) fontStack.push(defaultFontEA);
  fontStack.push("Noto Sans Devanagari", "serif");

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-200 truncate">{file.name}</h3>
            <p className="text-xs text-slate-500">{file.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            Click to type, select to edit
          </span>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              exportSuccess ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
            } disabled:opacity-50`}
          >
            {exporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Exporting...</>
            ) : exportSuccess ? (
              <><Check className="w-4 h-4" />Downloaded!</>
            ) : (
              <><Download className="w-4 h-4" />Export .docx</>
            )}
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-600">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading document...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-300 mb-2">{error}</p>
            </div>
          </div>
        ) : template ? (
          <div
            className="mx-auto bg-white shadow-2xl"
            style={{ width: `${pageWidthPx}px`, minHeight: `${pageHeightPx}px` }}
          >
            <div
              ref={documentRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className="document-content"
              onBlur={captureEdits}
              style={{
                padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
                fontFamily: fontStack.join(", "),
                fontSize: `${defaultSize}pt`,
                lineHeight: 1.15,
                color: "#000",
                minHeight: `${pageHeightPx - (marginTop + marginBottom)}px`,
              }}
            >
              {template.paragraphs.map((element, idx) => {
                if (element.type === "paragraph") {
                  return renderParagraph(element, idx);
                } else if (element.type === "table") {
                  return renderTable(element, idx);
                }
                return null;
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getHighlightColor(val) {
  const colors = {
    yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff",
    blue: "#0000ff", red: "#ff0000", darkBlue: "#00008b", darkCyan: "#008b8b",
    darkGreen: "#006400", darkMagenta: "#8b008b", darkRed: "#8b0000",
    darkYellow: "#8b8000", darkGray: "#a9a9a9", lightGray: "#d3d3d3",
    black: "#000000", white: "#ffffff",
  };
  return colors[val?.toLowerCase()] || "transparent";
}
