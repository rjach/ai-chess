import { Chess } from "chess.js";
import type { Side } from "@/lib/players";

/**
 * OpenRouter "decisions" models answer typed questions instead of chatting, so a move is asked
 * as one `choice` question whose options are the legal moves. Options are keyed by UCI
 * (e2e4, e7e8q) because decisions providers reject keys containing SAN symbols like + # =.
 */
export const MOVE_QUESTION_KEY = "move";
const TOP_ALTERNATIVES = 1;

const PIECE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export interface DecisionRequestBody {
  model: string;
  state: string;
  questions: Record<string, { type: "choice"; instructions: string; criteria: Record<string, string> }>;
}

function numberedHistory(sanHistory: string[]): string {
  if (sanHistory.length === 0) return "none, this is the starting position";
  const parts: string[] = [];
  for (let index = 0; index < sanHistory.length; index += 2) {
    parts.push(`${index / 2 + 1}. ${sanHistory[index]}${sanHistory[index + 1] ? ` ${sanHistory[index + 1]}` : ""}`);
  }
  return parts.join(" ");
}

function describeMove(move: { san: string; piece: string; from: string; to: string; captured?: string; promotion?: string }): string {
  const capture = move.captured ? `, capturing a ${PIECE_NAMES[move.captured]}` : "";
  const promotion = move.promotion ? `, promoting to a ${PIECE_NAMES[move.promotion]}` : "";
  return `${move.san}: ${PIECE_NAMES[move.piece]} ${move.from} to ${move.to}${capture}${promotion}`;
}

export function buildDecisionRequest(model: string, fen: string, sanHistory: string[]): DecisionRequestBody {
  const game = new Chess(fen);
  const side: Side = game.turn() === "w" ? "white" : "black";
  const color = side === "white" ? "White" : "Black";
  const criteria = Object.fromEntries(game.moves({ verbose: true }).map((move) => [move.lan, describeMove(move)]));
  return {
    model,
    state: [`Chess game in progress. ${color} to move.`, `Position (FEN): ${fen}`, `Moves so far: ${numberedHistory(sanHistory)}`].join("\n"),
    questions: {
      [MOVE_QUESTION_KEY]: {
        type: "choice",
        instructions: `You are ${color}. Choose the strongest move. Look for checks, captures and threats, keep your king safe, and do not hang pieces.`,
        criteria,
      },
    },
  };
}

interface ChoiceAnswer {
  type?: string;
  choice?: unknown;
  probabilities?: Record<string, number>;
}

export type DecisionReading = { ok: true; uci: string; comment: string } | { ok: false; reason: string };

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Reads the move from a decisions response. A refusal, a missing answer, a wrong answer type or a
 * key outside the legal set all count as "not answered", as OpenRouter's docs require.
 * Decisions models emit no prose, so the comment reports how sure the model was instead.
 */
export function readDecisionAnswer(body: unknown, fen: string): DecisionReading {
  const answers = (body as { answers?: Record<string, ChoiceAnswer> } | null)?.answers;
  const answer = answers?.[MOVE_QUESTION_KEY];
  if (!answer) return { ok: false, reason: "the decisions model returned no answer" };
  if (answer.type === "refusal") return { ok: false, reason: "the decisions model refused to choose a move" };
  if (answer.type !== "choice" || typeof answer.choice !== "string") return { ok: false, reason: `unexpected answer type "${String(answer.type)}"` };

  const legal = new Map(new Chess(fen).moves({ verbose: true }).map((move) => [move.lan, move.san]));
  const san = legal.get(answer.choice);
  if (!san) return { ok: false, reason: `"${answer.choice.slice(0, 20)}" is not one of the legal moves` };

  const probabilities = Object.entries(answer.probabilities ?? {}).sort(([, a], [, b]) => b - a);
  const chosen = answer.probabilities?.[answer.choice];
  const alternatives = probabilities
    .filter(([key]) => key !== answer.choice && legal.has(key))
    .slice(0, TOP_ALTERNATIVES)
    .map(([key, value]) => `${legal.get(key)} ${percent(value)}`);
  const comment =
    chosen === undefined ? `Chose ${san}.` : `Chose ${san} with ${percent(chosen)} probability${alternatives.length ? `, next best ${alternatives.join(", ")}` : ""}.`;
  return { ok: true, uci: answer.choice, comment };
}
