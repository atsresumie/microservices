import { Router } from "express";
import type { Request, Response } from "express";
import { CompileError, compileLatexToPdf } from "../services/latexCompiler.js";

type RouteOptions = {
  latexMaxLength: number;
  compileTimeoutMs: number;
  tempRootDir: string;
};

function sanitizeFilename(rawFilename: string | undefined): string {
  if (!rawFilename) {
    return "resume.pdf";
  }

  const normalized = rawFilename.trim().replace(/[^A-Za-z0-9_.-]/g, "_");
  const withPdfExt = normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
  return withPdfExt.length > 0 ? withPdfExt : "resume.pdf";
}

function sendJsonError(
  res: Response,
  status: number,
  error: string,
  message: string,
  details?: string
): void {
  res.status(status).json({
    error,
    message,
    ...(details ? { details } : {})
  });
}

function debugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
}): void {
  fetch("http://127.0.0.1:7702/ingest/b6486dbb-9b2e-4bde-90dc-44b751c37d8b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "07c8af"
    },
    body: JSON.stringify({
      sessionId: "07c8af",
      ...payload,
      timestamp: Date.now()
    })
  }).catch(() => {});
}

export function compileRoutes(options: RouteOptions): Router {
  const router = Router();

  type CompilePdfRequest = Request<unknown, unknown, string, { filename?: string }>;

  router.post(
    "/compile/pdf",
    async (req: CompilePdfRequest, res: Response) => {
      const latex = req.body;
      // #region agent log
      debugLog({
        runId: "initial",
        hypothesisId: "H1",
        location: "src/routes/compile.ts:request_entry",
        message: "Compile request received",
        data: {
          contentType: req.header("content-type") ?? "none",
          latexType: typeof latex,
          latexLength: typeof latex === "string" ? latex.length : -1
        }
      });
      // #endregion
      if (typeof latex !== "string" || latex.trim().length === 0) {
        sendJsonError(
          res,
          400,
          "validation_error",
          "LaTeX text body is required with content-type application/text or text/plain"
        );
        return;
      }

      if (latex.length > options.latexMaxLength) {
        sendJsonError(
          res,
          413,
          "payload_too_large",
          `latex exceeds maximum allowed size (${options.latexMaxLength} bytes)`
        );
        return;
      }

      const queryFilename = typeof req.query.filename === "string" ? req.query.filename : undefined;
      const headerFilename = req.header("x-filename");
      const filename = sanitizeFilename(queryFilename ?? headerFilename ?? undefined);
      const requestId = res.locals.requestId as string | undefined;

      try {
        const { pdfBuffer, compileOutput } = await compileLatexToPdf({
          latex,
          timeoutMs: options.compileTimeoutMs,
          tempRootDir: options.tempRootDir
        });

        console.info(
          JSON.stringify({
            level: "info",
            message: "LaTeX compilation succeeded",
            requestId,
            latexBytes: Buffer.byteLength(latex, "utf8"),
            pdfBytes: pdfBuffer.byteLength
          })
        );

        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("x-compile-log-size", String(Buffer.byteLength(compileOutput, "utf8")));
        res.send(pdfBuffer);
      } catch (err) {
        if (err instanceof CompileError) {
          // #region agent log
          debugLog({
            runId: "initial",
            hypothesisId: "H2",
            location: "src/routes/compile.ts:compile_error",
            message: "CompileError captured",
            data: {
              requestId,
              errorCode: err.code,
              hasDetails: Boolean(err.details),
              detailsPreview: err.details ? err.details.slice(0, 240) : ""
            }
          });
          // #endregion
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "LaTeX compilation failed",
              requestId,
              errorCode: err.code,
              errorMessage: err.message,
              details: err.details
            })
          );

          sendJsonError(res, err.statusCode, err.code, err.message, err.details);
          return;
        }

        console.error(
          JSON.stringify({
            level: "error",
            message: "Unexpected compile error",
            requestId,
            error: err instanceof Error ? err.message : String(err)
          })
        );

        sendJsonError(res, 500, "internal_error", "Unexpected compile error");
      }
    }
  );

  return router;
}
