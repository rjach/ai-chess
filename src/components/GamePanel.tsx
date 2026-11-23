"use client";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { ProviderAvatar } from "./ProviderAvatar";
import { resultHeadline, resultScore, sideToMove, type MatchState, type MoveRecord } from "@/lib/match";
import { sideLabel, type Side } from "@/lib/players";

type Tab = "moves" | "thoughts";
const TABS: { id: Tab; label: string }[] = [
  { id: "moves", label: "Moves" },
  { id: "thoughts", label: "Thoughts" },
];

interface GamePanelProps {
  state: MatchState;
  names: Record<Side, string>;
  onView: (ply: number | null) => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onNewGame: () => void;
  onFlip: () => void;
  onCopyPgn: () => Promise<boolean>;
  onDownloadPgn: () => void;
  onVideo: () => void;
}

function MoveCell({ move, ply, active, onView }: { move: MoveRecord | undefined; ply: number; active: boolean; onView: (ply: number) => void }) {
  if (!move) return <span />;
  return (
    <button
      type="button"
      onClick={() => onView(ply)}
      aria-current={active ? "step" : undefined}
      title={move.fallback ? "The model failed to give a legal move, so a random legal move was played" : move.comment || undefined}
      className={`relative flex min-h-8 min-w-0 items-center gap-1 rounded-lg px-2.5 text-left font-mono text-[13.5px] font-semibold transition-colors ${
        active ? "text-accent-ink" : "text-ink-soft hover:bg-white/[0.06] hover:text-ink"
      }`}
    >
      {active && (
        <motion.span
          layoutId="active-move"
          className="absolute inset-0 rounded-lg bg-accent shadow-[0_0_18px_-4px_rgb(233_180_76/0.8)]"
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        />
      )}
      <span className="relative truncate">{move.san}</span>
      {move.fallback && (
        <span className="relative text-[11px] text-danger" aria-label="random fallback move">
          ⚠
        </span>
      )}
      {!move.fallback && move.rejectedReplies > 0 && (
        <span className={`relative text-[11px] ${active ? "" : "text-warning"}`} aria-label={`${move.rejectedReplies} illegal replies before this move`}>
          ↻{move.rejectedReplies}
        </span>
      )}
    </button>
  );
}

function EmptyNote({ children }: { children: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" className="text-faint">
        <rect x="6" y="6" width="36" height="36" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="emblem-flow" />
        <rect x="14" y="14" width="10" height="10" rx="2" fill="currentColor" className="logo-square" />
        <rect x="24" y="24" width="10" height="10" rx="2" fill="currentColor" className="logo-square" style={{ animationDelay: "0.6s" }} />
      </svg>
      <p className="text-[14px] text-muted">{children}</p>
    </div>
  );
}

function MoveList({ moves, viewedPly, onView }: { moves: MoveRecord[]; viewedPly: number; onView: (ply: number) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  const live = viewedPly === moves.length - 1;
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [moves.length, live]);

  if (moves.length === 0) return <EmptyNote>The first move is on its way.</EmptyNote>;

  const rows = Math.ceil(moves.length / 2);
  return (
    <LayoutGroup id="moves">
      <ol className="p-2">
        {Array.from({ length: rows }, (_, row) => (
          <motion.li
            key={row}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className={`grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1 rounded-lg px-1 py-0.5 ${row % 2 ? "bg-white/[0.022]" : ""}`}
          >
            <span className="pl-1.5 font-mono text-[12px] text-faint tabular-nums">{row + 1}.</span>
            <MoveCell move={moves[row * 2]} ply={row * 2} active={viewedPly === row * 2} onView={onView} />
            <MoveCell move={moves[row * 2 + 1]} ply={row * 2 + 1} active={viewedPly === row * 2 + 1} onView={onView} />
          </motion.li>
        ))}
        <div ref={endRef} />
      </ol>
    </LayoutGroup>
  );
}

