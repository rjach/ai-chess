import type { MoveRecord } from "@/lib/match";
import type { Side } from "@/lib/players";

export const VIDEO_SPEEDS = [2, 4, 8] as const;
export type VideoSpeed = (typeof VIDEO_SPEEDS)[number];

export const INTRO_SECONDS = 2;
export const OUTRO_SECONDS = 4;
export const MOVE_ANIMATION_SECONDS = 0.3;
/** Fast replies still get a beat on screen so the viewer can follow the board. */
export const MIN_THINK_SECONDS = 0.25;
/** One stalled request (a 90s server hiccup) should not turn the video into a still image. */
export const MAX_THINK_SECONDS = 12;

export interface TimelineMove {
  side: Side;
  durationMs: number;
}

export interface Timeline {
  speed: VideoSpeed;
  thinkSeconds: number[];
  /** Start time of each ply's thinking phase; its animation follows immediately after. */
  plyStarts: number[];
  playEnd: number;
  totalSeconds: number;
  durations: TimelineMove[];
}

export type FramePhase = "intro" | "think" | "animate" | "outro";

export interface FrameState {
  phase: FramePhase;
  /** Number of moves fully applied to the board. */
  appliedPlies: number;
  /** Ply being thought about or animated, when in those phases. */
  activePly: number | null;
  /** 0 to 1 through the current move animation. */
  animationProgress: number;
  /** Cumulative real thinking time per side as of this frame, matching the in-app clocks. */
  clocksMs: Record<Side, number>;
  /** Seconds since the current phase began. */
  phaseElapsed: number;
  /** 0 to 1 through the whole video. */
  progress: number;
}

export function buildTimeline(moves: Pick<MoveRecord, "side" | "durationMs">[], speed: VideoSpeed): Timeline {
  const thinkSeconds = moves.map((move) => Math.min(MAX_THINK_SECONDS, Math.max(MIN_THINK_SECONDS, move.durationMs / 1000 / speed)));
  const plyStarts: number[] = [];
  let cursor = INTRO_SECONDS;
  for (const seconds of thinkSeconds) {
    plyStarts.push(cursor);
    cursor += seconds + MOVE_ANIMATION_SECONDS;
  }
  return {
    speed,
    thinkSeconds,
    plyStarts,
    playEnd: cursor,
    totalSeconds: cursor + OUTRO_SECONDS,
    durations: moves.map((move) => ({ side: move.side, durationMs: move.durationMs })),
  };
}

function clocksBefore(timeline: Timeline, ply: number): Record<Side, number> {
  const clocks: Record<Side, number> = { white: 0, black: 0 };
  for (let index = 0; index < ply; index++) clocks[timeline.durations[index].side] += timeline.durations[index].durationMs;
  return clocks;
}

function findPly(plyStarts: number[], time: number): number {
  let low = 0;
  let high = plyStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (plyStarts[mid] <= time) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function frameAt(timeline: Timeline, time: number): FrameState {
  const plyCount = timeline.plyStarts.length;
  const progress = Math.min(1, Math.max(0, time / timeline.totalSeconds));

  if (time < INTRO_SECONDS || plyCount === 0) {
    const outro = plyCount === 0 && time >= INTRO_SECONDS;
    const phaseElapsed = outro ? time - INTRO_SECONDS : time;
    return { phase: outro ? "outro" : "intro", appliedPlies: 0, activePly: null, animationProgress: 0, clocksMs: { white: 0, black: 0 }, phaseElapsed, progress };
  }
  if (time >= timeline.playEnd) {
    const clocksMs = clocksBefore(timeline, plyCount);
    return { phase: "outro", appliedPlies: plyCount, activePly: null, animationProgress: 0, clocksMs, phaseElapsed: time - timeline.playEnd, progress };
  }

  const ply = findPly(timeline.plyStarts, time);
  const elapsed = time - timeline.plyStarts[ply];
  const think = timeline.thinkSeconds[ply];
  const clocksMs = clocksBefore(timeline, ply);
  const mover = timeline.durations[ply].side;

  if (elapsed < think) {
    clocksMs[mover] += timeline.durations[ply].durationMs * (elapsed / think);
    return { phase: "think", appliedPlies: ply, activePly: ply, animationProgress: 0, clocksMs, phaseElapsed: elapsed, progress };
  }
  clocksMs[mover] += timeline.durations[ply].durationMs;
  const animationProgress = Math.min(1, (elapsed - think) / MOVE_ANIMATION_SECONDS);
  return { phase: "animate", appliedPlies: ply, activePly: ply, animationProgress, clocksMs, phaseElapsed: elapsed - think, progress };
}
