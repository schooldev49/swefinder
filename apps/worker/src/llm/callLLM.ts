export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMResponse {
  raw: string;
}

export async function callLLM(_req: LLMRequest): Promise<LLMResponse> {
  throw new Error("callLLM not implemented. Configure an LLM provider in apps/worker/src/llm/callLLM.ts");
}
