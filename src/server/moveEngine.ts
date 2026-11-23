import "server-only";
import { Chess } from "chess.js";
import { parseMoveReply, type ParsedMove } from "@/lib/chess/parseMove";
import { buildMovePrompt, MOVE_SYSTEM_PROMPT } from "@/lib/chess/prompt";
import type { PlayerConfig, ProviderId } from "@/lib/players";
import { claudeGenerator } from "./providers/claude";
import { codexGenerator } from "./providers/codex";
import { openRouterGenerator } from "./providers/openrouter";
import { ProviderError, type MoveGenerator } from "./providers/types";

const MAX_ATTEMPTS = 3;
const MAX_LOGGED_REPLY_CHARS = 300;

const GENERATORS: Record<ProviderId, MoveGenerator> = {
  claude: claudeGenerator,
  codex: codexGenerator,
  openrouter: openRouterGenerator,
};

export interface MoveAttempt {
  reply: string;
  error: string;
}

export type MoveOutcome =
  | { ok: true; move: ParsedMove; fallback: boolean; attempts: MoveAttempt[]; durationMs: number }
  | { ok: false; error: string; attempts: MoveAttempt[]; durationMs: number };

export interface MoveRequest {
  player: PlayerConfig;
  fen: string;
  sanHistory: string[];
  openRouterKey?: string;
  signal: AbortSignal;
}

/**
 * Asks the player's model for a move and guarantees the answer is legal.
 * Illegal replies are sent back to the model with the reason; after MAX_ATTEMPTS the game
 * continues with a random legal move marked as a fallback, so one confused model cannot stall a match.
 * Provider failures (auth, quota, missing CLI) are returned as errors instead, because a random
 * move would hide a setup problem the user has to fix.
 */
export async function requestMove({ player, fen, sanHistory, openRouterKey, signal }: MoveRequest): Promise<MoveOutcome> {
  const startedAt = Date.now();
  const game = new Chess(fen);
  const side = game.turn() === "w" ? "white" : "black";
  const legalMoves = game.moves();
  const generator = GENERATORS[player.provider];
  const attempts: MoveAttempt[] = [];
  let lastProviderError: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt = buildMovePrompt({ fen, side, sanHistory, legalMoves, previousError: attempts.at(-1)?.error });
    let reply: string;
    try {
      reply = await generator.generate({
        system: MOVE_SYSTEM_PROMPT,
        prompt,
        model: player.model,
        effort: player.effort,
        signal,
        openRouterKey,
        position: { fen, sanHistory },
      });
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      lastProviderError = error.message;
      attempts.push({ reply: "", error: error.message });
      if (!error.retryable || signal.aborted) break;
      continue;
    }

    lastProviderError = null;
    const parsed = parseMoveReply(reply, fen);
    if (parsed.ok) return { ok: true, move: parsed.move, fallback: false, attempts, durationMs: Date.now() - startedAt };
    attempts.push({ reply: reply.slice(0, MAX_LOGGED_REPLY_CHARS), error: parsed.reason });
  }

  if (lastProviderError) return { ok: false, error: lastProviderError, attempts, durationMs: Date.now() - startedAt };
  return { ok: true, move: randomLegalMove(game), fallback: true, attempts, durationMs: Date.now() - startedAt };
}

function randomLegalMove(game: Chess): ParsedMove {
  const moves = game.moves({ verbose: true });
  const pick = moves[Math.floor(Math.random() * moves.length)];
  return { san: pick.san, from: pick.from, to: pick.to, comment: "" };
}
