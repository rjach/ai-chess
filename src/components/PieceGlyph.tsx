import { defaultPieces } from "react-chessboard";
import type { Side } from "@/lib/players";

export function PieceGlyph({ piece, side, size = 18 }: { piece: string; side: Side; size?: number }) {
  const render = defaultPieces[`${side === "white" ? "w" : "b"}${piece.toUpperCase()}`];
  return <span style={{ width: size, height: size }} className="inline-block shrink-0">{render?.({ svgStyle: { width: size, height: size } })}</span>;
}
