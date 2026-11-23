export const PROVIDER_IDS = ["claude", "codex", "openrouter"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const EFFORT_LEVELS = ["default", "low", "medium", "high"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export type Side = "white" | "black";

export interface PlayerConfig {
  provider: ProviderId;
  model: string;
  effort: Effort;
}

export interface ModelOption {
  id: string;
  label: string;
  hint?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  shortLabel: string;
  supportsEffort: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    supportsEffort: true,
  },
  codex: {
    id: "codex",
    label: "Codex",
    shortLabel: "Codex",
    supportsEffort: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    supportsEffort: false,
  },
};

export const CLAUDE_MODELS: ModelOption[] = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "Fastest" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Balanced" },
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "Strongest" },
  { id: "claude-fable-5-2", label: "Fable 5.2", hint: "Needs usage credits" },
];

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

/** Model ids reach a CLI argv and an HTTP body, so only plain identifier characters are accepted. */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/@-]{1,120}$/;

export function sideLabel(side: Side): string {
  return side === "white" ? "White" : "Black";
}

export function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}
