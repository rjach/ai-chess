import { describe, expect, it } from "vitest";
import { parseMoveReply } from "./parseMove";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CASTLE_READY = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
const PROMOTION = "8/P7/8/8/8/8/k7/7K w - - 0 1";

describe("parseMoveReply", () => {
  it("reads the requested JSON shape", () => {
    const result = parseMoveReply('{"move":"e4","comment":"Take the center."}', START);
    expect(result).toEqual({ ok: true, move: { san: "e4", from: "e2", to: "e4", comment: "Take the center." } });
  });

  it("finds JSON wrapped in a markdown fence", () => {
    const result = parseMoveReply('```json\n{"move":"Nf3","comment":"Develop."}\n```', START);
    expect(result).toMatchObject({ ok: true, move: { san: "Nf3", from: "g1", to: "f3" } });
  });

  it("accepts UCI notation", () => {
    expect(parseMoveReply('{"move":"d2d4"}', START)).toMatchObject({ ok: true, move: { san: "d4" } });
  });

  it("accepts castling written with zeros and a check suffix", () => {
    expect(parseMoveReply('{"move":"0-0-0+"}', CASTLE_READY)).toMatchObject({ ok: true, move: { san: "O-O-O" } });
  });

  it("accepts a bare move token without JSON", () => {
    expect(parseMoveReply("1. e4!", START)).toMatchObject({ ok: true, move: { san: "e4" } });
  });

  it("handles promotion in UCI", () => {
    expect(parseMoveReply('{"move":"a7a8q"}', PROMOTION)).toMatchObject({ ok: true, move: { san: "a8=Q+" } });
  });

  it("rejects an illegal move with a reason", () => {
    const result = parseMoveReply('{"move":"e5","comment":"x"}', START);
    expect(result).toEqual({ ok: false, reason: '"e5" is not a legal move in this position' });
  });

  it("rejects an empty reply", () => {
    expect(parseMoveReply("   ", START)).toEqual({ ok: false, reason: "the reply contained no move" });
  });
});
