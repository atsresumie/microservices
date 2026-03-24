import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { extractTextFromBuffer, extractTextFromUrl, PdfFetchError } from "../services/pdfExtractor.js";
import { scoreResumeGeneral } from "../services/generalScorer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type RouteOptions = {
  maxInputLength: number;
  requestBodyLimitBytes: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendJsonError(
  res: Response,
  status: number,
  error: string,
  message: string
): void {
  res.status(status).json({ error, message });
}

// ─── Route Factory ───────────────────────────────────────────────────────────

export function analyzeGeneralRoutes(options: RouteOptions): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.requestBodyLimitBytes },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are accepted"));
      }
    },
  });

  /**
   * POST /analyze/general
   *
   * Two input modes:
   * 1. JSON body: { "resumeUrl": "https://supabase-storage-url..." }
   * 2. Multipart form: file field "resume" with a PDF binary
   */
  router.post(
    "/analyze/general",
    (req: Request, res: Response, next) => {
      const contentType = req.header("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        upload.single("resume")(req, res, (err) => {
          if (err) {
            if (err instanceof multer.MulterError) {
              sendJsonError(res, 413, "payload_too_large", err.message);
              return;
            }
            sendJsonError(res, 400, "validation_error", err.message);
            return;
          }
          next();
        });
      } else {
        next();
      }
    },
    async (req: Request, res: Response) => {
      const requestId = res.locals.requestId as string | undefined;

      try {
        let resumeText: string;
        let pageCount: number;
        const contentType = req.header("content-type") ?? "";

        // ── Mode 1: Multipart PDF upload ──────────────────────────────────

        if (contentType.includes("multipart/form-data")) {
          const file = req.file;
          if (!file || !file.buffer || file.buffer.length === 0) {
            sendJsonError(
              res, 400, "validation_error",
              "PDF file is required. Upload a file with field name \"resume\""
            );
            return;
          }

          const extracted = await extractTextFromBuffer(file.buffer);
          resumeText = extracted.text;
          pageCount = extracted.pageCount;
        }

        // ── Mode 2: JSON with resumeUrl ───────────────────────────────────

        else {
          const body = req.body as Record<string, unknown> | undefined;

          if (!body || typeof body !== "object") {
            sendJsonError(res, 400, "validation_error", "Request body must be JSON with \"resumeUrl\" or multipart with a PDF file");
            return;
          }

          const { resumeUrl } = body;

          if (typeof resumeUrl !== "string" || resumeUrl.trim().length === 0) {
            sendJsonError(
              res, 400, "validation_error",
              "resumeUrl is required and must be a non-empty string"
            );
            return;
          }

          // Basic URL validation
          try {
            new URL(resumeUrl);
          } catch {
            sendJsonError(res, 400, "validation_error", "resumeUrl is not a valid URL");
            return;
          }

          const extracted = await extractTextFromUrl(resumeUrl);
          resumeText = extracted.text;
          pageCount = extracted.pageCount;
        }

        // ── Validate extracted text ───────────────────────────────────────

        if (!resumeText || resumeText.trim().length === 0) {
          sendJsonError(
            res, 422, "extraction_failed",
            "Could not extract text from the PDF. The file may be image-based or empty."
          );
          return;
        }

        if (resumeText.length > options.maxInputLength) {
          sendJsonError(
            res, 413, "payload_too_large",
            `Extracted text exceeds maximum allowed size (${options.maxInputLength} chars)`
          );
          return;
        }

        // ── Run general scoring ───────────────────────────────────────────

        const start = performance.now();
        const result = scoreResumeGeneral(resumeText, pageCount);
        const durationMs = Math.round(performance.now() - start);

        console.info(
          JSON.stringify({
            level: "info",
            message: "General ATS analysis completed",
            requestId,
            durationMs,
            score: result.score,
            wordCount: result.metadata.wordCount,
            pageCount: result.metadata.pageCount,
            keywordsDetected: result.metadata.detectedKeywords.length,
          })
        );

        res.json(result);
      } catch (err) {
        if (err instanceof PdfFetchError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "PDF fetch/extraction failed",
              requestId,
              errorMessage: err.message,
            })
          );
          sendJsonError(res, err.statusCode, "pdf_error", err.message);
          return;
        }

        console.error(
          JSON.stringify({
            level: "error",
            message: "Unexpected analysis error",
            requestId,
            error: err instanceof Error ? err.message : String(err),
          })
        );

        sendJsonError(res, 500, "internal_error", "Unexpected analysis error");
      }
    }
  );

  return router;
}
