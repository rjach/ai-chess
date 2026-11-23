"use client";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useId, useState } from "react";
import { Icon } from "./Icon";
import { ModelCombobox } from "./ModelCombobox";
import { ProviderAvatar } from "./ProviderAvatar";
import { Segmented } from "./Segmented";
import { useOpenRouterModels, type ProvidersState } from "@/hooks/useProviders";
import {
  DEFAULT_OPENROUTER_MODEL,
  EFFORT_LEVELS,
  MODEL_ID_PATTERN,
  PROVIDER_IDS,
  PROVIDERS,
  sideLabel,
  type PlayerConfig,
  type ProviderId,
  type Side,
} from "@/lib/players";
import { PROVIDER_STYLES } from "@/lib/providerStyle";

export const MOVE_DELAYS = [
  { ms: 0, label: "Instant" },
  { ms: 600, label: "0.6s" },
  { ms: 1500, label: "1.5s" },
  { ms: 3000, label: "3s" },
] as const;

const EFFORT_OPTIONS = EFFORT_LEVELS.map((level) => ({ value: level, label: level }));
const DELAY_OPTIONS = MOVE_DELAYS.map((delay) => ({ value: delay.ms as number, label: delay.label }));
const SWAP_TRAVEL_PX = 56;

export type Readiness = { ready: true } | { ready: false; reason: string };

export function playerReadiness(player: PlayerConfig, providers: ProvidersState, hasOpenRouterKey: boolean): Readiness {
  if (player.provider === "openrouter") {
    const serverKey = providers.kind === "ready" && providers.byId.openrouter.ready;
    if (!hasOpenRouterKey && !serverKey) return { ready: false, reason: "Add an OpenRouter API key in Settings" };
    if (!MODEL_ID_PATTERN.test(player.model)) return { ready: false, reason: "Pick an OpenRouter model" };
    return { ready: true };
  }
  if (providers.kind === "loading") return { ready: false, reason: "Checking sign-in…" };
  if (providers.kind === "error") return { ready: false, reason: providers.message };
  const status = providers.byId[player.provider];
  if (!status.ready) return { ready: false, reason: `${PROVIDERS[player.provider].label}: ${status.detail}${status.fixHint ? `. ${status.fixHint}` : ""}` };
  if (!player.model) return { ready: false, reason: "Pick a model" };
  return { ready: true };
}

export function defaultModelFor(provider: ProviderId, providers: ProvidersState): string {
  if (provider === "openrouter") return DEFAULT_OPENROUTER_MODEL;
  return providers.kind === "ready" ? providers.byId[provider].defaultModel : "";
}

export function PawnMark({ side, size = 22 }: { side: Side; size?: number }) {
  const white = side === "white";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2.8a3.2 3.2 0 0 1 2 5.7c1 .6 1.7 1.6 1.7 2.8h-1.4c.4 2.5 1.7 4.5 3.5 5.7v2.3H6.2V17c1.8-1.2 3.1-3.2 3.5-5.7H8.3c0-1.2.7-2.2 1.7-2.8a3.2 3.2 0 0 1 2-5.7zM5.4 20h13.2v1.6H5.4z"
        fill={white ? "#f5f0e6" : "#17181d"}
        stroke={white ? "rgb(0 0 0 / 0.35)" : "rgb(255 255 255 / 0.45)"}
        strokeWidth="0.9"
      />
    </svg>
  );
}

interface PlayerCardProps {
  side: Side;
  player: PlayerConfig;
  providers: ProvidersState;
  readiness: Readiness;
  onChange: (player: PlayerConfig) => void;
}

