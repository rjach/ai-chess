import { Chess } from "chess.js";
import { CLAUDE_MODELS, PROVIDERS, otherSide, type PlayerConfig, type Side } from "@/lib/players";

export const START_FEN = new Chess().fen();
/** 300 full moves. Engine-free models can shuffle forever in drawn endgames, so the match needs a ceiling. */
export const MAX_PLIES = 600;

export type MatchStatus = "setup" | "playing" | "paused" | "over";

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  fenAfter: string;
  side: Side;
  comment: string;
  durationMs: number;
  fallback: boolean;
  rejectedReplies: number;
}

export interface GameResult {
  winner: Side | null;
  reason: string;
  /** Ended by the user rather than by the rules; scored as unfinished. */
  stopped?: boolean;
}

export interface MatchError {
  side: Side;
  message: string;
}

export interface MatchState {
  status: MatchStatus;
  players: Record<Side, PlayerConfig>;
  moves: MoveRecord[];
  /** Ply being viewed in the move list; null follows the live position. */
  viewPly: number | null;
  thinkingSince: number | null;
  error: MatchError | null;
  result: GameResult | null;
}

export type MatchAction =
  | { type: "configure"; side: Side; player: PlayerConfig }
  | { type: "swap-players" }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "thinking"; at: number }
  | { type: "move"; record: MoveRecord }
  | { type: "fail"; error: MatchError }
  | { type: "end"; result: GameResult }
  | { type: "view"; ply: number | null }
  | { type: "new-game" };

export const DEFAULT_PLAYERS: Record<Side, PlayerConfig> = {
  white: { provider: "claude", model: CLAUDE_MODELS[0].id, effort: "low" },
  black: { provider: "codex", model: "", effort: "low" },
};

export function initialMatch(players: Record<Side, PlayerConfig> = DEFAULT_PLAYERS): MatchState {
  return { status: "setup", players, moves: [], viewPly: null, thinkingSince: null, error: null, result: null };
}

export function liveFen(state: MatchState): string {
  return state.moves.at(-1)?.fenAfter ?? START_FEN;
}

export function sideToMove(state: MatchState): Side {
  return state.moves.length % 2 === 0 ? "white" : "black";
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "configure":
      return { ...state, players: { ...state.players, [action.side]: action.player } };
    case "swap-players":
      return { ...state, players: { white: state.players.black, black: state.players.white } };
    case "start":
      return { ...initialMatch(state.players), status: "playing" };
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused", thinkingSince: null } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing", error: null } : state;
    case "thinking":
      return { ...state, thinkingSince: action.at };
    case "move": {
      if (state.status !== "playing") return state;
      const moves = [...state.moves, action.record];
      const result =
        detectResult(action.record.fenAfter, moves.length, action.record.side) ??
        (isThreefold(moves) ? { winner: null, reason: "threefold repetition" } : null);
      return { ...state, moves, thinkingSince: null, error: null, result, status: result ? "over" : state.status };
    }
    case "fail":
      return { ...state, status: "paused", thinkingSince: null, error: action.error };
    case "end":
      return { ...state, status: "over", thinkingSince: null, result: action.result };
    case "view":
      return { ...state, viewPly: action.ply === null || action.ply >= state.moves.length ? null : Math.max(0, action.ply) };
    case "new-game":
      return initialMatch(state.players);
  }
}

/**
 * Detects every way a game can end without a clock: mate, stalemate, the three automatic draws,
 * and the match's own ply ceiling.
 */
export function detectResult(fen: string, plyCount: number, lastMover: Side): GameResult | null {
  const game = new Chess(fen);
  if (game.isCheckmate()) return { winner: lastMover, reason: "checkmate" };
  if (game.isStalemate()) return { winner: null, reason: "stalemate" };
  if (game.isInsufficientMaterial()) return { winner: null, reason: "insufficient material" };
  if (game.isDrawByFiftyMoves()) return { winner: null, reason: "50-move rule" };
  if (plyCount >= MAX_PLIES) return { winner: null, reason: `move limit (${MAX_PLIES / 2} moves)` };
  return null;
}

/** Threefold repetition needs the full move history, which a single FEN does not carry. */
export function isThreefold(moves: MoveRecord[]): boolean {
  const game = new Chess();
  for (const move of moves) game.move(move.san);
  return game.isThreefoldRepetition();
}

export function resultScore(result: GameResult | null): string {
  if (!result || result.stopped) return "*";
  if (!result.winner) return "1/2-1/2";
  return result.winner === "white" ? "1-0" : "0-1";
}

export function resultHeadline(result: GameResult): string {
  if (result.stopped) return "Match stopped";
  if (!result.winner) return "Draw";
  return `${result.winner === "white" ? "White" : "Black"} won`;
}

export function playerName(player: PlayerConfig, modelLabel?: string): string {
  return `${PROVIDERS[player.provider].label} · ${modelLabel ?? player.model}`;
}

export function buildPgn(state: MatchState, names: Record<Side, string>): string {
  const game = new Chess();
  for (const move of state.moves) game.move(move.san);
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  game.setHeader("Event", "AI vs AI");
  game.setHeader("Site", "AI Chess Arena");
  game.setHeader("Date", date);
  game.setHeader("White", names.white);
  game.setHeader("Black", names.black);
  game.setHeader("Result", resultScore(state.result));
  if (state.result) game.setHeader("Termination", state.result.reason);
  return game.pgn();
}

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const CAPTURE_ORDER = ["p", "n", "b", "r", "q"] as const;

export interface MaterialSummary {
  /** Pieces this side has captured, as piece letters of the opponent's colour. */
  captured: Record<Side, string[]>;
  /** Positive when White is ahead. */
  balance: number;
}

/**
 * Counts captures from the board alone. Promotions can push a count above its starting value,
 * which is clamped so a promoted queen never shows as a negative capture.
 */
export function materialFromFen(fen: string): MaterialSummary {
  const board = fen.split(" ")[0];
  const counts: Record<Side, Record<string, number>> = { white: {}, black: {} };
  let balance = 0;
  for (const char of board) {
    const lower = char.toLowerCase();
    if (!(lower in PIECE_VALUES)) continue;
    const side: Side = char === lower ? "black" : "white";
    counts[side][lower] = (counts[side][lower] ?? 0) + 1;
    balance += side === "white" ? PIECE_VALUES[lower] : -PIECE_VALUES[lower];
  }
  const capturedBy = (side: Side) => {
    const victim = counts[otherSide(side)];
    return CAPTURE_ORDER.flatMap((piece) => Array(Math.max(0, START_COUNTS[piece] - (victim[piece] ?? 0))).fill(piece) as string[]);
  };
  return { captured: { white: capturedBy("white"), black: capturedBy("black") }, balance };
}

export function totalThinkMs(moves: MoveRecord[], side: Side): number {
  return moves.reduce((sum, move) => (move.side === side ? sum + move.durationMs : sum), 0);
}
