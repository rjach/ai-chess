import "server-only";
import type { ModelOption } from "@/lib/players";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
/** The default listing hides decisions models; they only appear when asked for by output modality. */
const DECISIONS_MODELS_URL = `${MODELS_URL}?output_modalities=decisions`;
const CACHE_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const PRICE_PER_MILLION = 1_000_000;

interface OpenRouterModel {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
}

export interface OpenRouterCatalog {
  models: ModelOption[];
  decisionsIds: Set<string>;
}

let cache: { at: number; catalog: OpenRouterCatalog } | null = null;

function priceHint(model: OpenRouterModel, decisions: boolean): string | undefined {
  const prompt = Number(model.pricing?.prompt);
  const completion = Number(model.pricing?.completion);
  const label = decisions ? "Decisions" : undefined;
  if (!Number.isFinite(prompt) || prompt < 0) return label;
  if (prompt === 0 && (!completion || completion === 0)) return [label, "Free"].filter(Boolean).join(" · ");
  const price = decisions
    ? `$${(prompt * PRICE_PER_MILLION).toFixed(2)} per 1M in`
    : `$${(prompt * PRICE_PER_MILLION).toFixed(2)} / $${(completion * PRICE_PER_MILLION).toFixed(2)} per 1M`;
  return [label, price].filter(Boolean).join(" · ");
}

async function fetchModels(url: string): Promise<OpenRouterModel[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`OpenRouter responded ${response.status}`);
  return ((await response.json()) as { data: OpenRouterModel[] }).data;
}

/** Chat and decisions models in one list, cached for ten minutes because the catalogue changes rarely. */
export async function getOpenRouterCatalog(): Promise<OpenRouterCatalog> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.catalog;
  const [chat, decisions] = await Promise.all([fetchModels(MODELS_URL), fetchModels(DECISIONS_MODELS_URL)]);
  const decisionsIds = new Set(decisions.map((model) => model.id));
  const toOption = (model: OpenRouterModel) => {
    const isDecisions = decisionsIds.has(model.id);
    return { id: model.id, label: model.name ?? model.id, hint: priceHint(model, isDecisions) };
  };
  const catalog = { models: [...chat.filter((model) => !decisionsIds.has(model.id)), ...decisions].map(toOption), decisionsIds };
  cache = { at: Date.now(), catalog };
  return catalog;
}

/** False when the catalogue cannot be fetched; the chat endpoint's own rejection then routes the move instead. */
export async function isDecisionsModel(id: string): Promise<boolean> {
  try {
    return (await getOpenRouterCatalog()).decisionsIds.has(id);
  } catch {
    return false;
  }
}
