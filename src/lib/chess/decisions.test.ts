import { describe, expect, it } from "vitest";
import { buildDecisionRequest, readDecisionAnswer } from "./decisions";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMOTION = "8/P7/8/8/8/8/k7/7K w - - 0 1";

describe("buildDecisionRequest", () => {
  it("asks one choice question keyed by UCI over every legal move", () => {
    const body = buildDecisionRequest("openai/gpt-6-luna-decisions", START, []);
    const question = body.questions.move;
    expect(body.model).toBe("openai/gpt-6-luna-decisions");
    expect(question.type).toBe("choice");
    expect(Object.keys(question.criteria)).toHaveLength(20);
    expect(question.criteria.e2e4).toBe("e4: pawn e2 to e4");
    expect(question.criteria.g1f3).toBe("Nf3: knight g1 to f3");
    expect(body.state).toContain("White to move");
  });

  it("uses only keys that decisions providers accept", () => {
    const keys = Object.keys(buildDecisionRequest("m", PROMOTION, []).questions.move.criteria);
    expect(keys).toContain("a7a8q");
    expect(keys.every((key) => /^[A-Za-z0-9_-]{1,64}$/.test(key))).toBe(true);
  });

  it("numbers the move history for context", () => {
    const after = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(buildDecisionRequest("m", after, ["e4", "e5"]).state).toContain("Moves so far: 1. e4 e5");
  });
});

describe("readDecisionAnswer", () => {
  it("returns the chosen move with its probability and the runner-up", () => {
    const body = { answers: { move: { type: "choice", choice: "e2e4", probabilities: { e2e4: 0.62, d2d4: 0.21, g1f3: 0.1 } } } };
    expect(readDecisionAnswer(body, START)).toEqual({ ok: true, uci: "e2e4", comment: "Chose e4 with 62% probability, next best d4 21%." });
  });

  it("works without probabilities", () => {
    expect(readDecisionAnswer({ answers: { move: { type: "choice", choice: "g1f3" } } }, START)).toEqual({ ok: true, uci: "g1f3", comment: "Chose Nf3." });
  });

  it("treats a refusal as not answered", () => {
    expect(readDecisionAnswer({ answers: { move: { type: "refusal" } } }, START)).toEqual({ ok: false, reason: "the decisions model refused to choose a move" });
  });

  it("rejects a key outside the legal moves", () => {
    expect(readDecisionAnswer({ answers: { move: { type: "choice", choice: "e2e5" } } }, START)).toEqual({ ok: false, reason: '"e2e5" is not one of the legal moves' });
  });

  it("rejects a missing answer and a wrong type", () => {
    expect(readDecisionAnswer({ answers: {} }, START)).toMatchObject({ ok: false });
    expect(readDecisionAnswer({ answers: { move: { type: "noul", noul: 0.4 } } }, START)).toEqual({ ok: false, reason: 'unexpected answer type "noul"' });
  });
});
