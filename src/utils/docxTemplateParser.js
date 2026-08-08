import JSZip from "jszip";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export async function parseDocx(filePath) {
  const url = filePath.startsWith("http")
    ? filePath
    : `${import.meta.env.BASE_URL}${filePath}`;
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const documentXml = await zip.file("word/document.xml").async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, "application/xml");

  let styles = {};
  let theme = {};
  let pageSettings = {
    pageWidth: 12240,
    pageHeight: 20160,
    marginTop: 1440,
    marginBottom: 1440,
    marginLeft: 1800,
    marginRight: 1800,
  };

  if (zip.file("word/styles.xml")) {
    const stylesXml = await zip.file("word/styles.xml").async("string");
    styles = parseStyles(stylesXml);
  }

  if (zip.file("word/theme/theme1.xml")) {
    const themeXml = await zip.file("word/theme/theme1.xml").async("string");
    theme = parseTheme(themeXml);
  }

  const paragraphs = [];
  const body = doc.querySelector("w\\:body, body");

  if (!body) {
    return { paragraphs, zip, originalXml: documentXml, doc, styles, theme, pageSettings };
  }

  const sectPr = body.querySelector("w\\:sectPr, sectPr");
  if (sectPr) {
    pageSettings = parsePageSettings(sectPr);
  }

  const children = Array.from(body.children).filter(
    (el) => el.localName === "p" || el.localName === "tbl"
  );

  children.forEach((element) => {
    if (element.localName === "p") {
      const para = parseParagraph(element, styles);
      paragraphs.push(para);
    } else if (element.localName === "tbl") {
      const table = parseTable(element, styles);
      paragraphs.push(table);
    }
  });

  return { paragraphs, zip, originalXml: documentXml, doc, styles, theme, pageSettings };
}

function parseStyles(stylesXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(stylesXml, "application/xml");
  const result = {};

  const docDefaults = doc.querySelector("w\\:docDefaults, docDefaults");
  if (docDefaults) {
    const rPrDefault = docDefaults.querySelector("w\\:rPrDefault, rPrDefault");
    if (rPrDefault) {
      const rPr = rPrDefault.querySelector("w\\:rPr, rPr");
      if (rPr) {
        result.defaultFont = extractFont(rPr);
        result.defaultSize = extractSize(rPr);
      }
    }
    const pPrDefault = docDefaults.querySelector("w\\:pPrDefault, pPrDefault");
    if (pPrDefault) {
      const pPr = pPrDefault.querySelector("w\\:pPr, pPr");
      if (pPr) {
        result.defaultParagraph = extractParagraphProps(pPr);
      }
    }
  }

  const styleElements = doc.querySelectorAll("w\\:style, style");
  result.styleMap = {};
  styleElements.forEach((el) => {
    const id = el.getAttribute("w:styleId") || el.getAttribute("styleId");
    if (!id) return;
    const nameEl = el.querySelector("w\\:name, name");
    const name = nameEl ? (nameEl.getAttribute("w:val") || nameEl.getAttribute("val")) : id;
    const type = el.getAttribute("w:type") || el.getAttribute("type");
    const basedOn = el.querySelector("w\\:basedOn, basedOn");
    const basedOnVal = basedOn ? (basedOn.getAttribute("w:val") || basedOn.getAttribute("val")) : null;

    const rPr = el.querySelector("w\\:rPr, rPr");
    const pPr = el.querySelector("w\\:pPr, pPr");

    result.styleMap[id] = {
      name,
      type,
      basedOn: basedOnVal,
      font: rPr ? extractFont(rPr) : null,
      size: rPr ? extractSize(rPr) : null,
      bold: rPr ? !!rPr.querySelector("w\\:b, b") : null,
      italic: rPr ? !!rPr.querySelector("w\\:i, i") : null,
      color: rPr ? extractColor(rPr) : null,
      pProps: pPr ? extractParagraphProps(pPr) : null,
    };
  });

  return result;
}

