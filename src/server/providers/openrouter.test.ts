import { afterEach, describe, expect, it, vi } from "vitest";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

type Handler = (url: string, init?: RequestInit) => { status: number; body: unknown };

function stubFetch(handler: Handler) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

const catalog = (decisions: string[]) => (url: string) =>
  url.includes("output_modalities=decisions")
    ? { status: 200, body: { data: decisions.map((id) => ({ id, name: id, pricing: { prompt: "0.0000001" } })) } }
    : url.includes("/models")
      ? { status: 200, body: { data: [{ id: "openai/gpt-4o-mini", name: "GPT-4o mini" }] } }
      : null;

const request = (model: string) => ({
  system: "s",
  prompt: "p",
  model,
  effort: "default" as const,
  signal: new AbortController().signal,
  openRouterKey: "sk-or-test",
  position: { fen: START, sanHistory: [] },
});

afterEach(() => vi.unstubAllGlobals());

// The model catalogue is cached per module, so each test loads a fresh copy.
async function loadGenerator() {
  vi.resetModules();
  return (await import("./openrouter")).openRouterGenerator;
}

describe("openRouterGenerator", () => {
  it("sends a decisions model to the decisions endpoint and returns its move as JSON", async () => {
    const calls = stubFetch((url) => {
      const listed = catalog(["openai/gpt-6-luna-decisions"])(url);
      if (listed) return listed;
      return { status: 200, body: { answers: { move: { type: "choice", choice: "e2e4", probabilities: { e2e4: 0.7, d2d4: 0.2 } } } } };
    });

    const reply = await (await loadGenerator()).generate(request("openai/gpt-6-luna-decisions"));

    expect(JSON.parse(reply)).toEqual({ move: "e2e4", comment: "Chose e4 with 70% probability, next best d4 20%." });
    const decisionCall = calls.find((call) => call.url === DECISIONS_URL);
    expect(decisionCall?.body).toMatchObject({ model: "openai/gpt-6-luna-decisions", questions: { move: { type: "choice" } } });
    expect(calls.some((call) => call.url === CHAT_URL)).toBe(false);
  });

  it("falls back to the decisions endpoint when chat rejects an uncatalogued decisions model", async () => {
    const calls = stubFetch((url) => {
      const listed = catalog([])(url);
      if (listed) return listed;
      if (url === CHAT_URL) return { status: 400, body: { error: { message: "typesafe/jev-9 is a decisions model and cannot be used with the chat/completions endpoint." } } };
      return { status: 200, body: { answers: { move: { type: "choice", choice: "g1f3" } } } };
    });

    const reply = await (await loadGenerator()).generate(request("typesafe/jev-9"));

    expect(JSON.parse(reply)).toEqual({ move: "g1f3", comment: "Chose Nf3." });
    expect(calls.map((call) => call.url).filter((url) => !url.includes("/models"))).toEqual([CHAT_URL, DECISIONS_URL]);
  });

  it("reports a refusal as a retryable provider error", async () => {
    stubFetch((url) => catalog(["liquid/d1.2"])(url) ?? { status: 200, body: { answers: { move: { type: "refusal" } } } });
    const generator = await loadGenerator();
    await expect(generator.generate(request("liquid/d1.2"))).rejects.toMatchObject({
      message: "OpenRouter decisions: the decisions model refused to choose a move",
      retryable: true,
    });
  });
});
