import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { initialMatch, matchReducer, materialFromFen, type MatchState, type MoveRecord } from "./match";

function play(state: MatchState, sans: string[]): MatchState {
  const game = new Chess();
  for (const move of state.moves) game.move(move.san);
  return sans.reduce((current, san) => {
    const side = game.turn() === "w" ? "white" : "black";
    const move = game.move(san);
    const record: MoveRecord = { san: move.san, from: move.from, to: move.to, fenAfter: game.fen(), side, comment: "", durationMs: 1000, fallback: false, rejectedReplies: 0 };
    return matchReducer(current, { type: "move", record });
  }, state);
}

describe("matchReducer", () => {
  it("ends the game on checkmate with the mating side as winner", () => {
    const started = matchReducer(initialMatch(), { type: "start" });
    const mated = play(started, ["f3", "e5", "g4", "Qh4#"]);
    expect(mated.status).toBe("over");
    expect(mated.result).toEqual({ winner: "black", reason: "checkmate" });
  });

  it("declares threefold repetition a draw", () => {
    const started = matchReducer(initialMatch(), { type: "start" });
    const repeated = play(started, ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
    expect(repeated.result).toEqual({ winner: null, reason: "threefold repetition" });
  });

  it("ignores moves that arrive while paused", () => {
    const paused = matchReducer(matchReducer(initialMatch(), { type: "start" }), { type: "pause" });
    expect(play(paused, ["e4"]).moves).toHaveLength(0);
  });

  it("swaps the configured players", () => {
    const swapped = matchReducer(initialMatch(), { type: "swap-players" });
    expect(swapped.players.white.provider).toBe("codex");
    expect(swapped.players.black.provider).toBe("claude");
  });
});

describe("materialFromFen", () => {
  it("lists captures and the material balance", () => {
    const afterTrade = "rnb1kbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3";
    expect(materialFromFen(afterTrade)).toEqual({ captured: { white: ["q"], black: ["q"] }, balance: 0 });
  });

  it("shows a knight up for white", () => {
    const fen = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(materialFromFen(fen)).toEqual({ captured: { white: ["n"], black: [] }, balance: 3 });
  });
});
