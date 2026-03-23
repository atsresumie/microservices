import { Router } from "express";
import type { Request, Response } from "express";
import { analyzeResume } from "../services/analyzer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type RouteOptions = {
  maxInputLength: number;
};

type AnalyzeRequestBody = {
  jobDescription?: unknown;
  resumeText?: unknown;
};

// ─── Custom Error ────────────────────────────────────────────────────────────

export class AnalyzeError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "validation_error") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

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

export function analyzeRoutes(options: RouteOptions): Router {
  const router = Router();

  router.post(
    "/analyze",
    (req: Request<unknown, unknown, AnalyzeRequestBody>, res: Response) => {
      const requestId = res.locals.requestId as string | undefined;

      try {
        const body = req.body;

        // ── Validate input ─────────────────────────────────────────────────

        if (!body || typeof body !== "object") {
          sendJsonError(res, 400, "validation_error", "Request body must be a JSON object");
          return;
        }

        const { jobDescription, resumeText } = body;

        if (typeof jobDescription !== "string" || jobDescription.trim().length === 0) {
          sendJsonError(
            res,
            400,
            "validation_error",
            "jobDescription is required and must be a non-empty string"
          );
          return;
        }

        if (typeof resumeText !== "string" || resumeText.trim().length === 0) {
          sendJsonError(
            res,
            400,
            "validation_error",
            "resumeText is required and must be a non-empty string"
          );
          return;
        }

        if (jobDescription.length > options.maxInputLength) {
          sendJsonError(
            res,
            413,
            "payload_too_large",
            `jobDescription exceeds maximum allowed size (${options.maxInputLength} chars)`
          );
          return;
        }

        if (resumeText.length > options.maxInputLength) {
          sendJsonError(
            res,
            413,
            "payload_too_large",
            `resumeText exceeds maximum allowed size (${options.maxInputLength} chars)`
          );
          return;
        }

        // ── Run analysis ───────────────────────────────────────────────────

        const start = performance.now();
        const result = analyzeResume(resumeText, jobDescription);
        const durationMs = Math.round(performance.now() - start);

        console.info(
          JSON.stringify({
            level: "info",
            message: "ATS analysis completed",
            requestId,
            durationMs,
            score: result.score,
            matchedKeywords: result.keywords.matched.length,
            missingKeywords: result.keywords.missing.length,
          })
        );

        res.json(result);
      } catch (err) {
        if (err instanceof AnalyzeError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "Analysis validation failed",
              requestId,
              errorCode: err.code,
              errorMessage: err.message,
            })
          );
          sendJsonError(res, err.statusCode, err.code, err.message);
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
