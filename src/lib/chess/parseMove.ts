import { Chess } from "chess.js";

export interface ParsedMove {
  san: string;
  from: string;
  to: string;
  comment: string;
}

export type ParseResult =
  | { ok: true; move: ParsedMove }
  | { ok: false; reason: string };

const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i;
const MAX_COMMENT_LENGTH = 220;
const MAX_BARE_TOKENS = 12;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizeSan(raw: string): string {
  return raw
    .trim()
    .replace(/^\d+\.(\.\.)?\s*/, "")
    .replace(/[!?]+$/, "")
    .replace(/0-0-0/g, "O-O-O")
    .replace(/0-0/g, "O-O")
    .replace(/[+#]$/, "");
}

function tryMove(fen: string, candidate: string): ParsedMove | null {
  const game = new Chess(fen);
  const uci = UCI_PATTERN.exec(candidate);
  try {
    const move = uci
      ? game.move({ from: uci[1].toLowerCase(), to: uci[2].toLowerCase(), promotion: uci[3]?.toLowerCase() })
      : game.move(candidate, { strict: false });
    return { san: move.san, from: move.from, to: move.to, comment: "" };
  } catch {
    return null;
  }
}

/**
 * Turns a model's free-form reply into a legal move for the given position.
 * Accepts the requested JSON shape first, then falls back to a bare SAN or UCI token,
 * because smaller models often wrap or drop the JSON.
 *
 * @param text - Raw model output
 * @param fen - Position the move must be legal in
 * @returns The legal move with the model's comment, or the reason it was rejected
 */
export function parseMoveReply(text: string, fen: string): ParseResult {
  const json = extractJsonObject(text);
  const comment = typeof json?.comment === "string" ? json.comment.trim().slice(0, MAX_COMMENT_LENGTH) : "";
  const candidates =
    typeof json?.move === "string" ? [json.move] : text.trim().split(/\s+/).slice(0, MAX_BARE_TOKENS).filter(Boolean);

  if (candidates.length === 0) return { ok: false, reason: "the reply contained no move" };

  for (const candidate of candidates) {
    const move = tryMove(fen, normalizeSan(candidate)) ?? tryMove(fen, candidate.trim());
    if (move) return { ok: true, move: { ...move, comment } };
  }
  return { ok: false, reason: `"${candidates[0].slice(0, 40)}" is not a legal move in this position` };
}
