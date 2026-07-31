import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

function htmlToDocxChildren(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  const children = [];

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text })],
          })
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const text = node.textContent.trim();

    if (!text && tag !== "br" && tag !== "hr" && tag !== "table") return;

    switch (tag) {
      case "h1":
        children.push(
          new Paragraph({
            children: [new TextRun({ text, bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1,
          })
        );
        break;
      case "h2":
        children.push(
          new Paragraph({
            children: [new TextRun({ text, bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
          })
        );
        break;
      case "h3":
        children.push(
          new Paragraph({
            children: [new TextRun({ text, bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_3,
          })
        );
        break;
      case "p":
      case "div":
        const pChildren = [];
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            if (child.textContent.trim()) {
              pChildren.push(new TextRun({ text: child.textContent }));
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const innerText = child.textContent;
            const isBold =
              child.tagName === "B" || child.tagName === "STRONG";
            const isItalic =
              child.tagName === "I" || child.tagName === "EM";
            const isUnderline = child.tagName === "U";
            if (innerText.trim()) {
              pChildren.push(
                new TextRun({
                  text: innerText,
                  bold: isBold,
                  italics: isItalic,
                  underline: isUnderline ? {} : undefined,
                })
              );
            }
          }
        });
        if (pChildren.length === 0 && text) {
          pChildren.push(new TextRun({ text }));
        }
        if (pChildren.length > 0) {
          children.push(new Paragraph({ children: pChildren }));
        }
        break;
      case "strong":
      case "b":
        if (text) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text, bold: true })],
            })
          );
        }
        break;
      case "em":
      case "i":
        if (text) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text, italics: true })],
            })
          );
        }
        break;
      case "u":
        if (text) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text, underline: {} }),
              ],
            })
          );
        }
        break;
      case "br":
        children.push(new Paragraph({ children: [] }));
        break;
      case "hr":
        children.push(
          new Paragraph({
            children: [],
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "999999",
              },
            },
          })
        );
        break;
      case "ul":
        node.querySelectorAll("li").forEach((li) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: li.textContent })],
              bullet: { level: 0 },
            })
          );
        });
        break;
      case "ol":
        let index = 1;
        node.querySelectorAll("li").forEach((li) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${index}. ${li.textContent}` }),
              ],
            })
          );
          index++;
        });
        break;
      case "table":
        const rows = [];
        node.querySelectorAll("tr").forEach((tr) => {
          const cells = [];
          tr.querySelectorAll("td, th").forEach((cell) => {
            cells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cell.textContent })],
                  }),
                ],
                width: { size: 20, type: WidthType.PERCENTAGE },
              })
            );
          });
          if (cells.length > 0) {
            rows.push(new TableRow({ children: cells }));
          }
        });
        if (rows.length > 0) {
          children.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
        }
        break;
      default:
        if (text && !["span", "font", "small", "big", "sub", "sup"].includes(tag)) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text })],
            })
          );
        }
        break;
    }
  }

  Array.from(body.childNodes).forEach(processNode);

  if (children.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "(Empty document)" })],
      })
    );
  }

  return children;
}

export async function exportToDocx(html, filename = "edited-document.docx") {
  const children = htmlToDocxChildren(html);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
