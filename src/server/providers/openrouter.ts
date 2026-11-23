import "server-only";
import { buildDecisionRequest, readDecisionAnswer } from "@/lib/chess/decisions";
import { isDecisionsModel } from "../openRouterCatalog";
import { ProviderError, type GenerateRequest, type MoveGenerator } from "./types";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const OPENROUTER_TIMEOUT_MS = 180_000;
const APP_TITLE = "AI Chess Arena";
/** OpenRouter's 400 for a decisions model sent to chat/completions; matched so an uncatalogued id still works. */
const DECISIONS_ONLY_ERROR = /is a decisions model/i;

interface ChatCompletion {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

async function postJson(url: string, apiKey: string, body: unknown, signal: AbortSignal): Promise<{ status: number; ok: boolean; body: unknown }> {
  const timeout = AbortSignal.timeout(OPENROUTER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.any([signal, timeout]),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": APP_TITLE },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (timeout.aborted) throw new ProviderError(`OpenRouter did not answer within ${OPENROUTER_TIMEOUT_MS / 1000}s`, true);
    throw new ProviderError(`Could not reach OpenRouter: ${(error as Error).message}`, true);
  }
  return { status: response.status, ok: response.ok, body: await response.json().catch(() => ({})) };
}

function errorFrom(status: number, body: unknown, fallback: string): ProviderError {
  const detail = (body as ChatCompletion).error?.message ?? fallback;
  return new ProviderError(`OpenRouter ${status}: ${detail}`, status === 429 || status >= 500);
}

async function chatMove(request: GenerateRequest, apiKey: string): Promise<string> {
  const { status, ok, body } = await postJson(
    OPENROUTER_CHAT_URL,
    apiKey,
    {
      model: request.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      temperature: 0.3,
    },
    request.signal,
  );
  if (!ok) throw errorFrom(status, body, "request failed");
  const content = (body as ChatCompletion).choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("OpenRouter returned an empty message", true);
  return content;
}

/**
 * Decisions models answer a typed question instead of chatting. The move comes back as a UCI key,
 * which is returned in the same JSON shape chat models use, so the engine's legality check applies unchanged.
 */
async function decisionsMove(request: GenerateRequest, apiKey: string): Promise<string> {
  const { fen, sanHistory } = request.position;
  const { status, ok, body } = await postJson(OPENROUTER_DECISIONS_URL, apiKey, buildDecisionRequest(request.model, fen, sanHistory), request.signal);
  if (!ok) throw errorFrom(status, body, "decisions request failed");
  const reading = readDecisionAnswer(body, fen);
  if (!reading.ok) throw new ProviderError(`OpenRouter decisions: ${reading.reason}`, true);
  return JSON.stringify({ move: reading.uci, comment: reading.comment });
}

export const openRouterGenerator: MoveGenerator = {
  async generate(request: GenerateRequest) {
    const apiKey = request.openRouterKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new ProviderError("Add your OpenRouter API key in Settings to use OpenRouter models", false);
    if (await isDecisionsModel(request.model)) return decisionsMove(request, apiKey);
    try {
      return await chatMove(request, apiKey);
    } catch (error) {
      if (error instanceof ProviderError && DECISIONS_ONLY_ERROR.test(error.message)) return decisionsMove(request, apiKey);
      throw error;
    }
  },
};
