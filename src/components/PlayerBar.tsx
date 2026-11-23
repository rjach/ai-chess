"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { PieceGlyph } from "./PieceGlyph";
import { ProviderAvatar } from "./ProviderAvatar";
import { PROVIDERS, otherSide, type PlayerConfig, type Side } from "@/lib/players";
import { PROVIDER_STYLES } from "@/lib/providerStyle";

const CLOCK_TICK_MS = 250;

export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function useLiveElapsed(since: number | null): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (since === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [since]);
  return since === null ? 0 : Math.max(0, now - since);
}

interface PlayerBarProps {
  side: Side;
  player: PlayerConfig | null;
  modelLabel: string;
  captured: string[];
  materialLead: number;
  thinkMs: number;
  thinkingSince: number | null;
  active: boolean;
  isWinner: boolean;
}

export function PlayerBar({ side, player, modelLabel, captured, materialLead, thinkMs, thinkingSince, active, isWinner }: PlayerBarProps) {
  const live = useLiveElapsed(active ? thinkingSince : null);
  const thinking = active && thinkingSince !== null;
  const glow = player ? PROVIDER_STYLES[player.provider].glow : "var(--accent)";

  return (
    <div className="flex h-[60px] items-center gap-3 px-0.5" aria-label={`${side} player`}>
      <ProviderAvatar provider={player?.provider ?? null} size={40} thinking={thinking} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ring-1 ${side === "white" ? "bg-[#f5f0e6] ring-white/40" : "bg-[#15161b] ring-white/25"}`}
          />
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink" title={modelLabel}>
            {modelLabel}
          </span>
          {player && <span className="hidden shrink-0 text-[12px] text-faint @sm:inline">{PROVIDERS[player.provider].label}</span>}
          <AnimatePresence>
            {isWinner && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 14 }}
                className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-accent-ink uppercase shadow-[0_0_18px_rgb(233_180_76/0.6)]"
              >
                <Icon name="crown" size={11} /> Winner
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative mt-0.5 flex h-5 min-w-0 items-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {thinking ? (
              <motion.span
                key="thinking"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-[13px] font-medium"
                role="status"
              >
                <span className="wave flex h-3.5 items-center gap-[2px]" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                <span className="thinking-text">Thinking</span>
              </motion.span>
            ) : (
              <motion.span
                key="captured"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex min-w-0 items-center"
                aria-label={`${captured.length} pieces captured`}
              >
                <AnimatePresence initial={false}>
                  {captured.map((piece, index) => (
                    <motion.span
                      key={`${piece}-${index}`}
                      initial={{ scale: 0, y: -10 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 18 }}
                      className={index > 0 && captured[index - 1] === piece ? "-ml-2" : ""}
                    >
                      <PieceGlyph piece={piece} side={otherSide(side)} size={18} />
                    </motion.span>
                  ))}
                </AnimatePresence>
                {materialLead > 0 && (
                  <motion.span key={materialLead} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-1.5 font-mono text-[11px] font-bold text-accent">
                    +{materialLead}
                  </motion.span>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <motion.div
        animate={{
          backgroundColor: active ? "#f5f0e6" : "rgba(0,0,0,0.35)",
          color: active ? "#0a0b0e" : "#6c685f",
          boxShadow: active ? `0 0 0 1px rgba(255,255,255,0.6), 0 0 28px -4px ${glow}` : "0 0 0 1px rgba(255,255,255,0.06), 0 0 0 0 rgba(0,0,0,0)",
          scale: active ? 1.04 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="flex h-11 min-w-[70px] shrink-0 items-center justify-end gap-1.5 rounded-xl px-2.5 font-mono text-[19px] font-bold tabular-nums @sm:min-w-[96px] @sm:px-3 @sm:text-[23px]"
        aria-label={`${side} total thinking time`}
      >
        {active && <span className="pulse-dot hidden size-1.5 rounded-full bg-[#0a0b0e] @sm:block" aria-hidden="true" />}
        {formatClock(thinkMs + live)}
      </motion.div>
    </div>
  );
}
