import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfExtractionResult = {
  text: string;
  pageCount: number;
};

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const uint8 = new Uint8Array(buffer);
  const doc = await getDocument({ data: uint8, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    pages.push(pageText);
  }

  return {
    text: pages.join("\n"),
    pageCount: doc.numPages,
  };
}

/**
 * Fetch a PDF from a URL and extract its text.
 * Expects a direct download URL (e.g. Supabase storage public/signed URL).
 */
export async function extractTextFromUrl(url: string): Promise<PdfExtractionResult> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new PdfFetchError(
      `Failed to fetch PDF from URL (HTTP ${response.status})`,
      response.status
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    throw new PdfFetchError(
      `URL did not return a PDF (content-type: ${contentType})`,
      415
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new PdfFetchError("Fetched PDF is empty", 422);
  }

  return extractTextFromBuffer(buffer);
}

/**
 * Error thrown during PDF fetch/extraction.
 */
export class PdfFetchError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
