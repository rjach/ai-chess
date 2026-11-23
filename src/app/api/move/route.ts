import { Chess } from "chess.js";
import { requestMove } from "@/server/moveEngine";
import { parseMoveBody } from "@/server/parseMoveBody";
import { isTrustedJsonRequest } from "@/server/sameOrigin";

export async function POST(request: Request) {
  if (!isTrustedJsonRequest(request)) return Response.json({ ok: false, error: "Only same-origin JSON requests are accepted" }, { status: 403 });
  const parsed = parseMoveBody(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

  const { player, fen, sanHistory, openRouterKey } = parsed.body;
  if (new Chess(fen).isGameOver()) return Response.json({ ok: false, error: "The game is already over" }, { status: 409 });

  const outcome = await requestMove({ player, fen, sanHistory, openRouterKey, signal: request.signal });
  return Response.json(outcome, { status: outcome.ok ? 200 : 502 });
}
