import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

export type EnvConfig = {
  host: string;
  port: number;
  requestBodyLimitBytes: number;
  maxInputLength: number;
};

const DEFAULTS = {
  HOST: "0.0.0.0",
  PORT: 8081,
  REQUEST_BODY_LIMIT_BYTES: 1024 * 1024,
  MAX_INPUT_LENGTH: 500_000,
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
    port: parsePositiveInt(process.env.ATS_PORT ?? process.env.PORT, DEFAULTS.PORT),
    requestBodyLimitBytes: parsePositiveInt(
      process.env.REQUEST_BODY_LIMIT_BYTES,
      DEFAULTS.REQUEST_BODY_LIMIT_BYTES
    ),
    maxInputLength: parsePositiveInt(process.env.MAX_INPUT_LENGTH, DEFAULTS.MAX_INPUT_LENGTH),
  };
}

