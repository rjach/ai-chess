import { Chess } from "chess.js";
import { START_FEN, materialFromFen, resultHeadline, resultScore, type GameResult, type MoveRecord } from "@/lib/match";
import { PROVIDERS, otherSide, sideLabel, type PlayerConfig, type Side } from "@/lib/players";
import { PROVIDER_STYLES } from "@/lib/providerStyle";
import { INTRO_SECONDS, type FrameState, type VideoSpeed } from "./timeline";

export type VideoOrientation = "portrait" | "landscape";
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** Keyed like react-chessboard's piece set: "wP", "bK", … */
export type PieceImages = Record<string, CanvasImageSource>;

export interface VideoGame {
  moves: MoveRecord[];
  players: Record<Side, PlayerConfig>;
  modelLabels: Record<Side, string>;
  result: GameResult | null;
  boardOrientation: Side;
}

export interface DrawContext {
  ctx: Ctx;
  layout: VideoLayout;
  game: VideoGame;
  pieces: PieceImages;
  fontFamily: string;
  speed: VideoSpeed;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoLayout {
  orientation: VideoOrientation;
  width: number;
  height: number;
  header: Rect | null;
  topBar: Rect;
  board: Rect;
  bottomBar: Rect;
  info: Rect;
  /** Multiplier for type sizes, so the 1080-wide portrait frame reads at phone size. */
  type: number;
}

export const VIDEO_LAYOUTS: Record<VideoOrientation, VideoLayout> = {
  landscape: {
    orientation: "landscape",
    width: 1920,
    height: 1080,
    header: null,
    topBar: { x: 80, y: 40, w: 860, h: 70 },
    board: { x: 80, y: 120, w: 860, h: 860 },
    bottomBar: { x: 80, y: 990, w: 860, h: 70 },
    info: { x: 1000, y: 40, w: 840, h: 1020 },
    type: 1,
  },
  portrait: {
    orientation: "portrait",
    width: 1080,
    height: 1920,
    header: { x: 40, y: 70, w: 1000, h: 130 },
    topBar: { x: 40, y: 220, w: 1000, h: 84 },
    board: { x: 40, y: 314, w: 1000, h: 1000 },
    bottomBar: { x: 40, y: 1324, w: 1000, h: 84 },
    info: { x: 40, y: 1440, w: 1000, h: 420 },
    type: 1.2,
  },
};

/** Mirrors the app theme tokens in globals.css so exported videos match the board on screen. */
const COLORS = {
  bg: "#0a0b0e",
  panel: "#13141a",
  panelRaised: "#1b1d24",
  ink: "#f5f0e6",
  inkSoft: "#d9d2c4",
  muted: "#9c978c",
  faint: "#6c685f",
  accent: "#e9b44c",
  accentHover: "#f7cb6c",
  danger: "#ff5c50",
  clockIdle: "#060709",
  light: "#e6e3d6",
  dark: "#6f8b84",
  highlight: "rgba(242, 192, 82, 0.55)",
};

const FILES = "abcdefgh";
const THINKING_DOT_SECONDS = 0.4;
/** The final position stays visible this long before the result card covers it. */
const OUTRO_CARD_DELAY_SECONDS = 1.2;
const CARD_FADE_SECONDS = 0.35;

function font(draw: DrawContext, weight: number, size: number): string {
  return `${weight} ${Math.round(size * draw.layout.type)}px ${draw.fontFamily}`;
}

function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && lines.join(" ").length < text.length) lines[maxLines - 1] = fitText(ctx, `${lines[maxLines - 1]}…`, maxWidth);
  return lines;
}

function fillRoundRect(ctx: Ctx, rect: Rect, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fill();
}

function fenPieces(fen: string): Map<string, string> {
  const pieces = new Map<string, string>();
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, rowIndex) => {
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
        continue;
      }
      const color = char === char.toUpperCase() ? "w" : "b";
      pieces.set(`${FILES[file]}${8 - rowIndex}`, `${color}${char.toUpperCase()}`);
      file++;
    }
  });
  return pieces;
}

function squareOrigin(square: string, board: Rect, orientation: Side): { x: number; y: number } {
  const size = board.w / 8;
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { x: board.x + column * size, y: board.y + row * size };
}

function castlingRook(move: MoveRecord): { from: string; to: string } | null {
  const rank = move.side === "white" ? "1" : "8";
  if (move.san.startsWith("O-O-O")) return { from: `a${rank}`, to: `d${rank}` };
  if (move.san.startsWith("O-O")) return { from: `h${rank}`, to: `f${rank}` };
  return null;
}

