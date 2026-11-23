"use client";
import { Chess } from "chess.js";
import { motion } from "motion/react";
import { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { Chessboard, defaultPieces } from "react-chessboard";
import type { MoveRecord } from "@/lib/match";
import type { Side } from "@/lib/players";

const PIECE_SHADOW: CSSProperties = { filter: "drop-shadow(0 3px 2px rgb(0 0 0 / 0.38))" };
const MOVE_ANIMATION_MS = 320;

/** The default piece set with a soft cast shadow, so pieces read as standing on the board. */
const SHADOWED_PIECES = Object.fromEntries(
  Object.entries(defaultPieces).map(([key, render]) => [
    key,
    (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) => render({ ...props, svgStyle: { ...props?.svgStyle, ...PIECE_SHADOW } }),
  ]),
);

const NOTATION: CSSProperties = { fontFamily: "var(--font-code)", fontSize: "clamp(8px, 1.4vmin, 12px)", fontWeight: 700, position: "absolute", userSelect: "none", zIndex: 2 };

function checkedKingSquare(fen: string): string | null {
  const game = new Chess(fen);
  if (!game.inCheck()) return null;
  const kingColor = game.turn();
  for (const row of game.board()) {
    for (const cell of row) if (cell?.type === "k" && cell.color === kingColor) return cell.square;
  }
  return null;
}

interface BoardViewProps {
  fen: string;
  lastMove: MoveRecord | null;
  orientation: Side;
  /** A model is thinking: the frame runs a light around its edge in `glow`. */
  live: boolean;
  glow: string;
  /** Showing an earlier position than the live one. */
  history: boolean;
}

export function BoardView({ fen, lastMove, orientation, live, glow, history }: BoardViewProps) {
  const checkSquare = useMemo(() => checkedKingSquare(fen), [fen]);

  // Effects live inside each square under the piece, so highlights never tint the pieces themselves.
  // Keys include the position so the ripple replays on every new move.
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: ReactNode }) => (
      <div className="sq-piece">
        {lastMove?.from === square && <span key={`from-${fen}`} className="sq-highlight from" />}
        {lastMove?.to === square && (
          <>
            <span key={`to-${fen}`} className="sq-highlight" />
            {!history && <span key={`ripple-${fen}`} className="sq-ripple" />}
          </>
        )}
        {checkSquare === square && <span className="sq-check" />}
        <div className="relative h-full w-full">{children}</div>
      </div>
    ),
    [lastMove, checkSquare, fen, history],
  );

  return (
    <div className="[perspective:1400px]">
      <motion.div
        key={orientation}
        initial={{ opacity: 0, rotateX: 14, rotateY: orientation === "white" ? -8 : 8, scale: 0.94 }}
        animate={{ opacity: 1, rotateX: 0, rotateY: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
        className="board-frame aspect-square w-full"
        data-live={live}
        data-history={history}
        style={{ ["--glow" as string]: glow }}
        role="img"
        aria-label={`Chess board, ${orientation} at the bottom`}
      >
        <div className="board-surface h-full w-full">
          <Chessboard
            options={{
              id: "arena-board",
              position: fen,
              boardOrientation: orientation,
              allowDragging: false,
              allowDrawingArrows: false,
              animationDurationInMs: MOVE_ANIMATION_MS,
              pieces: SHADOWED_PIECES,
              squareRenderer,
              darkSquareStyle: { backgroundColor: "var(--square-dark)" },
              lightSquareStyle: { backgroundColor: "var(--square-light)" },
              darkSquareNotationStyle: { color: "var(--square-light)" },
              lightSquareNotationStyle: { color: "var(--square-dark)" },
              alphaNotationStyle: { ...NOTATION, bottom: 1, right: 4 },
              numericNotationStyle: { ...NOTATION, top: 2, left: 4 },
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
