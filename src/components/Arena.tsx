"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Backdrop } from "./Backdrop";
import { BoardView } from "./BoardView";
import { GameOverDialog, SettingsDialog } from "./Dialogs";
import { GamePanel } from "./GamePanel";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { MatchIntro } from "./MatchIntro";
import { PlayerBar } from "./PlayerBar";
import { MOVE_DELAYS, SetupPanel, defaultModelFor } from "./SetupPanel";
import { VideoExportDialog } from "./VideoExportDialog";
import { useMatchRunner } from "@/hooks/useMatchRunner";
import { useIsClient, usePersistentState } from "@/hooks/usePersistentState";
import { useProviders } from "@/hooks/useProviders";
import { modelLabel } from "@/lib/labels";
import {
  DEFAULT_PLAYERS,
  START_FEN,
  buildPgn,
  initialMatch,
  matchReducer,
  materialFromFen,
  playerName,
  sideToMove,
  totalThinkMs,
  type GameResult,
} from "@/lib/match";
import { otherSide, type PlayerConfig, type Side } from "@/lib/players";
import { PROVIDER_STYLES } from "@/lib/providerStyle";
import { playMoveSound } from "@/lib/sound";

const KEY_PLAYERS = "ai-chess.players";
const KEY_OPENROUTER = "ai-chess.openrouter-key";
const KEY_DELAY = "ai-chess.move-delay";
const KEY_SOUND = "ai-chess.sound";

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

