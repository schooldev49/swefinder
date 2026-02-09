import type { Env } from "../env";

type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMRequest {
  systemPrompt?: string;
  userPrompt?: string;
  messages?: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface LLMResponse {
  raw: string;
}

const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 800;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export async function callLLM(env: Env, req: LLMRequest): Promise<LLMResponse> {
  const apiKey = env.OPENAI_TOKEN;
  if (!apiKey) {
    throw new Error("LLM provider token missing. Set OPENAI_TOKEN in wrangler secrets.");
  }

  const messages = buildMessages(req);
  const body: Record<string, unknown> = {
    model: req.model ?? DEFAULT_MODEL,
    messages,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
  };

  if (req.maxTokens ?? DEFAULT_MAX_TOKENS) {
    body.max_completion_tokens = req.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  if (req.responseFormat === "json") {
    body.response_format = { type: "json_object" as const };
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message;
  let content = "";

  if (typeof message?.content === "string") {
    content = message.content;
  } else if (Array.isArray(message?.content)) {
    const segments = message.content
      .map((segment: any) => extractText(segment))
      .filter((segment: string): segment is string => Boolean(segment && segment.trim()));
    content = segments.join("\n");
  }

  if (!content || !content.trim()) {
    throw new Error("LLM response missing content");
  }

  return { raw: content.trim() };
}

function extractText(segment: any): string {
  if (!segment) return "";
  if (typeof segment === "string") return segment;
  if (typeof segment === "object") {
    if (typeof segment.text === "string") return segment.text;
    if (typeof segment.text === "object" && typeof segment.text.value === "string") {
      return segment.text.value;
    }
    if (typeof segment.content === "string") return segment.content;
    if (segment.type === "text" && typeof segment.text === "string") return segment.text;
    if (segment.type === "output_text" && typeof segment.text === "string") return segment.text;
  }
  return "";
}

function buildMessages(req: LLMRequest): LLMMessage[] {
  if (req.messages && req.messages.length > 0) {
    return req.messages;
  }
  const messages: LLMMessage[] = [];
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt });
  }
  if (req.userPrompt) {
    messages.push({ role: "user", content: req.userPrompt });
  }
  if (messages.length === 0) {
    throw new Error("LLMRequest requires at least one message or prompt");
  }
  return messages;
}
