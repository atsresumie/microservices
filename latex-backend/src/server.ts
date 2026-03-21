import express from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { getEnvConfig } from "./config/env.js";
import { compileRoutes } from "./routes/compile.js";

const env = getEnvConfig();
const app = express();

app.use(
	express.text({
		limit: env.requestBodyLimitBytes,
		type: ["application/text", "text/plain", "text/*"],
	}),
);

app.use((req: Request, res: Response, next: NextFunction) => {
	const incoming = req.header("x-request-id");
	const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
	res.locals.requestId = requestId;
	res.setHeader("x-request-id", requestId);
	next();
});

app.get("/health", (_req: Request, res: Response) => {
	res.json({
		status: "ok",
		uptimeSeconds: Math.round(process.uptime()),
	});
});

app.use(compileRoutes(env));

function verifyCompilerDependency(): void {
	const probe = spawnSync("latexmk", ["-v"], { stdio: "ignore" });
	if (probe.error || probe.status !== 0) {
		throw new Error(
			"latexmk is not available on PATH. Install TeX Live/MacTeX locally or run this service via Docker.",
		);
	}
}

async function startServer(): Promise<void> {
	verifyCompilerDependency();
	await mkdir(env.tempRootDir, { recursive: true });
	await new Promise<void>((resolve, reject) => {
		const server = app.listen(env.port, env.host, () => resolve());
		server.on("error", reject);
	});
}

startServer().catch((err) => {
	console.error(
		JSON.stringify({
			level: "error",
			message: "Failed to start server",
			error: err instanceof Error ? err.message : String(err),
		}),
	);

	process.exit(1);
});
