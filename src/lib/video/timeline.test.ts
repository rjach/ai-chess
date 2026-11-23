import { describe, expect, it } from "vitest";
import { buildTimeline, frameAt, INTRO_SECONDS, MAX_THINK_SECONDS, MIN_THINK_SECONDS, MOVE_ANIMATION_SECONDS, OUTRO_SECONDS } from "./timeline";

const moves = [
  { side: "white" as const, durationMs: 4000 },
  { side: "black" as const, durationMs: 8000 },
];

describe("buildTimeline", () => {
  it("divides real think time by the speed", () => {
    const timeline = buildTimeline(moves, 4);
    expect(timeline.thinkSeconds).toEqual([1, 2]);
    expect(timeline.totalSeconds).toBeCloseTo(INTRO_SECONDS + 1 + 2 + 2 * MOVE_ANIMATION_SECONDS + OUTRO_SECONDS);
  });

  it("clamps very fast and very slow replies", () => {
    const timeline = buildTimeline([{ side: "white", durationMs: 100 }, { side: "black", durationMs: 600_000 }], 2);
    expect(timeline.thinkSeconds).toEqual([MIN_THINK_SECONDS, MAX_THINK_SECONDS]);
  });

  it("is shorter at a higher speed", () => {
    expect(buildTimeline(moves, 8).totalSeconds).toBeLessThan(buildTimeline(moves, 2).totalSeconds);
  });
});

describe("frameAt", () => {
  const timeline = buildTimeline(moves, 4);

  it("starts with the intro on an empty board", () => {
    expect(frameAt(timeline, 0)).toMatchObject({ phase: "intro", appliedPlies: 0, clocksMs: { white: 0, black: 0 } });
  });

  it("runs White's clock halfway through White's thinking", () => {
    expect(frameAt(timeline, INTRO_SECONDS + 0.5)).toMatchObject({ phase: "think", activePly: 0, appliedPlies: 0, clocksMs: { white: 2000, black: 0 } });
  });

  it("animates the move after the thinking time", () => {
    const frame = frameAt(timeline, INTRO_SECONDS + 1 + MOVE_ANIMATION_SECONDS / 2);
    expect(frame.phase).toBe("animate");
    expect(frame.animationProgress).toBeCloseTo(0.5);
    expect(frame.clocksMs).toEqual({ white: 4000, black: 0 });
  });

  it("shows Black thinking with White's move applied", () => {
    const frame = frameAt(timeline, INTRO_SECONDS + 1 + MOVE_ANIMATION_SECONDS + 1);
    expect(frame).toMatchObject({ phase: "think", activePly: 1, appliedPlies: 1, clocksMs: { white: 4000, black: 4000 } });
  });

  it("ends on the outro with every move applied and full clocks", () => {
    expect(frameAt(timeline, timeline.totalSeconds - 0.1)).toMatchObject({ phase: "outro", appliedPlies: 2, clocksMs: { white: 4000, black: 8000 } });
  });
});
