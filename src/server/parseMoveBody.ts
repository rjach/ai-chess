import "server-only";
import { validateFen } from "chess.js";
import { EFFORT_LEVELS, MODEL_ID_PATTERN, PROVIDER_IDS, type Effort, type PlayerConfig, type ProviderId } from "@/lib/players";

const MAX_HISTORY_PLIES = 1_000;
const MAX_SAN_LENGTH = 10;
const MAX_KEY_LENGTH = 300;

export interface MoveBody {
  player: PlayerConfig;
  fen: string;
  sanHistory: string[];
  openRouterKey?: string;
}

export type BodyResult = { ok: true; body: MoveBody } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validates the untrusted /api/move body before any of it reaches a CLI argv or an outbound request. */
export function parseMoveBody(raw: unknown): BodyResult {
  if (!isRecord(raw) || !isRecord(raw.player)) return { ok: false, error: "Body must include a player" };
  const { provider, model, effort } = raw.player;

  if (!PROVIDER_IDS.includes(provider as ProviderId)) return { ok: false, error: `Unknown provider: ${String(provider)}` };
  if (typeof model !== "string" || !MODEL_ID_PATTERN.test(model)) return { ok: false, error: "Model id is missing or has invalid characters" };
  if (!EFFORT_LEVELS.includes(effort as Effort)) return { ok: false, error: `Unknown effort: ${String(effort)}` };
  if (typeof raw.fen !== "string" || !validateFen(raw.fen).ok) return { ok: false, error: "Position (FEN) is invalid" };

  const history = raw.sanHistory;
  if (!Array.isArray(history) || history.length > MAX_HISTORY_PLIES) return { ok: false, error: "sanHistory must be an array of moves" };
  if (!history.every((san) => typeof san === "string" && san.length <= MAX_SAN_LENGTH)) return { ok: false, error: "sanHistory has an invalid move" };

  const key = raw.openRouterKey;
  if (key !== undefined && (typeof key !== "string" || key.length > MAX_KEY_LENGTH)) return { ok: false, error: "OpenRouter key is invalid" };

  return {
    ok: true,
    body: {
      player: { provider: provider as ProviderId, model, effort: effort as Effort },
      fen: raw.fen,
      sanHistory: history as string[],
      openRouterKey: key || undefined,
    },
  };
}
