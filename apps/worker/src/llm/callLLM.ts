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
  const body = {
    model: req.model ?? DEFAULT_MODEL,
    messages,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(req.responseFormat === "json" ? { response_format: { type: "json_object" as const } } : {}),
  };

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
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM response missing content");
  }

  return { raw: content.trim() };
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
