import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

export type EnvConfig = {
  host: string;
  port: number;
  requestBodyLimitBytes: number;
  latexMaxLength: number;
  compileTimeoutMs: number;
  tempRootDir: string;
};

const DEFAULTS = {
  HOST: "0.0.0.0",
  PORT: 8080,
  REQUEST_BODY_LIMIT_BYTES: 1024 * 1024,
  LATEX_MAX_LENGTH: 500_000,
  COMPILE_TIMEOUT_MS: 30_000,
  TEMP_ROOT_DIR: "/tmp/latex-work"
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getEnvConfig(): EnvConfig {
  return {
    host: process.env.HOST ?? DEFAULTS.HOST,
    port: parsePositiveInt(process.env.LATEX_PORT ?? process.env.PORT, DEFAULTS.PORT),
    requestBodyLimitBytes: parsePositiveInt(
      process.env.REQUEST_BODY_LIMIT_BYTES,
      DEFAULTS.REQUEST_BODY_LIMIT_BYTES
    ),
    latexMaxLength: parsePositiveInt(process.env.LATEX_MAX_LENGTH, DEFAULTS.LATEX_MAX_LENGTH),
    compileTimeoutMs: parsePositiveInt(process.env.COMPILE_TIMEOUT_MS, DEFAULTS.COMPILE_TIMEOUT_MS),
    tempRootDir: process.env.TEMP_ROOT_DIR ?? DEFAULTS.TEMP_ROOT_DIR
  };
}

