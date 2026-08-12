import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

let client: Anthropic | null = null;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Forces the model to respond via a single "submit" tool matching the given
 * JSON schema, so the result is always well-formed structured data rather
 * than free text that has to be parsed hopefully. Returns the schema-validated
 * object, or null if the model isn't configured (callers fall back to a mock).
 */
export async function callClaudeForJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  if (!isLlmConfigured()) return null;

  const response = await getClient().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    tools: [{ name: "submit", description: "Submit the result.", input_schema: opts.jsonSchema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "submit" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  return opts.schema.parse(toolUse.input);
}

/** Plain-text completion, for narrative generation (reports, negotiation briefs). */
export async function callClaudeForText(opts: {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  if (!isLlmConfigured()) return null;

  const response = await getClient().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : null;
}

export const OVERSIGHT_MODEL = process.env.OVERSIGHT_MODEL || "claude-opus-5";
export const QUERY_MODEL = process.env.QUERY_MODEL || "claude-sonnet-5";