export function Arena() {
  const [state, dispatch] = useReducer(matchReducer, undefined, () => initialMatch());
  const { providers, refresh } = useProviders();
  const isClient = useIsClient();
  const [savedPlayers, setSavedPlayers] = usePersistentState<Record<Side, PlayerConfig>>(KEY_PLAYERS, DEFAULT_PLAYERS);
  const [openRouterKey, setOpenRouterKey] = usePersistentState(KEY_OPENROUTER, "");
  const [moveDelayMs, setMoveDelayMs] = usePersistentState<number>(KEY_DELAY, MOVE_DELAYS[1].ms);
  const [soundOn, setSoundOn] = usePersistentState(KEY_SOUND, true);
  const [orientation, setOrientation] = useState<Side>("white");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissedResult, setDismissedResult] = useState<GameResult | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [introRun, setIntroRun] = useState<number | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!isClient || restoredRef.current) return;
    restoredRef.current = true;
    dispatch({ type: "configure", side: "white", player: savedPlayers.white });
    dispatch({ type: "configure", side: "black", player: savedPlayers.black });
  }, [isClient, savedPlayers]);

  useEffect(() => {
    if (restoredRef.current) setSavedPlayers(state.players);
  }, [state.players, setSavedPlayers]);

  // A saved or default model can disappear from a CLI's list (plan change, CLI update); fall back to that provider's default.
  useEffect(() => {
    if (providers.kind !== "ready" || state.status !== "setup") return;
    for (const side of ["white", "black"] as const) {
      const player = state.players[side];
      if (player.provider === "openrouter") continue;
      const known = providers.byId[player.provider].models.some((model) => model.id === player.model);
      const fallback = defaultModelFor(player.provider, providers);
      if (!known && fallback) dispatch({ type: "configure", side, player: { ...player, model: fallback } });
    }
  }, [providers, state.players, state.status]);

  useMatchRunner(state, dispatch, { moveDelayMs, openRouterKey });

  const lastMove = state.moves.at(-1);
  useEffect(() => {
    if (!soundOn || !lastMove) return;
    playMoveSound(lastMove.san.includes("#") ? "end" : lastMove.san.includes("+") ? "check" : lastMove.san.includes("x") ? "capture" : "move");
  }, [lastMove, soundOn]);

  const names = useMemo(
    () => ({
      white: playerName(state.players.white, modelLabel(state.players.white, providers)),
      black: playerName(state.players.black, modelLabel(state.players.black, providers)),
    }),
    [state.players, providers],
  );

  const videoGame = useMemo(
    () => ({
      moves: state.moves,
      players: state.players,
      modelLabels: { white: modelLabel(state.players.white, providers), black: modelLabel(state.players.black, providers) },
      result: state.result,
      boardOrientation: orientation,
    }),
    [state.moves, state.players, state.result, providers, orientation],
  );
  const openVideo = () => {
    setDismissedResult(state.result);
    setVideoOpen(true);
  };

  const viewedPly = state.viewPly ?? state.moves.length - 1;
  const viewedFen = viewedPly >= 0 ? state.moves[viewedPly].fenAfter : START_FEN;
  const viewedMove = viewedPly >= 0 ? state.moves[viewedPly] : null;
  const material = useMemo(() => materialFromFen(viewedFen), [viewedFen]);
  const turn = sideToMove(state);
  const inGame = state.status !== "setup";

  const view = useCallback((ply: number | null) => dispatch({ type: "view", ply }), []);
  const endIntro = useCallback(() => setIntroRun(null), []);
  const startMatch = () => {
    dispatch({ type: "start" });
    setIntroRun((run) => (run ?? 0) + 1);
  };
  const thinkingGlow = PROVIDER_STYLES[state.players[turn].provider].glow;
  const boardLive = state.status === "playing" && state.thinkingSince !== null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || state.moves.length === 0) return;
      if (event.key === "ArrowLeft") view(Math.max(0, viewedPly - 1));
      else if (event.key === "ArrowRight") view(viewedPly + 1);
      else if (event.key === "Home") view(0);
      else if (event.key === "End") view(null);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, viewedPly, state.moves.length]);

  const pgn = () => buildPgn(state, names);
  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgn());
      return true;
    } catch {
      return false;
    }
  };
  const downloadPgn = () => {
    const url = URL.createObjectURL(new Blob([pgn()], { type: "application/x-chess-pgn" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `ai-chess-${Date.now()}.pgn` });
    link.click();
    URL.revokeObjectURL(url);
  };

  const bar = (side: Side) => (
    <PlayerBar
      side={side}
      player={state.players[side]}
      modelLabel={modelLabel(state.players[side], providers)}
      captured={material.captured[side]}
      materialLead={side === "white" ? material.balance : -material.balance}
      thinkMs={totalThinkMs(state.moves, side)}
      thinkingSince={state.thinkingSince}
      active={state.status === "playing" && turn === side}
      isWinner={state.result?.winner === side}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <div className="flex min-h-dvh flex-col">
        <motion.header
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="sticky top-0 z-20 flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-line bg-[rgb(6_7_9/0.6)] px-[max(var(--gutter),env(safe-area-inset-left))] backdrop-blur-xl"
        >
          <Logo size={34} />
          <h1 className="flex min-w-0 items-baseline gap-1.5 truncate">
            <span className="text-[15px] font-bold tracking-tight text-ink-soft uppercase">AI Chess</span>
            <span className="font-display text-[26px] leading-none text-accent italic">Arena</span>
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSoundOn(!soundOn)}
              aria-label={soundOn ? "Mute move sounds" : "Unmute move sounds"}
              aria-pressed={!soundOn}
              className="btn-icon grid size-11 place-items-center overflow-hidden rounded-xl"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={soundOn ? "on" : "off"}
                  initial={{ y: 16, opacity: 0, rotate: -20 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: -16, opacity: 0, rotate: 20 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="grid place-items-center"
                >
                  <Icon name={soundOn ? "volume" : "mute"} />
                </motion.span>
              </AnimatePresence>
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="btn-icon group flex min-h-11 items-center gap-2 rounded-xl px-3">
              <Icon name="gear" className="transition-transform duration-700 ease-out group-hover:rotate-180" />
              <span className="hidden text-[14px] font-semibold sm:inline">Settings</span>
              {openRouterKey && <span className="pulse-dot size-2 rounded-full bg-signal" aria-label="OpenRouter key saved" />}
            </button>
          </div>
        </motion.header>

        <main className="arena flex-1">
          <motion.section
            className="board-column @container"
            aria-label="Board"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.08 }}
          >
            {bar(otherSide(orientation))}
            <BoardView fen={viewedFen} lastMove={viewedMove} orientation={orientation} live={boardLive} glow={thinkingGlow} history={state.viewPly !== null} />
            {bar(orientation)}
            <AnimatePresence>
              {state.viewPly !== null && (
                <motion.button
                  type="button"
                  onClick={() => view(null)}
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="btn-glass mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[13px] font-semibold"
                >
                  <Icon name="eye" size={15} className="text-accent" />
                  Viewing move {Math.floor(viewedPly / 2) + 1}
                  {viewedPly % 2 ? "…" : "."} <span className="font-mono text-ink">{viewedMove?.san}</span>
                  <span className="text-muted">· Back to live</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.section>

          <motion.aside
            className="side-panel glass overflow-hidden rounded-3xl"
            aria-label={inGame ? "Match" : "Match setup"}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 24, delay: 0.16 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={inGame ? "game" : "setup"}
                className="h-full"
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                transition={{ duration: 0.25 }}
              >
                {inGame ? (
                  <GamePanel
                    state={state}
                    names={names}
                    onView={view}
                    onPause={() => dispatch({ type: "pause" })}
                    onResume={() => dispatch({ type: "resume" })}
                    onEnd={() => dispatch({ type: "end", result: { winner: null, reason: "stopped by you", stopped: true } })}
                    onNewGame={() => dispatch({ type: "new-game" })}
                    onFlip={() => setOrientation(otherSide)}
                    onCopyPgn={copyPgn}
                    onDownloadPgn={downloadPgn}
                    onVideo={openVideo}
                  />
                ) : (
                  <SetupPanel
                    players={state.players}
                    providers={providers}
                    hasOpenRouterKey={Boolean(openRouterKey)}
                    moveDelayMs={moveDelayMs}
                    onDelayChange={setMoveDelayMs}
                    onChange={(side, player) => dispatch({ type: "configure", side, player })}
                    onSwap={() => dispatch({ type: "swap-players" })}
                    onStart={startMatch}
                    onRefreshProviders={refresh}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </main>

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          openRouterKey={openRouterKey}
          onSaveKey={setOpenRouterKey}
          soundOn={soundOn}
          onSoundChange={setSoundOn}
        />
        <GameOverDialog
          open={state.result !== null && state.result !== dismissedResult}
          onClose={() => setDismissedResult(state.result)}
          result={state.result}
          players={state.players}
          names={names}
          moveCount={state.moves.length}
          onRematch={startMatch}
          onSwapRematch={() => {
            dispatch({ type: "swap-players" });
            startMatch();
          }}
          onNewSetup={() => dispatch({ type: "new-game" })}
          onVideo={openVideo}
        />
        <VideoExportDialog open={videoOpen} onClose={() => setVideoOpen(false)} game={videoGame} />
        <AnimatePresence>{introRun !== null && <MatchIntro key={introRun} players={state.players} names={names} onDone={endIntro} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}
