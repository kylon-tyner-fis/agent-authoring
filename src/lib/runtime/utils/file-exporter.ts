import { createClient } from "@supabase/supabase-js";
import pdfMakeModule from "pdfmake";
import { marked } from "marked";

// Safely unwrap the mutable CommonJS object
const pdfmake: any = pdfMakeModule;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Parses inline Markdown tokens (bold, italics, code) into pdfmake text arrays
 */
function parseInline(tokens: any[] = []): any[] {
  return tokens.map((t) => {
    if (t.type === "strong") return { text: t.text, bold: true };
    if (t.type === "em") return { text: t.text, italics: true };
    if (t.type === "codespan") {
      return {
        text: t.text,
        font: "Courier",
        background: "#f1f5f9",
        color: "#334155",
      };
    }
    // Fallback for raw text and unhandled inline tokens
    return { text: t.raw || t.text || "" };
  });
}

/**
 * Converts a Markdown string into a native pdfmake layout array
 */
function markdownToPdfMake(markdown: string): any[] {
  const tokens = marked.lexer(markdown);
  const content: any[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        content.push({
          text: parseInline(token.tokens),
          style: `h${token.depth}`,
          margin: [0, token.depth === 1 ? 15 : 10, 0, 5],
        });
        break;
      case "paragraph":
        content.push({
          text: parseInline(token.tokens),
          margin: [0, 0, 0, 10],
        });
        break;
      case "list":
        // Handle nested inline tokens for list items
        const listItems = token.items.map((item: any) => ({
          text: parseInline(item.tokens[0]?.tokens || []),
          margin: [0, 0, 0, 4],
        }));
        content.push({
          [token.ordered ? "ol" : "ul"]: listItems,
          margin: [10, 0, 0, 10],
        });
        break;
      case "code":
        content.push({
          text: token.text,
          font: "Courier",
          fontSize: 10,
          color: "#334155",
          fillColor: "#f8fafc",
          margin: [0, 5, 0, 10],
        });
        break;
      case "blockquote":
        content.push({
          text: parseInline((token.tokens?.[0] as any).tokens || []),
          italics: true,
          color: "#64748b",
          margin: [20, 0, 0, 10],
        });
        break;
      case "space":
        // Ignore empty line tokens
        break;
      default:
        if ("text" in token) {
          content.push({ text: (token as any).raw, margin: [0, 0, 0, 10] });
        }
    }
  }

  return content;
}

export async function generateAndUploadExport(
  format: string,
  sourceData: any,
  agentId: string = "orchestrator",
): Promise<string> {
  let buffer: Buffer;
  let contentType = "text/plain";
  let extension = format;

  // Ensure data is a string
  const stringData =
    typeof sourceData === "string"
      ? sourceData
      : JSON.stringify(sourceData, null, 2);

  if (format === "pdf") {
    // 1. Define standard fonts (Added Courier for Markdown code blocks!)
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
      Courier: {
        normal: "Courier",
        bold: "Courier-Bold",
        italics: "Courier-Oblique",
        bolditalics: "Courier-BoldOblique",
      },
    };

    if (pdfmake.addFonts) {
      pdfmake.addFonts(fonts);
    }

    // 2. Parse the input through the Markdown bridge
    const documentBody =
      typeof sourceData === "string"
        ? markdownToPdfMake(sourceData)
        : markdownToPdfMake("```json\n" + stringData + "\n```"); // Fallback if they pass an object

    // 3. Define the layout wrapper
    const docDefinition = {
      content: [...documentBody],
      styles: {
        h1: { fontSize: 24, bold: true, color: "#0f172a" },
        h2: { fontSize: 20, bold: true, color: "#1e293b" },
        h3: { fontSize: 16, bold: true, color: "#334155" },
        h4: { fontSize: 14, bold: true, color: "#475569" },
      },
      defaultStyle: {
        font: "Helvetica",
        fontSize: 11,
        lineHeight: 1.4,
        color: "#1e293b",
      },
    };

    // 4. Generate the PDF
    const pdf = pdfmake.createPdf(docDefinition);

    buffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const result = pdf.getBuffer((buf: Buffer) => resolve(buf));
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });

    contentType = "application/pdf";
  } else if (format === "csv") {
    if (Array.isArray(sourceData) && sourceData.length > 0) {
      const headers = Object.keys(sourceData[0]).join(",");
      const rows = sourceData
        .map((row) => Object.values(row).join(","))
        .join("\n");
      buffer = Buffer.from(`${headers}\n${rows}`, "utf-8");
    } else {
      buffer = Buffer.from(stringData, "utf-8");
    }
    contentType = "text/csv";
  } else {
    buffer = Buffer.from(stringData, "utf-8");
    if (format === "json") contentType = "application/json";
  }

  // 5. Upload to Supabase
  const filename = `${agentId}/export-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("agent-outputs")
    .upload(filename, buffer, { contentType });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 6. Generate Signed URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("agent-outputs")
    .createSignedUrl(filename, 3600);

  if (signedUrlError) {
    throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`);
  }

  return signedUrlData.signedUrl;
}