function Thoughts({ state, names }: { state: MatchState; names: Record<Side, string> }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state.moves.length]);
  const withComments = state.moves.map((move, ply) => ({ move, ply })).filter(({ move }) => move.comment || move.fallback);

  if (withComments.length === 0) return <EmptyNote>Each model explains its move here.</EmptyNote>;
  return (
    <ul className="space-y-3 p-3">
      {withComments.map(({ move, ply }) => {
        const player = state.players[move.side];
        const right = move.side === "black";
        return (
          <motion.li
            key={ply}
            initial={{ opacity: 0, y: 16, scale: 0.94, x: right ? 12 : -12 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className={`flex gap-2.5 ${right ? "flex-row-reverse" : ""}`}
          >
            <ProviderAvatar provider={player.provider} size={30} />
            <div
              className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                right ? "rounded-tr-md bg-[linear-gradient(160deg,#23252e,#191a20)]" : "rounded-tl-md bg-[linear-gradient(160deg,#2b2a26,#1d1c19)]"
              } border border-line`}
            >
              <div className={`flex items-baseline gap-2 text-[11.5px] text-muted ${right ? "flex-row-reverse" : ""}`}>
                <span className="truncate font-semibold text-ink-soft">{names[move.side]}</span>
                <span className="shrink-0 rounded-md bg-black/30 px-1.5 py-px font-mono text-accent">
                  {Math.floor(ply / 2) + 1}
                  {move.side === "white" ? "." : "…"} {move.san}
                </span>
              </div>
              <p className="mt-1 text-[14px] leading-snug text-ink">
                {move.fallback ? "Could not produce a legal move. A random legal move was played instead." : move.comment}
              </p>
            </div>
          </motion.li>
        );
      })}
      <div ref={endRef} />
    </ul>
  );
}

function ToolButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="btn-icon grid min-h-11 min-w-11 place-items-center rounded-xl">
      <Icon name={icon} size={20} />
    </button>
  );
}

function StatusLine({ state, names }: { state: MatchState; names: Record<Side, string> }) {
  const content = (() => {
    if (state.result) {
      return {
        key: "over",
        node: (
          <>
            <span className="rounded-md bg-accent/15 px-1.5 py-px text-[11px] font-bold tracking-wider text-accent uppercase">Final</span>
            <span className="font-semibold text-ink">{resultHeadline(state.result)}</span>
            <span className="truncate text-muted">
              {state.result.stopped ? "" : `by ${state.result.reason} · `}
              {resultScore(state.result)}
            </span>
          </>
        ),
      };
    }
    const turn = sideToMove(state);
    if (state.status === "paused") {
      return {
        key: "paused",
        node: (
          <>
            <span className="rounded-md bg-warning/15 px-1.5 py-px text-[11px] font-bold tracking-wider text-warning uppercase">Paused</span>
            <span className="text-muted">{sideLabel(turn)} to move</span>
          </>
        ),
      };
    }
    return {
      key: `live-${turn}`,
      node: (
        <>
          <span className="flex items-center gap-1.5 rounded-md bg-danger/15 px-1.5 py-px text-[11px] font-bold tracking-wider text-danger uppercase">
            <span className="pulse-dot size-1.5 rounded-full bg-danger" aria-hidden="true" />
            Live
          </span>
          <span className="truncate text-muted">
            <span className="text-ink-soft">{names[turn]}</span> is thinking
          </span>
        </>
      ),
    };
  })();

  return (
    <div className="relative mt-2 h-6 overflow-hidden text-[13.5px]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={content.key}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="flex min-w-0 items-center gap-2"
        >
          {content.node}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function GamePanel({ state, names, onView, onPause, onResume, onEnd, onNewGame, onFlip, onCopyPgn, onDownloadPgn, onVideo }: GamePanelProps) {
  const [tab, setTab] = useState<Tab>("moves");
  const [copied, setCopied] = useState(false);
  const lastPly = state.moves.length - 1;
  const viewedPly = state.viewPly ?? lastPly;
  const running = state.status === "playing" || state.status === "paused";
  const thoughtCount = state.moves.filter((move) => move.comment || move.fallback).length;

  return (
    <motion.div
      className="flex h-full min-h-[420px] flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <div className="border-b border-line px-5 pt-4 pb-3.5">
        <h2 className="flex min-w-0 items-center gap-2.5">
          <ProviderAvatar provider={state.players.white.provider} size={26} />
          <span className="min-w-0 truncate text-[15px] font-semibold">{names.white}</span>
          <span className="font-display shrink-0 text-[18px] text-faint italic">vs</span>
          <span className="min-w-0 truncate text-[15px] font-semibold">{names.black}</span>
          <ProviderAvatar provider={state.players.black.provider} size={26} />
        </h2>
        <StatusLine state={state} names={names} />
      </div>

      <AnimatePresence>
        {state.error && (
          <motion.div
            key={state.error.message}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="shake m-3 rounded-xl border border-danger/40 bg-[linear-gradient(160deg,rgb(255_92_80/0.16),rgb(255_92_80/0.05))] p-3.5 text-[13px]" role="alert">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <span className="pulse-dot size-2 rounded-full bg-danger" aria-hidden="true" />
                {sideLabel(state.error.side)} could not move
              </p>
              <p className="mt-1 break-words text-ink-soft">{state.error.message}</p>
              <button type="button" onClick={onResume} className="btn-glass mt-2.5 flex min-h-9 items-center gap-1.5 rounded-lg px-3 font-semibold">
                <Icon name="refresh" size={14} /> Retry move
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div role="tablist" aria-label="Match details" className="flex gap-1 border-b border-line px-3">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`relative flex min-h-11 items-center gap-1.5 px-3 text-[14px] font-semibold transition-colors ${tab === id ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
            {id === "thoughts" && thoughtCount > 0 && (
              <motion.span key={thoughtCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="rounded-full bg-white/10 px-1.5 font-mono text-[10.5px] text-ink-soft">
                {thoughtCount}
              </motion.span>
            )}
            {tab === id && (
              <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-[180px] flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "moves" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "moves" ? -20 : 20 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "moves" ? <MoveList moves={state.moves} viewedPly={viewedPly} onView={onView} /> : <Thoughts state={state} names={names} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-line bg-black/20 p-2.5">
        <div className="well grid grid-cols-4 gap-1 rounded-xl p-1" aria-label="Move navigation">
          <ToolButton icon="first" label="First move" onClick={() => onView(0)} disabled={viewedPly <= 0} />
          <ToolButton icon="prev" label="Previous move" onClick={() => onView(viewedPly - 1)} disabled={viewedPly <= 0} />
          <ToolButton icon="next" label="Next move" onClick={() => onView(viewedPly + 1)} disabled={viewedPly >= lastPly} />
          <ToolButton icon="last" label="Latest move" onClick={() => onView(null)} disabled={viewedPly >= lastPly} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {running &&
            (state.status === "playing" ? (
              <button type="button" onClick={onPause} className="btn-glass flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold">
                <Icon name="pause" size={17} /> Pause
              </button>
            ) : (
              <button type="button" onClick={onResume} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-bold">
                <Icon name="play" size={17} /> Resume
              </button>
            ))}
          {running ? (
            <button type="button" onClick={onEnd} className="btn-glass flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold">
              <Icon name="stop" size={15} /> End
            </button>
          ) : (
            <button type="button" onClick={onNewGame} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-bold">
              <Icon name="plus" size={18} /> New match
            </button>
          )}
          <div className="flex gap-0.5">
            <ToolButton icon="flip" label="Flip board" onClick={onFlip} />
            <ToolButton
              icon="copy"
              label={copied ? "PGN copied" : "Copy PGN"}
              onClick={async () => {
                setCopied(await onCopyPgn());
                window.setTimeout(() => setCopied(false), 1500);
              }}
              disabled={state.moves.length === 0}
            />
            <ToolButton icon="download" label="Download PGN" onClick={onDownloadPgn} disabled={state.moves.length === 0} />
            {state.status === "over" && <ToolButton icon="video" label="Download game video" onClick={onVideo} disabled={state.moves.length === 0} />}
          </div>
        </div>
        <AnimatePresence>
          {copied && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-center text-[12px] font-semibold text-signal"
            >
              PGN copied to clipboard
            </motion.p>
          )}
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">
          {copied ? "PGN copied to clipboard" : ""}
        </p>
      </div>
    </motion.div>
  );
}
