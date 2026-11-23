"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Modal, useDialogPresence } from "./Dialogs";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { VideoGame, VideoOrientation } from "@/lib/video/drawFrame";
import { estimateVideoSeconds, exportGameVideo, VideoExportError } from "@/lib/video/exportVideo";
import { VIDEO_SPEEDS, type VideoSpeed } from "@/lib/video/timeline";

const KEY_ORIENTATION = "ai-chess.video-orientation";
const KEY_SPEED = "ai-chess.video-speed";
const DEFAULT_SPEED: VideoSpeed = 4;

const ORIENTATIONS: { id: VideoOrientation; label: string; detail: string }[] = [
  { id: "portrait", label: "Phone", detail: "9:16 · 1080×1920" },
  { id: "landscape", label: "Landscape", detail: "16:9 · 1920×1080" },
];
const SPEED_OPTIONS = VIDEO_SPEEDS.map((value) => ({ value, label: `${value}×` }));

/** A device outline with a tiny board inside, matching where the board sits in that layout. */
function LayoutPreview({ orientation, selected }: { orientation: VideoOrientation; selected: boolean }) {
  const portrait = orientation === "portrait";
  const frame = portrait ? { w: 30, h: 52 } : { w: 56, h: 32 };
  const board = portrait ? { x: 5, y: 12, size: 20 } : { x: 6, y: 6, size: 20 };
  const stroke = selected ? "var(--accent)" : "var(--muted)";
  return (
    <motion.svg
      viewBox={`-2 -2 ${frame.w + 4} ${frame.h + 4}`}
      width={portrait ? 34 : 60}
      height={portrait ? 56 : 36}
      aria-hidden="true"
      animate={{ y: selected ? -2 : 0, scale: selected ? 1.08 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <rect x="0" y="0" width={frame.w} height={frame.h} rx="5" fill="rgb(0 0 0 / 0.3)" stroke={stroke} strokeWidth="1.8" />
      {Array.from({ length: 16 }, (_, index) => {
        const cell = board.size / 4;
        const col = index % 4;
        const row = Math.floor(index / 4);
        return (col + row) % 2 === 0 ? (
          <rect key={index} x={board.x + col * cell} y={board.y + row * cell} width={cell} height={cell} fill={stroke} fillOpacity={selected ? 0.8 : 0.45} />
        ) : null;
      })}
      {portrait ? (
        <>
          <rect x="5" y="36" width="20" height="2.5" rx="1.2" fill={stroke} fillOpacity="0.5" />
          <rect x="5" y="41" width="13" height="2.5" rx="1.2" fill={stroke} fillOpacity="0.35" />
        </>
      ) : (
        <>
          <rect x="31" y="8" width="19" height="2.5" rx="1.2" fill={stroke} fillOpacity="0.5" />
          <rect x="31" y="13" width="14" height="2.5" rx="1.2" fill={stroke} fillOpacity="0.35" />
          <rect x="31" y="18" width="16" height="2.5" rx="1.2" fill={stroke} fillOpacity="0.35" />
        </>
      )}
    </motion.svg>
  );
}

type ExportState =
  | { kind: "idle" }
  | { kind: "rendering"; progress: number }
  | { kind: "done"; url: string; filename: string; sizeBytes: number }
  | { kind: "error"; message: string };

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function triggerDownload(url: string, filename: string): void {
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
}

interface VideoExportDialogProps {
  open: boolean;
  onClose: () => void;
  game: VideoGame;
}

export function VideoExportDialog({ open, onClose, game }: VideoExportDialogProps) {
  const mounted = useDialogPresence(open);
  return (
    <Modal open={open} onClose={onClose} labelledBy="video-title">
      {mounted && <VideoExportForm game={game} onClose={onClose} />}
    </Modal>
  );
}

function VideoExportForm({ game, onClose }: { game: VideoGame; onClose: () => void }) {
  const [orientation, setOrientation] = usePersistentState<VideoOrientation>(KEY_ORIENTATION, "portrait");
  const [speed, setSpeed] = usePersistentState<VideoSpeed>(KEY_SPEED, DEFAULT_SPEED);
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const reset = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setState({ kind: "idle" });
  };

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "rendering", progress: 0 });
    try {
      const blob = await exportGameVideo(game, {
        orientation,
        speed,
        signal: controller.signal,
        onProgress: (progress) => setState({ kind: "rendering", progress }),
      });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const filename = `ai-chess-${orientation}-${speed}x-${Date.now()}.mp4`;
      setState({ kind: "done", url, filename, sizeBytes: blob.size });
      triggerDownload(url, filename);
    } catch (error) {
      if (controller.signal.aborted) return setState({ kind: "idle" });
      const message = error instanceof VideoExportError ? error.message : `Video export failed: ${(error as Error).message}`;
      setState({ kind: "error", message });
    } finally {
      abortRef.current = null;
    }
  };

  const busy = state.kind === "rendering";

  return (
    <div>
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <Icon name="video" className="text-accent" />
        <h2 id="video-title" className="font-display text-[26px] leading-none">
          Game video
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="btn-icon ml-auto grid size-11 place-items-center rounded-xl">
          <Icon name="close" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {state.kind === "done" ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="space-y-3 px-5 py-5"
        >
          <video
            src={state.url}
            controls
            playsInline
            muted
            className={`mx-auto max-h-[46dvh] rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10 ${orientation === "portrait" ? "aspect-[9/16]" : "aspect-video w-full"}`}
          />
          <p className="text-center text-[13px] text-muted">
            MP4 · {orientation === "portrait" ? "1080×1920" : "1920×1080"} · {speed}× · {formatMegabytes(state.sizeBytes)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={reset} className="btn-glass min-h-11 rounded-xl font-semibold">
              Make another
            </button>
            <button
              type="button"
              onClick={() => triggerDownload(state.url, state.filename)}
              className="btn-primary flex min-h-11 items-center justify-center gap-1.5 rounded-xl font-bold"
            >
              <Icon name="download" size={18} /> Download
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-5 px-5 py-5">
          <fieldset disabled={busy}>
            <legend className="eyebrow mb-2">Layout</legend>
            <div role="radiogroup" aria-label="Video layout" className="grid grid-cols-2 gap-2">
              {ORIENTATIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={orientation === option.id}
                  onClick={() => setOrientation(option.id)}
                  className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-colors disabled:opacity-50 ${
                    orientation === option.id ? "" : "well hover:bg-white/[0.04]"
                  }`}
                >
                  {orientation === option.id && (
                    <motion.span
                      layoutId="video-layout-pill"
                      className="absolute inset-0 rounded-2xl border border-accent/70 bg-[linear-gradient(180deg,rgb(233_180_76/0.16),rgb(233_180_76/0.03))] shadow-[0_0_30px_-10px_var(--accent)]"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="relative grid h-14 place-items-center">
                    <LayoutPreview orientation={option.id} selected={orientation === option.id} />
                  </span>
                  <span className="relative text-[14px] font-bold">{option.label}</span>
                  <span className="relative font-mono text-[11px] text-muted">{option.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={busy}>
            <legend className="eyebrow mb-2">Speed</legend>
            <Segmented options={SPEED_OPTIONS} value={speed} onChange={setSpeed} label="Video speed" disabled={busy} size="md" />
            <p className="mt-2 text-[13px] text-muted">
              About {formatDuration(estimateVideoSeconds(game, speed))} long. Each model&apos;s real thinking time is sped up {speed}×.
            </p>
          </fieldset>

          {state.kind === "error" && (
            <p className="shake rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-ink-soft" role="alert">
              {state.message}
            </p>
          )}

          {busy ? (
            <div>
              <div
                className="well h-2.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Rendering video"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(state.progress * 100)}
              >
                <div className="progress-shimmer h-full rounded-full shadow-[0_0_14px_var(--accent)] transition-[width] duration-150" style={{ width: `${state.progress * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px] text-muted">
                <span className="flex items-center gap-2">
                  <span className="wave flex h-3.5 items-center gap-[2px]" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  Rendering… <span className="font-mono text-ink tabular-nums">{Math.round(state.progress * 100)}%</span>
                </span>
                <button type="button" onClick={() => abortRef.current?.abort()} className="btn-glass min-h-11 rounded-xl px-4 font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={start} className="btn-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-extrabold">
              <Icon name="video" /> Create video
            </button>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