function extractFont(rPr) {
  const rFonts = rPr.querySelector("w\\:rFonts, rFonts");
  if (!rFonts) return null;
  return {
    ascii: rFonts.getAttribute("w:ascii") || rFonts.getAttribute("ascii") || null,
    hAnsi: rFonts.getAttribute("w:hAnsi") || rFonts.getAttribute("hAnsi") || null,
    eastAsia: rFonts.getAttribute("w:eastAsia") || rFonts.getAttribute("eastAsia") || null,
    cs: rFonts.getAttribute("w:cs") || rFonts.getAttribute("cs") || null,
  };
}

function extractSize(rPr) {
  const sz = rPr.querySelector("w\\:sz, sz");
  const szCs = rPr.querySelector("w\\:szCs, szCs");
  const val = sz ? (sz.getAttribute("w:val") || sz.getAttribute("val")) : null;
  const csVal = szCs ? (szCs.getAttribute("w:val") || szCs.getAttribute("val")) : null;
  return {
    halfPts: val ? parseInt(val) : null,
    csHalfPts: csVal ? parseInt(csVal) : null,
  };
}

function extractColor(rPr) {
  const color = rPr.querySelector("w\\:color, color");
  if (!color) return null;
  return color.getAttribute("w:val") || color.getAttribute("val") || null;
}

function extractParagraphProps(pPr) {
  if (!pPr) return {};
  const result = {};
  const jc = pPr.querySelector("w\\:jc, jc");
  if (jc) result.alignment = jc.getAttribute("w:val") || jc.getAttribute("val");
  const spacing = pPr.querySelector("w\\:spacing, spacing");
  if (spacing) {
    result.spacing = {
      line: spacing.getAttribute("w:line") || spacing.getAttribute("line"),
      before: spacing.getAttribute("w:before") || spacing.getAttribute("before"),
      after: spacing.getAttribute("w:after") || spacing.getAttribute("after"),
      lineRule: spacing.getAttribute("w:lineRule") || spacing.getAttribute("lineRule"),
    };
  }
  const ind = pPr.querySelector("w\\:ind, ind");
  if (ind) {
    result.indent = {
      left: ind.getAttribute("w:left") || ind.getAttribute("left"),
      right: ind.getAttribute("w:right") || ind.getAttribute("right"),
      firstLine: ind.getAttribute("w:firstLine") || ind.getAttribute("firstLine"),
      hanging: ind.getAttribute("w:hanging") || ind.getAttribute("hanging"),
    };
  }
  return result;
}

function parseTheme(themeXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(themeXml, "application/xml");
  const result = { fonts: {}, colors: {} };

  const fontScheme = doc.querySelector("a\\:fontScheme, fontScheme");
  if (fontScheme) {
    const majorFont = fontScheme.querySelector("a\\:majorFont, majorFont");
    const minorFont = fontScheme.querySelector("a\\:minorFont, minorFont");
    if (majorFont) {
      const latinFont = majorFont.querySelector("a\\:latin, latin");
      const eaFont = majorFont.querySelector("a\\:ea, ea");
      result.fonts.major = {
        latin: latinFont ? latinFont.getAttribute("typeface") : null,
        eastAsia: eaFont ? eaFont.getAttribute("typeface") : null,
      };
    }
    if (minorFont) {
      const latinFont = minorFont.querySelector("a\\:latin, latin");
      const eaFont = minorFont.querySelector("a\\:ea, ea");
      result.fonts.minor = {
        latin: latinFont ? latinFont.getAttribute("typeface") : null,
        eastAsia: eaFont ? eaFont.getAttribute("typeface") : null,
      };
    }
  }

  return result;
}

function parsePageSettings(sectPr) {
  const result = {
    pageWidth: 12240,
    pageHeight: 20160,
    marginTop: 1440,
    marginBottom: 1440,
    marginLeft: 1800,
    marginRight: 1800,
  };

  const pgSz = sectPr.querySelector("w\\:pgSz, pgSz");
  if (pgSz) {
    const w = pgSz.getAttribute("w:w") || pgSz.getAttribute("w");
    const h = pgSz.getAttribute("w:h") || pgSz.getAttribute("h");
    if (w) result.pageWidth = parseInt(w);
    if (h) result.pageHeight = parseInt(h);
  }

  const pgMar = sectPr.querySelector("w\\:pgMar, pgMar");
  if (pgMar) {
    const top = pgMar.getAttribute("w:top") || pgMar.getAttribute("top");
    const bottom = pgMar.getAttribute("w:bottom") || pgMar.getAttribute("bottom");
    const left = pgMar.getAttribute("w:left") || pgMar.getAttribute("left");
    const right = pgMar.getAttribute("w:right") || pgMar.getAttribute("right");
    if (top) result.marginTop = parseInt(top);
    if (bottom) result.marginBottom = parseInt(bottom);
    if (left) result.marginLeft = parseInt(left);
    if (right) result.marginRight = parseInt(right);
  }

  return result;
}

