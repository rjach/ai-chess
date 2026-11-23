"use client";
import { Chess } from "chess.js";
import { useEffect, type Dispatch } from "react";
import { liveFen, sideToMove, type MatchAction, type MatchState } from "@/lib/match";
import type { ParsedMove } from "@/lib/chess/parseMove";

interface MoveResponse {
  ok: boolean;
  move?: ParsedMove;
  fallback?: boolean;
  attempts?: { reply: string; error: string }[];
  durationMs?: number;
  error?: string;
}

interface RunnerOptions {
  moveDelayMs: number;
  openRouterKey: string;
}

/**
 * Drives the match: whenever it is someone's turn and the game is running, ask the server for
 * that side's move. Pausing, ending or unmounting aborts the request, which kills the CLI process
 * server-side, so a paused game never keeps burning subscription quota.
 */
export function useMatchRunner(state: MatchState, dispatch: Dispatch<MatchAction>, { moveDelayMs, openRouterKey }: RunnerOptions): void {
  const { status, moves, players } = state;
  const plyCount = moves.length;

  useEffect(() => {
    if (status !== "playing") return;
    const controller = new AbortController();
    const side = sideToMove(state);
    const fen = liveFen(state);
    const player = players[side];
    const sanHistory = moves.map((move) => move.san);

    const timer = window.setTimeout(async () => {
      dispatch({ type: "thinking", at: Date.now() });
      try {
        const response = await fetch("/api/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ player, fen, sanHistory, openRouterKey: player.provider === "openrouter" ? openRouterKey : undefined }),
        });
        const body = (await response.json().catch(() => ({ ok: false, error: `Server error ${response.status}` }))) as MoveResponse;
        if (!body.ok || !body.move) {
          dispatch({ type: "fail", error: { side, message: body.error ?? "The model did not return a move" } });
          return;
        }
        const game = new Chess(fen);
        game.move(body.move.san);
        dispatch({
          type: "move",
          record: {
            san: body.move.san,
            from: body.move.from,
            to: body.move.to,
            fenAfter: game.fen(),
            side,
            comment: body.move.comment,
            durationMs: body.durationMs ?? 0,
            fallback: Boolean(body.fallback),
            rejectedReplies: body.attempts?.length ?? 0,
          },
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({ type: "fail", error: { side, message: `Could not reach the local server: ${(error as Error).message}` } });
      }
    }, plyCount === 0 ? 0 : moveDelayMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // The request is keyed by the position (plyCount) and run state only; re-running on every render would restart the CLI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plyCount]);
}
