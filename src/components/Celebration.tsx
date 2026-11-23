"use client";
import { motion } from "motion/react";

const PIECE_COUNT = 42;

/** Deterministic pseudo-random in [0, 1), so render stays pure and repeatable. */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** One-shot confetti burst from the centre of its container. */
export function Confetti({ colors }: { colors: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, index) => {
        const angle = noise(index) * Math.PI * 2;
        const distance = 120 + noise(index + 100) * 220;
        const size = 5 + noise(index + 200) * 7;
        const round = noise(index + 300) > 0.6;
        return (
          <motion.span
            key={index}
            className="absolute top-[38%] left-1/2"
            style={{ width: size, height: round ? size : size * 0.45, borderRadius: round ? "50%" : 2, background: colors[index % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: [0, Math.sin(angle) * distance * 0.7, Math.sin(angle) * distance * 0.7 + 160],
              opacity: [1, 1, 0],
              rotate: (noise(index + 400) - 0.5) * 720,
              scale: 1,
            }}
            transition={{ duration: 1.8 + noise(index + 500) * 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          />
        );
      })}
    </div>
  );
}

/** Trophy line art that draws itself in. */
export function TrophyMark({ size = 72 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
      fill="none"
      stroke="url(#trophy-gold)"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="trophy-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde7b0" />
          <stop offset="1" stopColor="#d49a35" />
        </linearGradient>
      </defs>
      <path className="draw-stroke" style={{ ["--len" as string]: 160 }} d="M20 10h24v14a12 12 0 0 1-24 0z" />
      <path className="draw-stroke" style={{ ["--len" as string]: 60 }} d="M20 14h-7a7 7 0 0 0 7 11M44 14h7a7 7 0 0 1-7 11" />
      <path className="draw-stroke" style={{ ["--len" as string]: 60 }} d="M32 36v9M24 54h16M26 54l2-9h8l2 9" />
      <path className="draw-stroke" style={{ ["--len" as string]: 40, animationDelay: "0.9s" }} d="m28 19 3 3 6-6" stroke="#f5f0e6" />
    </motion.svg>
  );
}

/** Two halves of a balance for a drawn game. */
export function DrawMark({ size = 72 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="#d9d2c4"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <path className="draw-stroke" style={{ ["--len" as string]: 120 }} d="M32 10v44M20 54h24" />
      <motion.g animate={{ rotate: [0, 6, -6, 3, 0] }} transition={{ duration: 2.2, delay: 0.6 }} style={{ originX: "32px", originY: "20px" }}>
        <path className="draw-stroke" style={{ ["--len" as string]: 170 }} d="M12 20h40M12 20 6 34a6 6 0 0 0 12 0zM52 20l-6 14a6 6 0 0 0 12 0z" />
      </motion.g>
    </motion.svg>
  );
}