function PlayerCard({ side, player, providers, readiness, onChange }: PlayerCardProps) {
  const groupId = useId();
  const openRouter = useOpenRouterModels(player.provider === "openrouter");
  const status = providers.kind === "ready" ? providers.byId[player.provider] : null;
  const showWarning = !readiness.ready && providers.kind !== "loading";

  return (
    <section className="card relative overflow-hidden rounded-2xl p-3.5 sm:p-4" aria-labelledby={`${groupId}-title`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-40 blur-2xl transition-colors duration-700"
        style={{ background: PROVIDER_STYLES[player.provider].glow }}
      />
      <header className="relative mb-3 flex items-center gap-2.5">
        <PawnMark side={side} />
        <h3 id={`${groupId}-title`} className="font-display text-[22px] leading-none text-ink">
          {sideLabel(side)}
        </h3>
        <span className={`ml-auto flex items-center gap-1.5 truncate text-[12px] font-medium ${readiness.ready ? "text-signal" : "text-faint"}`}>
          <span className={`size-1.5 shrink-0 rounded-full ${readiness.ready ? "pulse-dot bg-signal" : "bg-faint"}`} aria-hidden="true" />
          {readiness.ready ? "Ready" : player.provider !== "openrouter" && status ? status.detail : "Not ready"}
        </span>
      </header>

      <div role="radiogroup" aria-label={`${sideLabel(side)} provider`} className="relative grid grid-cols-3 gap-1.5">
        {PROVIDER_IDS.map((id) => {
          const selected = player.provider === id;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !selected && onChange({ provider: id, model: defaultModelFor(id, providers), effort: player.effort })}
              className={`relative flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-[12px] leading-tight font-semibold transition-colors sm:text-[13px] ${
                selected ? "text-ink" : "well text-muted hover:text-ink"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId={`${groupId}-provider`}
                  className="absolute inset-0 rounded-xl border"
                  style={{
                    borderColor: PROVIDER_STYLES[id].glow,
                    background: `linear-gradient(180deg, color-mix(in srgb, ${PROVIDER_STYLES[id].glow} 18%, transparent), color-mix(in srgb, ${PROVIDER_STYLES[id].glow} 4%, transparent))`,
                    boxShadow: `0 0 24px -8px ${PROVIDER_STYLES[id].glow}`,
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <motion.span className="relative" animate={{ scale: selected ? 1.12 : 1, rotate: selected ? [0, -8, 6, 0] : 0 }} transition={{ duration: 0.45 }}>
                <ProviderAvatar provider={id} size={24} />
              </motion.span>
              <span className="relative max-w-full truncate">{PROVIDERS[id].shortLabel}</span>
            </motion.button>
          );
        })}
      </div>

      <label className="eyebrow relative mt-4 mb-1.5 block" htmlFor={`${groupId}-model`}>
        Model
      </label>
      {player.provider === "openrouter" ? (
        <ModelCombobox
          key={`${side}-openrouter`}
          label={`${sideLabel(side)} OpenRouter model`}
          value={player.model}
          onChange={(model) => onChange({ ...player, model })}
          options={openRouter.models}
          loading={openRouter.loading}
          error={openRouter.error}
        />
      ) : (
        <select
          id={`${groupId}-model`}
          value={player.model}
          onChange={(event) => onChange({ ...player, model: event.target.value })}
          disabled={!status || status.models.length === 0}
          className="field relative"
        >
          {!status && <option value={player.model}>Loading…</option>}
          {status?.models.length === 0 && <option value="">No models available</option>}
          {status?.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
              {model.hint ? ` · ${model.hint}` : ""}
            </option>
          ))}
        </select>
      )}

      <AnimatePresence initial={false}>
        {PROVIDERS[player.provider].supportsEffort && (
          <motion.div
            key="effort"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative overflow-hidden"
          >
            <span className="eyebrow mt-4 mb-1.5 block" id={`${groupId}-effort`}>
              Thinking effort
            </span>
            <Segmented options={EFFORT_OPTIONS} value={player.effort} onChange={(effort) => onChange({ ...player, effort })} labelledBy={`${groupId}-effort`} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showWarning && (
          <motion.p
            key="warning"
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="relative overflow-hidden rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[13px] leading-snug text-warning"
            role="note"
          >
            {readiness.reason}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

interface SetupPanelProps {
  players: Record<Side, PlayerConfig>;
  providers: ProvidersState;
  hasOpenRouterKey: boolean;
  moveDelayMs: number;
  onDelayChange: (ms: number) => void;
  onChange: (side: Side, player: PlayerConfig) => void;
  onSwap: () => void;
  onStart: () => void;
  onRefreshProviders: () => void;
}

const stagger = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rise = {
  hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
};

export function SetupPanel({ players, providers, hasOpenRouterKey, moveDelayMs, onDelayChange, onChange, onSwap, onStart, onRefreshProviders }: SetupPanelProps) {
  const [scope, animate] = useAnimate();
  const [swaps, setSwaps] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
  const readiness = {
    white: playerReadiness(players.white, providers, hasOpenRouterKey),
    black: playerReadiness(players.black, providers, hasOpenRouterKey),
  };
  const blocker = !readiness.white.ready ? readiness.white : !readiness.black.ready ? readiness.black : null;

  // Each card arrives from the other card's slot, so the swap reads as the two players trading places.
  const swap = () => {
    onSwap();
    setSwaps((count) => count + 1);
    animate("[data-card='white']", { y: [SWAP_TRAVEL_PX, 0], opacity: [0.2, 1], scale: [0.96, 1] }, { type: "spring", stiffness: 260, damping: 22 });
    animate("[data-card='black']", { y: [-SWAP_TRAVEL_PX, 0], opacity: [0.2, 1], scale: [0.96, 1] }, { type: "spring", stiffness: 260, damping: 22 });
  };

  return (
    <motion.div className="flex h-full flex-col" variants={stagger} initial="hidden" animate="shown">
      <motion.div variants={rise} className="flex items-start gap-2 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <p className="eyebrow">New match</p>
          <h2 className="font-display mt-1 text-[34px] leading-[0.95] tracking-tight">
            Set the <em className="text-accent">board.</em>
          </h2>
        </div>
        <motion.button
          type="button"
          onClick={() => {
            setRefreshes((count) => count + 1);
            onRefreshProviders();
          }}
          animate={{ rotate: refreshes * 360 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="btn-icon ml-auto grid size-11 shrink-0 place-items-center rounded-xl"
          aria-label="Re-check CLI sign-in"
          title="Re-check CLI sign-in"
        >
          <Icon name="refresh" size={18} />
        </motion.button>
      </motion.div>

      <div ref={scope} className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
        <motion.div variants={rise} data-card="white">
          <PlayerCard side="white" player={players.white} providers={providers} readiness={readiness.white} onChange={(player) => onChange("white", player)} />
        </motion.div>

        <motion.div variants={rise} className="relative z-10 -my-3 flex items-center justify-center">
          <motion.button
            type="button"
            onClick={swap}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: swaps * 180 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="group grid size-12 place-items-center rounded-full border border-line-strong bg-[radial-gradient(circle_at_30%_25%,#2a2d36,#101116)] text-ink shadow-[0_8px_24px_-6px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]"
            aria-label="Swap sides"
            title="Swap sides"
          >
            <span className="font-display text-[19px] italic group-hover:hidden">vs</span>
            <Icon name="swap" size={18} className="hidden text-accent group-hover:block" />
          </motion.button>
        </motion.div>

        <motion.div variants={rise} data-card="black">
          <PlayerCard side="black" player={players.black} providers={providers} readiness={readiness.black} onChange={(player) => onChange("black", player)} />
        </motion.div>

        <motion.div variants={rise} className="pt-4">
          <span className="eyebrow mb-1.5 block" id="delay-label">
            Pause between moves
          </span>
          <Segmented options={DELAY_OPTIONS} value={moveDelayMs} onChange={onDelayChange} labelledBy="delay-label" />
        </motion.div>
      </div>

      <motion.div variants={rise} className="border-t border-line p-3 sm:p-4">
        <motion.button
          type="button"
          onClick={onStart}
          disabled={Boolean(blocker)}
          whileTap={blocker ? undefined : { scale: 0.97 }}
          className="btn-primary group flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[19px] font-extrabold tracking-tight"
        >
          <Icon name="bolt" size={20} />
          Start match
          <Icon name="arrowRight" size={20} className="transition-transform duration-300 group-hover:translate-x-1.5" />
        </motion.button>
        <AnimatePresence>
          {blocker && !blocker.ready && providers.kind !== "loading" && (
            <motion.p
              key={blocker.reason}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center text-[13px] text-muted"
            >
              {blocker.reason}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
