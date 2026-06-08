"use client";
import { useState, useEffect, useRef, ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional callout (e.g., why this section matters). */
  callout?: ReactNode;
};

export function InputSection({ title, subtitle, defaultOpen = true, children, callout }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition no-print"
      >
        <div>
          <h3 className="text-base font-bold text-navy">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-slate-400 text-lg">{open ? "−" : "+"}</span>
      </button>
      <div className="px-5 pt-2 pb-5 hidden print:block">
        <h3 className="text-base font-bold text-navy">{title}</h3>
      </div>
      {(open) && (
        <div className="px-5 pb-5">
          {callout && (
            <div className="mb-4 text-sm bg-orange/10 border-l-4 border-orange text-navy/90 rounded px-3 py-2">
              {callout}
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

export function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {help && (
        <span className="text-slate-400 text-[10px] cursor-help" title={help}>ⓘ</span>
      )}
    </div>
  );
}

/**
 * NumberInput keeps a local text buffer while the field is focused, so backspacing
 * never produces a stray leading 0. When the user blurs (tab/click out), the value
 * is normalized and committed back to the parent via onChange.
 */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [text, setText] = useState<string>(formatForInput(value));
  const focused = useRef(false);

  // Keep local text in sync when the external value changes and the field isn't focused.
  useEffect(() => {
    if (!focused.current) setText(formatForInput(value));
  }, [value]);

  const commit = (s: string) => {
    if (s === "" || s === "-" || s === ".") {
      onChange(0);
      setText("");
      return;
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return;
    onChange(n);
    setText(formatForInput(n));
  };

  return (
    <div className="flex items-stretch border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-orange/40 bg-editable">
      {prefix && <span className="px-2 flex items-center bg-slate-50 text-slate-500 text-sm border-r border-slate-200">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        className="w-full px-2 py-1.5 text-sm outline-none bg-editable"
        value={text}
        step={step}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => { focused.current = false; commit(text); }}
        onChange={(e) => {
          // Allow only digits, one decimal, optional leading minus.
          const raw = e.target.value;
          if (!/^-?\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          // Live-update parent so calcs stay reactive, but don't reformat the text.
          if (raw === "" || raw === "-" || raw === ".") {
            onChange(0);
          } else {
            const n = Number(raw);
            if (Number.isFinite(n)) {
              const clamped = clamp(n, min, max);
              onChange(clamped);
            }
          }
        }}
      />
      {suffix && <span className="px-2 flex items-center bg-slate-50 text-slate-500 text-sm border-l border-slate-200">{suffix}</span>}
    </div>
  );
}

export function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  // Internal value is 0..1; display value is 0..100.
  const [text, setText] = useState<string>(formatForInput(roundForPct(value * 100)));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatForInput(roundForPct(value * 100)));
  }, [value]);

  return (
    <div className="flex items-stretch border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-orange/40 bg-editable">
      <input
        type="text"
        inputMode="decimal"
        className="w-full px-2 py-1.5 text-sm outline-none bg-editable"
        value={text}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => {
          focused.current = false;
          if (text === "" || text === "." || text === "-") {
            onChange(0);
            setText("0");
            return;
          }
          const n = Number(text);
          if (Number.isFinite(n)) {
            const clamped = clamp(n, 0, 100);
            onChange(clamped / 100);
            setText(formatForInput(roundForPct(clamped)));
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          if (raw === "" || raw === ".") {
            onChange(0);
          } else {
            const n = Number(raw);
            if (Number.isFinite(n)) {
              onChange(clamp(n, 0, 100) / 100);
            }
          }
        }}
      />
      <span className="px-2 flex items-center bg-slate-50 text-slate-500 text-sm border-l border-slate-200">%</span>
    </div>
  );
}

function formatForInput(n: number): string {
  if (!Number.isFinite(n)) return "0";
  // Trim trailing zeros / unnecessary decimals.
  if (Number.isInteger(n)) return String(n);
  return String(+n.toFixed(4));
}

function roundForPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (typeof min === "number" && v < min) v = min;
  if (typeof max === "number" && v > max) v = max;
  return v;
}
