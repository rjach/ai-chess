const PATHS = {
  play: "M7 4.5v15l12-7.5z",
  pause: "M7 4h3.5v16H7zM13.5 4H17v16h-3.5z",
  first: "M6 5h2v14H6zM19 5v14l-9-7z",
  prev: "M16 5v14l-9-7z",
  next: "M8 5v14l9-7z",
  last: "M16 5h2v14h-2zM5 5v14l9-7z",
  flip: "M7 3 3 7l4 4V8h11V6H7zM17 13v3H6v2h11v3l4-4z",
  swap: "M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7zM17 17H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11z",
  gear: "M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.9a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
  copy: "M8 3h11v13h-2V5H8zM5 7h10v14H5z",
  download: "M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM4 18h16v2H4z",
  stop: "M6 6h12v12H6z",
  video: "M4 6h11a1 1 0 0 1 1 1v3.5l5-3.5v10l-5-3.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  volume: "M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 6a8.5 8.5 0 0 1 0 12L17 16.6a6.5 6.5 0 0 0 0-9.2z",
  mute: "M4 9h4l5-4v14l-5-4H4zM16.3 9.7l1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z",
  close: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z",
  refresh: "M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h7V4z",
  eye: "M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  arrowRight: "M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z",
  crown: "M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5zM5 19.5h14V21H5z",
  bolt: "M13 2 4.5 13.5H11L10 22l8.5-11.5H12z",
  eyeOff: "M3.3 2 2 3.3l3.2 3.2C3.6 7.8 2.5 9.6 2 11c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.6-1.2l4.1 4.1L22 19.6zM12 6c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.3 3.5L8.8 6.5A10 10 0 0 1 12 6z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
