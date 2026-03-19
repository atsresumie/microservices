import { Router } from "express";
import type { Request, Response } from "express";
import { CompileError, compileLatexToPdf } from "../services/latexCompiler.js";

type CompilePdfRequestBody = {
  latex?: string;
  filename?: string;
};

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

function sendJsonError(res: Response, status: number, error: string, message: string): void {
  res.status(status).json({ error, message });
}

export function compileRoutes(options: RouteOptions): Router {
  const router = Router();

  router.post(
    "/compile/pdf",
    async (req: Request<unknown, unknown, CompilePdfRequestBody>, res: Response) => {
      const latex = req.body?.latex;
      if (typeof latex !== "string" || latex.trim().length === 0) {
        sendJsonError(res, 400, "validation_error", "latex is required");
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

      const filename = sanitizeFilename(req.body.filename);
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
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "LaTeX compilation failed",
              requestId,
              errorCode: err.code,
              errorMessage: err.message
            })
          );

          sendJsonError(res, err.statusCode, err.code, err.message);
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
