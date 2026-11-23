import type { ProviderId } from "@/lib/players";

export interface ProviderStyle {
  /** Flat fill, used by the video renderer. */
  background: string;
  /** Two-stop tile gradient for the in-app emblem. */
  gradient: [string, string];
  /** Glow and ring colour while this provider is thinking. */
  glow: string;
  glyph: string;
  color: string;
}

export const PROVIDER_STYLES: Record<ProviderId, ProviderStyle> = {
  claude: { background: "#d97757", gradient: ["#f0a07f", "#c4572f"], glow: "#ff9b6e", glyph: "✳", color: "#fff" },
  codex: { background: "#f4f1ea", gradient: ["#ffffff", "#cfcac0"], glow: "#e9f3ff", glyph: "◎", color: "#111" },
  openrouter: { background: "#6467f2", gradient: ["#8f92ff", "#4144c9"], glow: "#8f92ff", glyph: "⇄", color: "#fff" },
};

export const UNKNOWN_PROVIDER_STYLE: ProviderStyle = {
  background: "#3a3c44",
  gradient: ["#4a4c55", "#2a2c33"],
  glow: "#9c978c",
  glyph: "?",
  color: "#bbb",
};