function checkedKing(fen: string): string | null {
  const game = new Chess(fen);
  if (!game.inCheck()) return null;
  for (const row of game.board()) for (const cell of row) if (cell?.type === "k" && cell.color === game.turn()) return cell.square;
  return null;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function drawBoard(draw: DrawContext, frame: FrameState): void {
  const { ctx, layout, game, pieces } = draw;
  const board = layout.board;
  const orientation = game.boardOrientation;
  const size = board.w / 8;
  const fen = frame.appliedPlies > 0 ? game.moves[frame.appliedPlies - 1].fenAfter : START_FEN;
  const animating = frame.phase === "animate" && frame.activePly !== null ? game.moves[frame.activePly] : null;
  const highlighted = animating ?? (frame.appliedPlies > 0 ? game.moves[frame.appliedPlies - 1] : null);
  const rook = animating ? castlingRook(animating) : null;
  const hidden = new Set([animating?.from, rook?.from].filter(Boolean));
  const kingInCheck = checkedKing(fen);

  for (let rank = 1; rank <= 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = `${FILES[file]}${rank}`;
      const { x, y } = squareOrigin(square, board, orientation);
      const light = (file + rank) % 2 === 1;
      ctx.fillStyle = light ? COLORS.light : COLORS.dark;
      ctx.fillRect(x, y, size, size);
      if (highlighted && (square === highlighted.from || square === highlighted.to)) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(x, y, size, size);
      }
      if (square === kingInCheck) {
        const gradient = ctx.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size * 0.62);
        gradient.addColorStop(0, "rgba(255,0,0,0.95)");
        gradient.addColorStop(0.45, "rgba(231,0,0,0.55)");
        gradient.addColorStop(1, "rgba(169,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, size, size);
      }
      ctx.fillStyle = light ? COLORS.dark : COLORS.light;
      ctx.font = `700 ${Math.round(size * 0.17)}px ${draw.fontFamily}`;
      const leftColumn = orientation === "white" ? file === 0 : file === 7;
      const bottomRow = orientation === "white" ? rank === 1 : rank === 8;
      if (leftColumn) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(String(rank), x + size * 0.05, y + size * 0.04);
      }
      if (bottomRow) {
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(FILES[file], x + size * 0.96, y + size * 0.98);
      }
    }
  }

  for (const [square, piece] of fenPieces(fen)) {
    if (hidden.has(square)) continue;
    const { x, y } = squareOrigin(square, board, orientation);
    ctx.drawImage(pieces[piece], x, y, size, size);
  }

  if (!animating) return;
  const before = fenPieces(fen);
  const t = easeInOut(frame.animationProgress);
  for (const step of [{ from: animating.from, to: animating.to }, rook].filter((entry): entry is { from: string; to: string } => entry !== null)) {
    const piece = before.get(step.from);
    if (!piece) continue;
    const start = squareOrigin(step.from, board, orientation);
    const end = squareOrigin(step.to, board, orientation);
    ctx.drawImage(pieces[piece], start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, size, size);
  }
}

