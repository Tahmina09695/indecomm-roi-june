"use client";
import { useScenario } from "@/store/scenarioStore";
import { InputSection, FieldLabel, NumberInput, PercentInput } from "./InputSection";
import { computeRoi } from "@/lib/engine";
import { fmtCurrency, fmtFTE } from "@/lib/format";

/**
 * Retained In-house Staff (post-outsourcing) section.
 * Only rendered when the active model declares a `retention` config.
 *
 * Even when the section is rendered, the retention COST is only added to
 * "post-outsourcing total" when the user flips the toggle ON.
 */
export function RetentionInputs() {
  const model = useScenario((s) => s.model);
  const inputs = useScenario((s) => s.inputs);
  const setRetention = useScenario((s) => s.setRetention);

  if (!model || !model.retention) return null;
  const r = computeRoi(model, inputs);

  const enabled = inputs.retention?.enabled ?? false;
  const pct = inputs.retention?.retentionPct ?? model.retention.defaultRetentionPct;
  const sups = inputs.retention?.retainedSupervisors ?? model.retention.defaultRetainedSupervisors;

  return (
    <InputSection
      title="Retained In-house Staff (post-outsourcing)"
      subtitle="Optional — include the team your client keeps in-house for oversight"
      defaultOpen={enabled}
      callout={
        <div>
          <strong>Why this matters:</strong> {model.retention.help ?? "Many clients keep a small team in-house even after outsourcing — typically for exception management and vendor oversight. Toggle this on to include those retained costs in the post-outsourcing comparison."}
        </div>
      }
    >
      {/* Master toggle */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-navy">Include retained in-house staff?</div>
          <div className="text-xs text-slate-500 mt-0.5">
            When ON, the post-outsourcing total = Indecomm fee + retained-staff cost.
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setRetention({ enabled: e.target.checked })}
            className="h-5 w-5 accent-orange"
          />
          <span className={enabled ? "text-orange font-semibold text-sm" : "text-slate-500 text-sm"}>
            {enabled ? "ON" : "OFF"}
          </span>
        </label>
      </div>

      <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel
              label="Retained Team %"
              help="Percent of the original volume-driven team (auditors, follow-up, exception, mailroom) that stays in-house after outsourcing."
            />
            <PercentInput
              value={pct}
              onChange={(n) => setRetention({ retentionPct: n })}
            />
          </div>
          <div>
            <FieldLabel
              label="Retained Supervisors / Managers"
              help="Fixed count of supervisors / managers retained for vendor oversight (independent of retention %)."
            />
            <NumberInput
              value={sups}
              onChange={(n) => setRetention({ retainedSupervisors: n })}
              min={0}
              step={1}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Retained Team FTEs</div>
            <div className="text-lg font-bold text-navy">{fmtFTE(r.retention.retainedTeamFte)}</div>
            <div className="text-xs text-slate-500 mt-0.5">+ {sups} supervisor{sups === 1 ? "" : "s"}</div>
          </div>
          <div className="bg-orange/10 border-2 border-orange rounded-md p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-orange">Retained-Staff Annual Cost</div>
            <div className="text-lg font-bold text-navy">{fmtCurrency(r.retention.totalAnnual)}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Direct + supervisor + benefits + pro-rated indirect
            </div>
          </div>
        </div>
      </div>
    </InputSection>
  );
}
