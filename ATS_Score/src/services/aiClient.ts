import Anthropic from "@anthropic-ai/sdk";
import { getEnvConfig } from "../config/env.js";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) {
    return client;
  }

  const { anthropicApiKey } = getEnvConfig();
  client = new Anthropic({ apiKey: anthropicApiKey });
  return client;
}

export function getAnthropicModel(): string {
  return getEnvConfig().anthropicModel;
}
