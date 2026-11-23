"use client";
import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { defaultPieces } from "react-chessboard";
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, getFirstEncodableVideoCodec } from "mediabunny";
import { VIDEO_LAYOUTS, drawFrame, type PieceImages, type VideoGame, type VideoOrientation } from "./drawFrame";
import { buildTimeline, frameAt, type VideoSpeed } from "./timeline";

export const VIDEO_FPS = 30;
const PIECE_RASTER_SIZE = 256;
/** Yield to the browser this often so the progress bar repaints and Cancel stays clickable. */
const FRAMES_PER_YIELD = 15;

export interface VideoExportOptions {
  orientation: VideoOrientation;
  speed: VideoSpeed;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

export class VideoExportError extends Error {}

/**
 * Renders react-chessboard's own piece components to SVG strings and loads them as images,
 * so the video uses exactly the pieces shown on the in-app board.
 */
async function loadPieceImages(): Promise<PieceImages> {
  const host = document.createElement("div");
  const root = createRoot(host);
  const keys = Object.keys(defaultPieces);
  flushSync(() => {
    root.render(createElement(Fragment, null, ...keys.map((key) => createElement("div", { key, "data-piece": key }, defaultPieces[key]()))));
  });
  const markup = new Map(keys.map((key) => [key, host.querySelector(`[data-piece="${key}"]`)?.innerHTML ?? ""]));
  root.unmount();

  const entries = await Promise.all(
    keys.map(async (key) => {
      const svg = markup.get(key)!.replace('width="100%"', `width="${PIECE_RASTER_SIZE}"`).replace('height="100%"', `height="${PIECE_RASTER_SIZE}"`);
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return [key, await createImageBitmap(image)] as const;
      } finally {
        URL.revokeObjectURL(url);
      }
    }),
  );
  return Object.fromEntries(entries);
}

function bodyFontFamily(): string {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

export function estimateVideoSeconds(game: VideoGame, speed: VideoSpeed): number {
  return buildTimeline(game.moves, speed).totalSeconds;
}

/**
 * Replays a finished game into an MP4 entirely in the browser.
 * Frames are drawn from the move record and encoded with WebCodecs, so export runs faster than real time
 * and needs no screen-capture permission.
 *
 * @returns The MP4 file as a Blob
 * @throws VideoExportError when the browser cannot encode video; DOMException "AbortError" when cancelled
 */
export async function exportGameVideo(game: VideoGame, { orientation, speed, onProgress, signal }: VideoExportOptions): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    throw new VideoExportError("This browser cannot encode video. Use a recent Chrome, Edge, Safari or Firefox.");
  }
  const layout = VIDEO_LAYOUTS[orientation];
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: layout.width, height: layout.height });
  if (!codec) throw new VideoExportError(`This browser cannot encode ${layout.width}×${layout.height} video.`);

  await document.fonts.ready;
  const pieces = await loadPieceImages();
  const canvas = new OffscreenCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new VideoExportError("Could not create a drawing surface for the video.");

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  await output.start();

  const timeline = buildTimeline(game.moves, speed);
  const frameCount = Math.ceil(timeline.totalSeconds * VIDEO_FPS);
  const draw = { ctx, layout, game, pieces, fontFamily: bodyFontFamily(), speed };

  try {
    for (let index = 0; index < frameCount; index++) {
      if (signal.aborted) throw new DOMException("Video export cancelled", "AbortError");
      const time = index / VIDEO_FPS;
      drawFrame(draw, frameAt(timeline, time));
      await source.add(time, 1 / VIDEO_FPS);
      if (index % FRAMES_PER_YIELD === 0) {
        onProgress(index / frameCount);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    Object.values(pieces).forEach((bitmap) => (bitmap as ImageBitmap).close());
  }

  onProgress(1);
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new VideoExportError("The encoder finished without producing a file.");
  return new Blob([buffer], { type: output.format.mimeType });
}
