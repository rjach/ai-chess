import type { Side } from "@/lib/players";

export interface MovePromptInput {
  fen: string;
  side: Side;
  sanHistory: string[];
  legalMoves: string[];
  previousError?: string;
}

export const MOVE_SYSTEM_PROMPT =
  "You are a strong chess player competing in an engine-free AI vs AI match. " +
  "You think silently and answer with a single JSON object and nothing else.";

function numberedHistory(sanHistory: string[]): string {
  if (sanHistory.length === 0) return "(no moves yet, this is the starting position)";
  const parts: string[] = [];
  for (let i = 0; i < sanHistory.length; i += 2) {
    const black = sanHistory[i + 1] ? ` ${sanHistory[i + 1]}` : "";
    parts.push(`${i / 2 + 1}. ${sanHistory[i]}${black}`);
  }
  return parts.join(" ");
}

export function buildMovePrompt(input: MovePromptInput): string {
  const lines = [
    `You are playing ${input.side === "white" ? "White" : "Black"}. It is your move.`,
    "",
    `Position (FEN): ${input.fen}`,
    `Game so far: ${numberedHistory(input.sanHistory)}`,
    `Your legal moves (SAN): ${input.legalMoves.join(" ")}`,
    "",
    "Pick the best move from the legal list. Look for checks, captures and threats first, keep your king safe, and avoid hanging pieces.",
    'Reply with ONLY this JSON, no markdown: {"move":"<one SAN move from the list>","comment":"<one short sentence explaining the idea, under 20 words>"}',
  ];
  if (input.previousError) {
    lines.push("", `Your previous reply was rejected: ${input.previousError}. Choose a move exactly as written in the legal list.`);
  }
  return lines.join("\n");
}
