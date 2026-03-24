import express from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { getEnvConfig } from "./config/env.js";
import { analyzeRoutes } from "./routes/analyze.js";
import { analyzeGeneralRoutes } from "./routes/analyzeGeneral.js";

const env = getEnvConfig();
const app = express();

// ─── Body Parser ─────────────────────────────────────────────────────────────

app.use(
  express.json({
    limit: env.requestBodyLimitBytes,
  })
);

// ─── Request ID Middleware ───────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// ─── Health Endpoint ─────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ats-score",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use(analyzeRoutes(env));
app.use(analyzeGeneralRoutes(env));

// ─── Server Start ────────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.port, env.host, () => resolve());
    server.on("error", reject);
  });

  console.info(
    JSON.stringify({
      level: "info",
      message: `ATS Score service started on ${env.host}:${env.port}`,
    })
  );
}

startServer().catch((err) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Failed to start server",
      error: err instanceof Error ? err.message : String(err),
    })
  );

  process.exit(1);
});