function parseParagraph(pElement, styles) {
  const pPr = pElement.querySelector("w\\:pPr, pPr");
  const alignment = getAlignment(pPr);
  const spacing = getSpacing(pPr);
  const indentation = getIndentation(pPr);
  const pStyleId = getStyle(pPr);

  let resolvedStyle = null;
  if (pStyleId && styles?.styleMap?.[pStyleId]) {
    resolvedStyle = styles.styleMap[pStyleId];
  }

  const runs = [];
  const INLINE_CONTAINERS = [
    "hyperlink",
    "smartTag",
    "ins",
    "del",
    "fldSimple",
    "moveFrom",
    "moveTo",
  ];

  function collectInlineRuns(element, isHyperlink) {
    for (const child of Array.from(element.children)) {
      if (child.localName === "r") {
        const run = parseRun(child, styles);
        if (isHyperlink) run.isHyperlink = true;
        runs.push(run);
      } else if (INLINE_CONTAINERS.includes(child.localName)) {
        collectInlineRuns(child, isHyperlink || child.localName === "hyperlink");
      }
    }
  }

  collectInlineRuns(pElement, false);

  return {
    type: "paragraph",
    alignment: alignment || resolvedStyle?.pProps?.alignment || null,
    spacing: mergeSpacing(spacing, resolvedStyle?.pProps?.spacing),
    indentation,
    style: pStyleId,
    resolvedStyle,
    runs,
    element: pElement,
  };
}

function mergeSpacing(direct, style) {
  if (!style) return direct;
  return {
    line: direct.line || style.line,
    before: direct.before || style.before,
    after: direct.after || style.after,
    lineRule: direct.lineRule || style.lineRule,
  };
}

function parseRun(rElement, styles) {
  const rPr = rElement.querySelector("w\\:rPr, rPr");
  const textElements = Array.from(rElement.children).filter(
    (el) => el.localName === "t"
  );
  const text = textElements.map((t) => t.textContent).join("");

  const formatting = getRunFormatting(rPr, styles);

  return {
    text,
    formatting,
    element: rElement,
    textElements,
  };
}

function getRunFormatting(rPr, styles) {
  const defaults = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    size: 11,
    color: null,
    fontFamily: null,
    eastAsiaFont: null,
    highlight: null,
  };

  if (!rPr) return defaults;

  const hasB = rPr.querySelector("w\\:b, b");
  const hasBcs = rPr.querySelector("w\\:bCs, bCs");
  defaults.bold = hasB ? !hasB.getAttribute("w:val") || hasB.getAttribute("w:val") !== "0" : false;

  const hasI = rPr.querySelector("w\\:i, i");
  defaults.italic = hasI ? !hasI.getAttribute("w:val") || hasI.getAttribute("w:val") !== "0" : false;

  const hasU = rPr.querySelector("w\\:u, u");
  defaults.underline = !!hasU;

  const hasStrike = rPr.querySelector("w\\:strike, strike");
  defaults.strike = !!hasStrike;

  const sizeEl = rPr.querySelector("w\\:sz, sz");
  if (sizeEl) {
    const val = sizeEl.getAttribute("w:val") || sizeEl.getAttribute("val");
    if (val) defaults.size = parseInt(val) / 2;
  }

  const colorEl = rPr.querySelector("w\\:color, color");
  if (colorEl) {
    const val = colorEl.getAttribute("w:val") || colorEl.getAttribute("val");
    if (val && val !== "auto") defaults.color = val;
  }

  const fontEl = rPr.querySelector("w\\:rFonts, rFonts");
  if (fontEl) {
    defaults.fontFamily = fontEl.getAttribute("w:ascii") || fontEl.getAttribute("ascii") || null;
    defaults.eastAsiaFont = fontEl.getAttribute("w:eastAsia") || fontEl.getAttribute("eastAsia") || null;
    if (!defaults.fontFamily) {
      defaults.fontFamily = fontEl.getAttribute("w:hAnsi") || fontEl.getAttribute("hAnsi") || null;
    }
  }

  const highlightEl = rPr.querySelector("w\\:highlight, highlight");
  if (highlightEl) {
    defaults.highlight = highlightEl.getAttribute("w:val") || highlightEl.getAttribute("val");
  }

  const highlightEl2 = rPr.querySelector("w\\:shd, shd");
  if (highlightEl2) {
    defaults.shading = highlightEl2.getAttribute("w:fill") || highlightEl2.getAttribute("fill");
  }

  return defaults;
}

