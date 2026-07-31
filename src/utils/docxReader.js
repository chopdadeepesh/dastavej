import mammoth from "mammoth";

export async function readDocx(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
        ],
      }
    );

    let html = result.value;
    html = postProcessHtml(html);

    return {
      html,
      messages: result.messages,
    };
  } catch (error) {
    console.error("Error reading docx:", error);
    throw error;
  }
}

function postProcessHtml(html) {
  html = html.replace(/<p([^>]*)>\s*<\/p>/g, '<p$1>&nbsp;</p>');

  html = html.replace(
    /<table(?![^>]*style)/g,
    '<table style="width:100%;border-collapse:collapse;margin:12px 0;"'
  );

  html = html.replace(
    /<td(?![^>]*style)/g,
    '<td style="border:1px solid #000;padding:4pt 8pt;"'
  );

  html = html.replace(
    /<th(?![^>]*style)/g,
    '<th style="border:1px solid #000;padding:4pt 8pt;background:#d9d9d9;font-weight:bold;"'
  );

  html = html.replace(/\n{3,}/g, "\n\n");

  return html;
}

export async function readDocxRaw(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
    console.error("Error fetching docx:", error);
    throw error;
  }
}
