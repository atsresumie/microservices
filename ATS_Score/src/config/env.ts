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
  anthropicApiKey: string;
  anthropicModel: string;
};

const DEFAULTS = {
  HOST: "0.0.0.0",
  PORT: 8081,
  REQUEST_BODY_LIMIT_BYTES: 1024 * 1024,
  MAX_INPUT_LENGTH: 500_000,
  ANTHROPIC_MODEL: "claude-haiku-4-5",
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
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required but not set in the environment");
  }

  return {
    host: process.env.HOST ?? DEFAULTS.HOST,
    port: parsePositiveInt(process.env.ATS_PORT ?? process.env.PORT, DEFAULTS.PORT),
    requestBodyLimitBytes: parsePositiveInt(
      process.env.REQUEST_BODY_LIMIT_BYTES,
      DEFAULTS.REQUEST_BODY_LIMIT_BYTES
    ),
    maxInputLength: parsePositiveInt(process.env.MAX_INPUT_LENGTH, DEFAULTS.MAX_INPUT_LENGTH),
    anthropicApiKey,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? DEFAULTS.ANTHROPIC_MODEL,
  };
}

