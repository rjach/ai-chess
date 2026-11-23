"use client";
import { motion } from "motion/react";
import { useEffect } from "react";
import { PawnMark } from "./SetupPanel";
import { ProviderAvatar } from "./ProviderAvatar";
import { sideLabel, type PlayerConfig, type Side } from "@/lib/players";
import { PROVIDER_STYLES } from "@/lib/providerStyle";

const INTRO_MS = 1900;

interface MatchIntroProps {
  players: Record<Side, PlayerConfig>;
  names: Record<Side, string>;
  onDone: () => void;
}

/**
 * Fight-card splash when a match starts. Decorative and non-blocking: it ignores pointer input and is
 * hidden from assistive tech, and the first move request is already running underneath it.
 */
export function MatchIntro({ players, names, onDone }: MatchIntroProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const half = (side: Side) => {
    const left = side === "white";
    const glow = PROVIDER_STYLES[players[side].provider].glow;
    return (
      <motion.div
        className={`flex min-w-0 flex-1 flex-col items-center gap-3 px-4 ${left ? "sm:items-end sm:text-right" : "sm:items-start sm:text-left"} text-center`}
        initial={{ x: left ? "-60vw" : "60vw", opacity: 0, skewX: left ? -12 : 12 }}
        animate={{ x: 0, opacity: 1, skewX: 0 }}
        exit={{ x: left ? "-40vw" : "40vw", opacity: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 18, delay: left ? 0.05 : 0.15 }}
      >
        <div className="relative">
          <span className="absolute inset-0 -z-10 scale-150 rounded-full opacity-70 blur-2xl" style={{ background: glow }} />
          <ProviderAvatar provider={players[side].provider} size={92} />
        </div>
        <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.2em] text-muted uppercase">
          <PawnMark side={side} size={16} /> {sideLabel(side)}
        </div>
        <p className="font-display max-w-[40vw] truncate text-[clamp(22px,4vw,44px)] leading-none text-ink">{names[side]}</p>
      </motion.div>
    );
  };

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-hidden"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.1 } }}
    >
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(10_11_14/0.82),rgb(4_5_8/0.96))] backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="absolute h-[2px] w-[160vmax] bg-[linear-gradient(90deg,transparent,var(--accent),#fff,var(--accent),transparent)] shadow-[0_0_30px_var(--accent)]"
        initial={{ rotate: -24, scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 1, 0.5] }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="relative flex w-full max-w-5xl flex-col items-center gap-6 sm:flex-row sm:gap-0">
        {half("white")}
        <motion.span
          className="font-display shrink-0 px-6 text-[clamp(64px,12vw,140px)] leading-none text-accent italic [text-shadow:0_0_40px_rgb(233_180_76/0.7)]"
          initial={{ scale: 3.2, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.42 }}
        >
          vs
        </motion.span>
        {half("black")}
      </div>
    </motion.div>
  );
}
