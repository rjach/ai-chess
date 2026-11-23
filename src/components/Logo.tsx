"use client";
import { motion } from "motion/react";

/** Brand mark: a 2×2 checker turned on its point. The squares breathe in sequence; hover spins it a quarter turn. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      whileHover={{ rotate: 90 }}
      transition={{ type: "spring", stiffness: 220, damping: 16 }}
    >
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe0a0" />
          <stop offset="1" stopColor="#d49a35" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 20 20)">
        <rect x="7" y="7" width="12.5" height="12.5" rx="2.5" fill="url(#logo-gold)" className="logo-square" />
        <rect x="20.5" y="7" width="12.5" height="12.5" rx="2.5" fill="#f5f0e6" fillOpacity="0.16" className="logo-square" style={{ animationDelay: "0.4s" }} />
        <rect x="20.5" y="20.5" width="12.5" height="12.5" rx="2.5" fill="url(#logo-gold)" className="logo-square" style={{ animationDelay: "0.8s" }} />
        <rect x="7" y="20.5" width="12.5" height="12.5" rx="2.5" fill="#f5f0e6" fillOpacity="0.16" className="logo-square" style={{ animationDelay: "1.2s" }} />
      </g>
    </motion.svg>
  );
}
