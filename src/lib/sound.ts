let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** A short wooden tick synthesised on the fly, so the app ships no audio files. Captures and checks sound sharper. */
export function playMoveSound(kind: "move" | "capture" | "check" | "end"): void {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const frequency = { move: 520, capture: 340, check: 760, end: 440 }[kind];
  const length = kind === "end" ? 0.45 : 0.09;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = kind === "end" ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + length);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === "capture" ? 0.35 : 0.22, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + length + 0.02);
}
