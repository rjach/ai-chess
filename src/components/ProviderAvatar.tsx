import type { ProviderId } from "@/lib/players";
import { PROVIDER_STYLES, UNKNOWN_PROVIDER_STYLE } from "@/lib/providerStyle";

/** Abstract emblems (not vendor logos), drawn in a 24-unit box. Each has a part that moves while the model thinks. */
function Emblem({ provider, thinking }: { provider: ProviderId | null; thinking: boolean }) {
  switch (provider) {
    case "claude":
      return (
        <g className={thinking ? "emblem-spin" : undefined} style={{ transformOrigin: "12px 12px" }}>
          {Array.from({ length: 8 }, (_, index) => (
            <path key={index} d="M12 3.2c.7 0 1 2.6 1 5.2 0 .9-.4 1.6-1 1.6s-1-.7-1-1.6c0-2.6.3-5.2 1-5.2z" transform={`rotate(${index * 45} 12 12)`} fill="currentColor" />
          ))}
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </g>
      );
    case "codex":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z" strokeOpacity="0.45" />
          <path d="m7.5 10 2.5 2-2.5 2" />
          <path d="M12 14.5h4" className={thinking ? "emblem-blink" : undefined} />
        </g>
      );
    case "openrouter":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M4 8h5c3 0 3 8 6 8h5" className={thinking ? "emblem-flow" : undefined} />
          <path d="M4 16h5c3 0 3-8 6-8h5" className={thinking ? "emblem-flow" : undefined} strokeOpacity="0.6" />
          <circle cx="4" cy="8" r="1.4" fill="currentColor" />
          <circle cx="4" cy="16" r="1.4" fill="currentColor" />
          <path d="m18 5.5 2.5 2.5-2.5 2.5M18 13.5l2.5 2.5-2.5 2.5" strokeWidth="1.6" />
        </g>
      );
    default:
      return (
        <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
          ?
        </text>
      );
  }
}

interface ProviderAvatarProps {
  provider: ProviderId | null;
  size?: number;
  /** Adds a rotating ring and animates the emblem. */
  thinking?: boolean;
}

export function ProviderAvatar({ provider, size = 40, thinking = false }: ProviderAvatarProps) {
  const style = provider ? PROVIDER_STYLES[provider] : UNKNOWN_PROVIDER_STYLE;
  const radius = Math.max(6, size * 0.28);
  return (
    <span aria-hidden="true" className="relative inline-grid shrink-0 select-none" style={{ width: size, height: size, ["--ring" as string]: style.glow }}>
      {thinking && <span className="avatar-ring" style={{ borderRadius: radius + 3 }} />}
      <span
        className="grid place-items-center overflow-hidden"
        style={{
          borderRadius: radius,
          color: style.color,
          background: `linear-gradient(145deg, ${style.gradient[0]}, ${style.gradient[1]})`,
          boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 -2px 4px rgb(0 0 0 / 0.18), 0 6px 16px -6px ${style.glow}`,
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62}>
          <Emblem provider={provider} thinking={thinking} />
        </svg>
      </span>
    </span>
  );
}
