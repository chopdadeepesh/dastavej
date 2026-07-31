import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function exportDocx(template, editedTexts, filename) {
  const { zip, originalXml } = template;

  const parser = new DOMParser();
  const doc = parser.parseFromString(originalXml, "application/xml");

  const allRuns = [];

  function collectRuns(element) {
    const children = Array.from(element.children);
    for (const child of children) {
      if (child.localName === "r") {
        allRuns.push(child);
      } else if (child.localName === "hyperlink") {
        collectRuns(child);
      } else if (child.localName === "p" || child.localName === "tc") {
        collectRuns(child);
      }
    }
  }

  const body = doc.querySelector("w\\:body, body");
  if (body) {
    collectRuns(body);
  }

  let runIndex = 0;

  allRuns.forEach((rElement) => {
    const textElements = Array.from(rElement.children).filter(
      (el) => el.localName === "t"
    );
    const currentText = textElements.map((t) => t.textContent).join("");
    const key = `run-${runIndex}`;
    const editedText = editedTexts[key];

    if (editedText !== undefined && editedText !== currentText) {
      if (textElements.length === 1) {
        textElements[0].textContent = editedText;
        if (hasSpaces(editedText)) {
          textElements[0].setAttribute("xml:space", "preserve");
        }
      } else {
        rElement.removeChild(textElements[0]);
        const newT = doc.createElementNS(
          "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
          "w:t"
        );
        newT.textContent = editedText;
        if (hasSpaces(editedText)) {
          newT.setAttribute("xml:space", "preserve");
        }
        const firstChild = rElement.firstChild;
        if (firstChild && firstChild.localName === "rPr") {
          rElement.insertBefore(newT, firstChild.nextSibling);
        } else {
          rElement.insertBefore(newT, rElement.firstChild);
        }
      }
    }
    runIndex++;
  });

  const serializer = new XMLSerializer();
  const newXml = serializer.serializeToString(doc);

  const newZip = new JSZip();

  const filePromises = [];
  zip.forEach((relativePath, zipEntry) => {
    if (relativePath !== "word/document.xml") {
      filePromises.push(
        zipEntry.async("uint8array").then((data) => {
          newZip.file(relativePath, data);
        })
      );
    }
  });

  await Promise.all(filePromises);

  newZip.file("word/document.xml", newXml);

  const blob = await newZip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  saveAs(
    new Blob([blob], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    filename
  );
}

export function extractTextsFromHtml(html) {
  const texts = {};
  const div = document.createElement("div");
  div.innerHTML = html;

  const spans = div.querySelectorAll("span[data-run]");
  spans.forEach((span) => {
    const runIdx = span.getAttribute("data-run");
    if (runIdx !== null) {
      texts[`run-${runIdx}`] = span.textContent;
    }
  });

  div.remove();
  return texts;
}

function hasSpaces(text) {
  return text.startsWith(" ") || text.endsWith(" ") || text.includes("  ");
}