function getAlignment(pPr) {
  if (!pPr) return null;
  const jcEl = pPr.querySelector("w\\:jc, jc");
  if (!jcEl) return null;
  return jcEl.getAttribute("w:val") || jcEl.getAttribute("val") || null;
}

function getSpacing(pPr) {
  if (!pPr) return {};
  const spacingEl = pPr.querySelector("w\\:spacing, spacing");
  if (!spacingEl) return {};
  return {
    line: spacingEl.getAttribute("w:line") || spacingEl.getAttribute("line"),
    before: spacingEl.getAttribute("w:before") || spacingEl.getAttribute("before"),
    after: spacingEl.getAttribute("w:after") || spacingEl.getAttribute("after"),
    lineRule: spacingEl.getAttribute("w:lineRule") || spacingEl.getAttribute("lineRule"),
  };
}

function getIndentation(pPr) {
  if (!pPr) return {};
  const indEl = pPr.querySelector("w\\:ind, ind");
  if (!indEl) return {};
  return {
    left: indEl.getAttribute("w:left") || indEl.getAttribute("left"),
    right: indEl.getAttribute("w:right") || indEl.getAttribute("right"),
    firstLine: indEl.getAttribute("w:firstLine") || indEl.getAttribute("firstLine"),
    hanging: indEl.getAttribute("w:hanging") || indEl.getAttribute("hanging"),
  };
}

function getStyle(pPr) {
  if (!pPr) return null;
  const styleEl = pPr.querySelector("w\\:pStyle, pStyle");
  if (!styleEl) return null;
  return styleEl.getAttribute("w:val") || styleEl.getAttribute("val") || null;
}

function parseTable(tblElement, styles) {
  const tblPr = tblElement.querySelector("w\\:tblPr, tblPr");
  let tableProps = {};
  if (tblPr) {
    const tblW = tblPr.querySelector("w\\:tblW, tblW");
    if (tblW) {
      tableProps.width = {
        value: tblW.getAttribute("w:w") || tblW.getAttribute("w"),
        type: tblW.getAttribute("w:type") || tblW.getAttribute("type"),
      };
    }
    const tblBorders = tblPr.querySelector("w\\:tblBorders, tblBorders");
    if (tblBorders) {
      tableProps.borders = {};
      ["top", "left", "bottom", "right", "insideH", "insideV"].forEach((side) => {
        const border = tblBorders.querySelector(`w\\:${side}, ${side}`);
        if (border) {
          tableProps.borders[side] = {
            val: border.getAttribute("w:val") || border.getAttribute("val"),
            sz: border.getAttribute("w:sz") || border.getAttribute("sz"),
            color: border.getAttribute("w:color") || border.getAttribute("color"),
          };
        }
      });
    }
  }

  const rows = [];
  const trElements = Array.from(tblElement.children).filter(
    (el) => el.localName === "tr"
  );

  trElements.forEach((tr) => {
    const cells = [];
    const tcElements = Array.from(tr.children).filter(
      (el) => el.localName === "tc"
    );
    tcElements.forEach((tc) => {
      const paragraphs = [];
      const pElements = Array.from(tc.children).filter(
        (el) => el.localName === "p"
      );
      pElements.forEach((p) => {
        paragraphs.push(parseParagraph(p, styles));
      });
      cells.push({ paragraphs, element: tc });
    });
    rows.push({ cells, element: tr });
  });

  return { type: "table", rows, props: tableProps, element: tblElement };
}