function drawAvatar(draw: DrawContext, player: PlayerConfig, x: number, y: number, size: number): void {
  const style = PROVIDER_STYLES[player.provider];
  fillRoundRect(draw.ctx, { x, y, w: size, h: size }, size * 0.1, style.background);
  draw.ctx.fillStyle = style.color;
  draw.ctx.font = `700 ${Math.round(size * 0.5)}px ${draw.fontFamily}`;
  draw.ctx.textAlign = "center";
  draw.ctx.textBaseline = "middle";
  draw.ctx.fillText(style.glyph, x + size / 2, y + size / 2 + size * 0.03);
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function drawPlayerBar(draw: DrawContext, frame: FrameState, side: Side, rect: Rect): void {
  const { ctx, game } = draw;
  const player = game.players[side];
  const avatar = rect.h * 0.82;
  const avatarY = rect.y + (rect.h - avatar) / 2;
  const thinking = frame.phase === "think" && frame.activePly !== null && game.moves[frame.activePly].side === side;
  const winner = frame.phase === "outro" && game.result?.winner === side;

  drawAvatar(draw, player, rect.x, avatarY, avatar);

  const clockW = rect.h * 2.5;
  const clockH = rect.h * 0.78;
  const clockRect = { x: rect.x + rect.w - clockW, y: rect.y + (rect.h - clockH) / 2, w: clockW, h: clockH };
  fillRoundRect(ctx, clockRect, 6, thinking ? COLORS.ink : COLORS.clockIdle);
  ctx.fillStyle = thinking ? COLORS.clockIdle : COLORS.faint;
  ctx.font = `600 ${Math.round(clockH * 0.56)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(formatClock(frame.clocksMs[side]), clockRect.x + clockRect.w - clockH * 0.3, clockRect.y + clockH / 2 + 1);

  const textX = rect.x + avatar + rect.h * 0.22;
  const textWidth = clockRect.x - textX - 16;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(draw, 700, 26);
  const name = fitText(ctx, game.modelLabels[side], textWidth - (winner ? 120 : 0));
  ctx.fillText(name, textX, rect.y + rect.h * 0.44);
  if (winner) {
    const badgeX = textX + ctx.measureText(name).width + 12;
    ctx.font = font(draw, 800, 15);
    const badgeW = ctx.measureText("WINNER").width + 16;
    fillRoundRect(ctx, { x: badgeX, y: rect.y + rect.h * 0.18, w: badgeW, h: rect.h * 0.32 }, 4, COLORS.accent);
    ctx.fillStyle = "#1c1405";
    ctx.textBaseline = "middle";
    ctx.fillText("WINNER", badgeX + 8, rect.y + rect.h * 0.34);
    ctx.textBaseline = "alphabetic";
  }

  const subY = rect.y + rect.h * 0.84;
  if (thinking) {
    ctx.fillStyle = COLORS.accentHover;
    ctx.font = font(draw, 600, 20);
    ctx.fillText(`Thinking${".".repeat(1 + (Math.floor(frame.phaseElapsed / THINKING_DOT_SECONDS) % 3))}`, textX, subY);
    return;
  }
  const fen = frame.appliedPlies > 0 ? game.moves[frame.appliedPlies - 1].fenAfter : START_FEN;
  const material = materialFromFen(fen);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(draw, 500, 19);
  const provider = PROVIDERS[player.provider].label;
  ctx.fillText(provider, textX, subY);
  let pieceX = textX + ctx.measureText(provider).width + 12;
  const pieceSize = rect.h * 0.34;
  const opponent = otherSide(side) === "white" ? "w" : "b";
  for (const piece of material.captured[side]) {
    if (pieceX + pieceSize > clockRect.x - 60) break;
    draw.ctx.drawImage(draw.pieces[`${opponent}${piece.toUpperCase()}`], pieceX, subY - pieceSize * 0.85, pieceSize, pieceSize);
    pieceX += pieceSize * 0.62;
  }
  const lead = side === "white" ? material.balance : -material.balance;
  if (lead > 0) ctx.fillText(`+${lead}`, pieceX + pieceSize * 0.5, subY);
}

function moveNumber(ply: number, side: Side): string {
  return `${Math.floor(ply / 2) + 1}${side === "white" ? "." : "…"}`;
}

function drawThought(draw: DrawContext, frame: FrameState, rect: Rect): number {
  const { ctx, game } = draw;
  let index = frame.appliedPlies - 1;
  while (index >= 0 && !game.moves[index].comment && !game.moves[index].fallback) index--;
  const padding = 22;
  if (index < 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(draw, 500, 22);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Each model explains its move here.", rect.x, rect.y);
    return 40 * draw.layout.type;
  }
  const move = game.moves[index];
  const text = move.fallback ? "Could not find a legal move, so a random legal move was played." : move.comment;
  const avatar = 44 * draw.layout.type;
  const bubbleX = rect.x + avatar + 14;
  const bubbleW = rect.w - avatar - 14;
  ctx.font = font(draw, 500, 24);
  const lines = wrapText(ctx, text, bubbleW - padding * 2, 3);
  const lineHeight = 32 * draw.layout.type;
  const headerHeight = 32 * draw.layout.type;
  const bubbleH = padding * 2 + headerHeight + lines.length * lineHeight;

  drawAvatar(draw, game.players[move.side], rect.x, rect.y, avatar);
  fillRoundRect(ctx, { x: bubbleX, y: rect.y, w: bubbleW, h: bubbleH }, 14, COLORS.panelRaised);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(draw, 700, 19);
  const label = `${game.modelLabels[move.side]}  ·  ${moveNumber(index, move.side)} ${move.san}`;
  ctx.fillText(fitText(ctx, label, bubbleW - padding * 2), bubbleX + padding, rect.y + padding);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(draw, 500, 24);
  lines.forEach((line, lineIndex) => ctx.fillText(line, bubbleX + padding, rect.y + padding + headerHeight + lineIndex * lineHeight));
  return bubbleH;
}

function drawMoveRows(draw: DrawContext, frame: FrameState, rect: Rect): void {
  const { ctx, game } = draw;
  const rowHeight = 40 * draw.layout.type;
  const maxRows = Math.floor(rect.h / rowHeight);
  if (maxRows <= 0) return;
  const shown = frame.appliedPlies;
  const totalRows = Math.ceil(shown / 2);
  const firstRow = Math.max(0, totalRows - maxRows);
  const columnW = (rect.w - 90 * draw.layout.type) / 2;

  for (let row = firstRow; row < totalRows; row++) {
    const y = rect.y + (row - firstRow) * rowHeight;
    if ((row - firstRow) % 2 === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(rect.x, y, rect.w, rowHeight);
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.faint;
    ctx.font = font(draw, 500, 21);
    ctx.fillText(`${row + 1}.`, rect.x + 12, y + rowHeight / 2);
    for (const offset of [0, 1]) {
      const ply = row * 2 + offset;
      if (ply >= shown) continue;
      const x = rect.x + 90 * draw.layout.type + offset * columnW;
      const current = ply === shown - 1;
      if (current) fillRoundRect(ctx, { x: x - 10, y: y + 4, w: columnW - 16, h: rowHeight - 8 }, 6, "#2a2c35");
      ctx.fillStyle = current ? COLORS.ink : COLORS.inkSoft;
      ctx.font = font(draw, 700, 22);
      const san = game.moves[ply].san + (game.moves[ply].fallback ? " ⚠" : "");
      ctx.fillText(san, x, y + rowHeight / 2);
    }
  }
}

function drawProgress(draw: DrawContext, frame: FrameState, rect: Rect): void {
  const { ctx } = draw;
  const barY = rect.y + rect.h - 52 * draw.layout.type;
  fillRoundRect(ctx, { x: rect.x, y: barY, w: rect.w, h: 6 }, 3, COLORS.panelRaised);
  fillRoundRect(ctx, { x: rect.x, y: barY, w: Math.max(6, rect.w * frame.progress), h: 6 }, 3, COLORS.accent);
  ctx.font = font(draw, 600, 19);
  ctx.textBaseline = "bottom";
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "left";
  ctx.fillText(`${draw.speed}× speed`, rect.x, rect.y + rect.h);
  ctx.textAlign = "right";
  ctx.fillText("AI Chess Arena", rect.x + rect.w, rect.y + rect.h);
}

function statusText(draw: DrawContext, frame: FrameState): { text: string; color: string } {
  const { game } = draw;
  if (frame.phase === "intro") return { text: "Game starting", color: COLORS.muted };
  if (frame.phase === "outro" && game.result) {
    const reason = game.result.stopped ? "" : ` by ${game.result.reason}`;
    return { text: `${resultHeadline(game.result)}${reason}`, color: COLORS.ink };
  }
  if (frame.activePly !== null) {
    const side = game.moves[frame.activePly].side;
    return { text: `${moveNumber(frame.activePly, side)} ${game.modelLabels[side]} is thinking`, color: COLORS.accentHover };
  }
  return { text: `${frame.appliedPlies} moves`, color: COLORS.muted };
}

function matchupText(draw: DrawContext): string {
  return `${draw.game.modelLabels.white}  vs  ${draw.game.modelLabels.black}`;
}

function drawInfo(draw: DrawContext, frame: FrameState): void {
  const { ctx, layout } = draw;
  const panel = layout.info;
  const landscape = layout.orientation === "landscape";
  const inner = landscape ? { x: panel.x + 36, y: panel.y + 36, w: panel.w - 72, h: panel.h - 72 } : panel;
  if (landscape) fillRoundRect(ctx, panel, 16, COLORS.panel);

  let y = inner.y;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (landscape) {
    ctx.fillStyle = COLORS.accent;
    ctx.font = font(draw, 800, 20);
    ctx.fillText("AI VS AI CHESS", inner.x, y);
    y += 36;
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(draw, 800, 36);
    ctx.fillText(fitText(ctx, matchupText(draw), inner.w), inner.x, y);
    y += 56;
  }
  const status = statusText(draw, frame);
  ctx.fillStyle = status.color;
  ctx.font = font(draw, 600, 24);
  ctx.fillText(fitText(ctx, status.text, inner.w), inner.x, y);
  y += 52 * layout.type;

  y += drawThought(draw, frame, { x: inner.x, y, w: inner.w, h: 0 }) + 28 * layout.type;
  const progressSpace = 70 * layout.type;
  drawMoveRows(draw, frame, { x: inner.x, y, w: inner.w, h: inner.y + inner.h - progressSpace - y });
  drawProgress(draw, frame, inner);
}

function drawHeader(draw: DrawContext, rect: Rect): void {
  const { ctx } = draw;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.accent;
  ctx.font = font(draw, 800, 22);
  ctx.fillText("AI VS AI CHESS", rect.x + rect.w / 2, rect.y);
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(draw, 800, 38);
  ctx.fillText(fitText(ctx, matchupText(draw), rect.w), rect.x + rect.w / 2, rect.y + 44 * draw.layout.type);
}

function drawCard(draw: DrawContext, opacity: number, title: string, subtitle: string, score: string | null, highlight: Side | null): void {
  const { ctx, layout, game } = draw;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, layout.width, layout.height);
  const cardW = Math.min(layout.width - 80, 860);
  const cardH = 420 * layout.type;
  const card = { x: (layout.width - cardW) / 2, y: (layout.height - cardH) / 2, w: cardW, h: cardH };
  fillRoundRect(ctx, card, 22, COLORS.panel);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(draw, 800, 52);
  ctx.fillText(fitText(ctx, title, cardW - 60), card.x + cardW / 2, card.y + 40 * layout.type);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(draw, 500, 24);
  ctx.fillText(fitText(ctx, subtitle, cardW - 60), card.x + cardW / 2, card.y + 110 * layout.type);

  const avatar = 96 * layout.type;
  const centerY = card.y + 175 * layout.type;
  const columns: Record<Side, number> = { white: card.x + cardW * 0.25, black: card.x + cardW * 0.75 };
  for (const side of ["white", "black"] as const) {
    const x = columns[side] - avatar / 2;
    if (highlight === side) fillRoundRect(ctx, { x: x - 6, y: centerY - 6, w: avatar + 12, h: avatar + 12 }, 12, COLORS.accent);
    drawAvatar(draw, game.players[side], x, centerY, avatar);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(draw, 700, 24);
    ctx.fillText(fitText(ctx, game.modelLabels[side], cardW / 2 - 40), columns[side], centerY + avatar + 18);
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(draw, 500, 19);
    ctx.fillText(`${sideLabel(side)} · ${PROVIDERS[game.players[side].provider].label}`, columns[side], centerY + avatar + 52 * layout.type);
  }
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = `700 ${Math.round(34 * layout.type)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(score ?? "vs", card.x + cardW / 2, centerY + avatar / 2);
  ctx.restore();
}

/** Draws one complete video frame. Pure with respect to its inputs, so any frame can be rendered in any order. */
export function drawFrame(draw: DrawContext, frame: FrameState): void {
  const { ctx, layout, game } = draw;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  if (layout.header) drawHeader(draw, layout.header);
  const topSide = otherSide(game.boardOrientation);
  drawPlayerBar(draw, frame, topSide, layout.topBar);
  drawBoard(draw, frame);
  drawPlayerBar(draw, frame, game.boardOrientation, layout.bottomBar);
  drawInfo(draw, frame);

  if (frame.phase === "intro") {
    const opacity = Math.min(1, (INTRO_SECONDS - frame.phaseElapsed) / CARD_FADE_SECONDS);
    drawCard(draw, opacity, "AI vs AI", "Engine-free chess between language models", null, null);
  }
  if (frame.phase === "outro" && game.result && frame.phaseElapsed >= OUTRO_CARD_DELAY_SECONDS) {
    const opacity = Math.min(1, (frame.phaseElapsed - OUTRO_CARD_DELAY_SECONDS) / CARD_FADE_SECONDS);
    const moves = Math.ceil(game.moves.length / 2);
    const subtitle = game.result.stopped ? `${moves} moves played` : `by ${game.result.reason} · ${moves} moves`;
    drawCard(draw, opacity, resultHeadline(game.result), subtitle, resultScore(game.result), game.result.winner);
  }
}
