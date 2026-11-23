"use client";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

interface SegmentedProps<T extends string | number> {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** Radio group drawn as a track with a pill that glides to the selected option. */
export function Segmented<T extends string | number>({ options, value, onChange, label, labelledBy, disabled, size = "sm" }: SegmentedProps<T>) {
  const pillId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className="well grid gap-1 rounded-xl p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative rounded-lg font-semibold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              size === "md" ? "min-h-11 text-[15px]" : "min-h-9 text-[13px]"
            } ${selected ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg bg-[linear-gradient(180deg,rgb(255_255_255/0.14),rgb(255_255_255/0.06))] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_4px_12px_-4px_rgb(0_0_0/0.6)]"
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
