import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { isLlmConfigured, QUERY_MODEL } from "@/lib/llm/client";
import { QUERY_TOOLS } from "@/lib/llm/query-tools";

export interface ToolCallLog {
  tool: string;
  args: unknown;
  resultSummary: string;
}

export interface QueryResult {
  answer: string;
  toolCalls: ToolCallLog[];
  mode: "llm" | "mock";
}

const MAX_TOOL_ROUNDS = 5;

function summarizeResult(result: unknown): string {
  const json = JSON.stringify(result);
  return json.length > 300 ? `${json.slice(0, 300)}…` : json;
}

const SYSTEM_PROMPT = `You are a restaurant spend analyst assistant. Staff ask you questions about their
restaurant's spend in plain English. You can only see data by calling the tools provided — you have no
other knowledge of this restaurant's finances, and you must never guess or fabricate numbers.

Always call at least one tool before answering a data question. Cite concrete figures from tool results
in your answer. If a question is ambiguous about a time period, default to the trailing 90 days and say
so. Keep answers concise: a short direct answer, then supporting numbers.`;

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

async function runLlmQuery(workspaceId: string, question: string): Promise<QueryResult> {
  const tools: Anthropic.Tool[] = QUERY_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.jsonSchema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const toolCalls: ToolCallLog[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().messages.create({
      model: QUERY_MODEL,
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return { answer: textBlock?.text ?? "I couldn't determine an answer.", toolCalls, mode: "llm" };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const tool = QUERY_TOOLS.find((t) => t.name === block.name);
      let result: unknown;
      try {
        result = tool ? await tool.execute(workspaceId, block.input) : { error: `Unknown tool: ${block.name}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }
      toolCalls.push({ tool: block.name, args: block.input, resultSummary: summarizeResult(result) });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    answer: "I gathered some data but couldn't finish reasoning about it in time — try narrowing your question.",
    toolCalls,
    mode: "llm",
  };
}

/** Deterministic fallback when no ANTHROPIC_API_KEY is configured: runs a small
 * fixed set of tools and returns a templated summary so the console stays usable. */
async function runMockQuery(workspaceId: string, question: string): Promise<QueryResult> {
  const categoryTool = QUERY_TOOLS.find((t) => t.name === "get_spend_by_category")!;
  const vendorTool = QUERY_TOOLS.find((t) => t.name === "get_spend_by_vendor")!;

  const [categories, vendors] = await Promise.all([
    categoryTool.execute(workspaceId, {}) as Promise<{ category: string; total: number }[]>,
    vendorTool.execute(workspaceId, {}) as Promise<{ vendor: string; total: number }[]>,
  ]);

  const toolCalls: ToolCallLog[] = [
    { tool: "get_spend_by_category", args: {}, resultSummary: summarizeResult(categories) },
    { tool: "get_spend_by_vendor", args: {}, resultSummary: summarizeResult(vendors) },
  ];

  const topCategory = categories[0];
  const topVendor = vendors[0];
  const answer =
    `ANTHROPIC_API_KEY isn't set, so I can't parse "${question}" as natural language — here's a general ` +
    `spend summary for the trailing 90 days instead. Top category: ${topCategory ? `${topCategory.category} (${topCategory.total.toFixed(2)})` : "none"}. ` +
    `Top vendor: ${topVendor ? `${topVendor.vendor} (${topVendor.total.toFixed(2)})` : "none"}. ` +
    `Set ANTHROPIC_API_KEY to enable real natural-language answers.`;

  return { answer, toolCalls, mode: "mock" };
}

export async function answerQuery(workspaceId: string, question: string): Promise<QueryResult> {
  return isLlmConfigured() ? runLlmQuery(workspaceId, question) : runMockQuery(workspaceId, question);
}
