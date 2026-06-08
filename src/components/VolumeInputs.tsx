"use client";
import { useScenario } from "@/store/scenarioStore";
import { InputSection, FieldLabel, NumberInput, PercentInput } from "./InputSection";

const FUNDED_IDS = new Set(["convFhaVolume", "vaUsdaVolume"]);
const AUDITED_IDS = new Set(["convFhaAudited", "vaUsdaAudited", "totalAudited"]);

export function VolumeInputs() {
  const model = useScenario((s) => s.model);
  const inputs = useScenario((s) => s.inputs);
  const setVolume = useScenario((s) => s.setVolume);
  if (!model) return null;

  const primary = model.volumeInputs.filter((v) => v.type !== "derived");
  const derived = model.volumeInputs.filter((v) => v.type === "derived");
  const fundedDerived = derived.filter((v) => FUNDED_IDS.has(v.id));
  const auditedDerived = derived.filter((v) => AUDITED_IDS.has(v.id));
  const otherDerived = derived.filter((v) => !FUNDED_IDS.has(v.id) && !AUDITED_IDS.has(v.id));

  return (
    <InputSection
      title="Client & Volume"
      subtitle="Pipeline drivers"
      defaultOpen
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {primary.map((v) => {
          const value = inputs.volumes[v.id] ?? v.defaultValue;
          return (
            <div key={v.id}>
              <FieldLabel label={v.label} help={v.help} />
              {v.type === "percent" ? (
                <PercentInput value={value} onChange={(n) => setVolume(v.id, n)} />
              ) : (
                <NumberInput value={value} onChange={(n) => setVolume(v.id, n)} min={0} />
              )}
            </div>
          );
        })}
        {model.sampleRate && (
          <div>
            <FieldLabel label={model.sampleRate.label} help={model.sampleRate.help} />
            <PercentInput
              value={inputs.volumes[model.sampleRate.id] ?? model.sampleRate.default}
              onChange={(n) => setVolume(model.sampleRate!.id, n)}
            />
          </div>
        )}
      </div>

      {(fundedDerived.length > 0 || auditedDerived.length > 0 || otherDerived.length > 0) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fundedDerived.length > 0 && (
            <DerivedBlock title="Funded Volume (computed)" rows={fundedDerived.map((v) => ({ label: v.label, value: inputs.volumes[v.id] ?? 0 }))} />
          )}
          {auditedDerived.length > 0 && (
            <DerivedBlock title="Audited Volume (computed)" rows={auditedDerived.map((v) => ({ label: v.label, value: inputs.volumes[v.id] ?? 0 }))} accent />
          )}
          {otherDerived.length > 0 && (
            <DerivedBlock title="Other (computed)" rows={otherDerived.map((v) => ({ label: v.label, value: inputs.volumes[v.id] ?? 0 }))} />
          )}
        </div>
      )}
    </InputSection>
  );
}

function DerivedBlock({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: { label: string; value: number }[];
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-md px-3 py-2 border",
        accent ? "bg-orange/10 border-orange/40" : "bg-slate-50 border-slate-200",
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-600 mb-1">{title}</div>
      <div className="space-y-0.5 text-xs text-slate-700">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <span>{r.label}</span>
            <span className="font-semibold text-navy">{Math.round(r.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
