"use client";
import { useState, useEffect, useRef } from "react";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, FieldLabel } from "../InputSection";

/**
 * Client & Volume inputs.
 *
 * Two display modes, controlled by `model.volumeDisplay`:
 *   - "monthly-primary" (default) — user enters the monthly volume directly,
 *     matching the engine's native unit.
 *   - "annual-primary" — user enters/sees the annual volume (matching client
 *     RFP figures, e.g. NFCU Table 1: 62,000 / 24,900 / 80,000); the engine
 *     still uses monthly internally so we just convert at the UI boundary.
 *     The monthly equivalent is shown as a small subscript so the rep can
 *     still see the per-month working number.
 */
export function SaasVolumeInputs() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setVolume = useSaasScenario((s) => s.setVolume);
  if (!model) return null;

  const annualPrimary = model.volumeDisplay === "annual-primary";
  const primary = model.volumeInputs.filter((v) => v.type !== "derived");

  return (
    <InputSection
      title="Client & Volume"
      subtitle={annualPrimary
        ? "Annual volume per function (per RFP); monthly shown below for reference"
        : "Pipeline driver"}
      defaultOpen
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {primary.map((v) => {
          const monthly = inputs.volumes[v.id] ?? v.defaultValue;
          if (annualPrimary) {
            return (
              <AnnualVolumeField
                key={v.id}
                id={v.id}
                label={annualLabel(v.label)}
                help={v.help}
                monthly={monthly}
                onChangeMonthly={(m) => setVolume(v.id, m)}
              />
            );
          }
          return (
            <MonthlyVolumeField
              key={v.id}
              id={v.id}
              label={v.label}
              help={v.help}
              value={monthly}
              onChange={(n) => setVolume(v.id, n)}
            />
          );
        })}
      </div>
    </InputSection>
  );
}

// Rewrite "Foo per Month" → "Foo per Year" for the annual-primary display.
// Falls back to the original label when the substring isn't present.
function annualLabel(label: string): string {
  if (/per\s+month/i.test(label)) return label.replace(/per\s+month/i, "per Year");
  if (/\/\s*month/i.test(label)) return label.replace(/\/\s*month/i, " / Year");
  return label + " (Annual)";
}

/**
 * Monthly volume input — the simple case. Just a number input that writes
 * straight to the engine's monthly volume.
 */
function MonthlyVolumeField({
  label, help, value, onChange,
}: {
  id: string; label: string; help?: string;
  value: number; onChange: (n: number) => void;
}) {
  return (
    <div>
      <FieldLabel label={label} help={help} />
      <SimpleNumberInput value={value} onChange={onChange} />
    </div>
  );
}

/**
 * Annual volume input — shows the annual number, converts to/from monthly
 * for the engine. Includes a small "≈ X / month" subscript so the rep can
 * sanity-check the per-month working figure.
 *
 * Conversion: annual = monthly × 12. On commit we divide by 12 (rounded) to
 * derive the monthly value stored in the engine.
 */
function AnnualVolumeField({
  label, help, monthly, onChangeMonthly,
}: {
  id: string; label: string; help?: string;
  monthly: number; onChangeMonthly: (m: number) => void;
}) {
  const annualValue = Math.round(monthly * 12);
  return (
    <div>
      <FieldLabel label={label} help={help} />
      <SimpleNumberInput
        value={annualValue}
        onChange={(annual) => {
          // Store as monthly (engine's native unit). Round to nearest int.
          const m = Math.max(0, Math.round(annual / 12));
          onChangeMonthly(m);
        }}
        step={1000}
      />
      <div className="text-xs text-slate-500 mt-1">
        ≈ <strong>{monthly.toLocaleString()}</strong> per month (used in calculations)
      </div>
    </div>
  );
}

/**
 * Lightweight number input used here so we keep the same look as the rest
 * of the calculator without pulling in the full NumberInput's text-buffer
 * behavior (these are simple integer fields).
 */
function SimpleNumberInput({
  value, onChange, step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <div className="flex items-stretch border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-orange/40 bg-editable">
      <input
        type="text"
        inputMode="numeric"
        className="w-full px-2 py-1.5 text-sm outline-none bg-editable"
        value={text}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => {
          focused.current = false;
          const n = Number(text.replace(/[^0-9.-]/g, ""));
          if (Number.isFinite(n)) {
            onChange(Math.max(0, Math.round(n)));
            setText(String(Math.max(0, Math.round(n))));
          } else {
            setText(String(value));
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow only digits + optional decimal point + optional minus.
          if (!/^-?\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          if (raw === "" || raw === "-") {
            onChange(0);
          } else {
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(Math.max(0, n));
          }
        }}
        step={step}
      />
    </div>
  );
}
