"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { ModelOption } from "@/lib/players";

const MAX_VISIBLE_OPTIONS = 60;

interface ModelComboboxProps {
  value: string;
  onChange: (id: string) => void;
  options: ModelOption[];
  loading: boolean;
  error: string | null;
  label: string;
}

/** Searchable picker over OpenRouter's few hundred models; any typed id is accepted so new models work before the list refreshes. */
export function ModelCombobox({ value, onChange, options, loading, error, label }: ModelComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? options.filter((option) => `${option.id} ${option.label}`.toLowerCase().includes(needle)) : options;
    return filtered.slice(0, MAX_VISIBLE_OPTIONS);
  }, [options, query]);

  const choose = (id: string) => {
    setQuery(id);
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[highlight] ? `${listId}-${highlight}` : undefined}
        value={query}
        placeholder={loading ? "Loading models…" : "Search, e.g. deepseek or openai/gpt-4o"}
        autoComplete="off"
        spellCheck={false}
        className="field"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (query.trim() !== value) onChange(query.trim());
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlight((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(open && matches[highlight] ? matches[highlight].id : query.trim());
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="fade-in absolute z-30 mt-1.5 max-h-[min(300px,45dvh)] w-full overflow-y-auto rounded-xl border border-line-strong bg-panel-solid/95 p-1 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl"
        >
          {matches.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-1.5 transition-colors ${index === highlight ? "bg-white/[0.08] shadow-[inset_2px_0_0_var(--accent)]" : ""}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option.id);
              }}
            >
              <span className="truncate text-[14px] text-ink">{option.label}</span>
              <span className="flex gap-2 truncate text-[12px] text-muted">
                <span className="truncate">{option.id}</span>
                {option.hint && <span className={`shrink-0 ${option.hint.startsWith("Decisions") ? "text-signal" : "text-faint"}`}>{option.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-[12px] text-warning">{error}. You can still type a model id.</p>}
    </div>
  );
}
