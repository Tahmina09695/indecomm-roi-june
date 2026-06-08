"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, FieldLabel, NumberInput } from "../InputSection";

export function SaasVolumeInputs() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setVolume = useSaasScenario((s) => s.setVolume);
  if (!model) return null;

  const primary = model.volumeInputs.filter((v) => v.type !== "derived");

  return (
    <InputSection title="Client & Volume" subtitle="Pipeline driver" defaultOpen>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {primary.map((v) => {
          const value = inputs.volumes[v.id] ?? v.defaultValue;
          return (
            <div key={v.id}>
              <FieldLabel label={v.label} help={v.help} />
              <NumberInput value={value} onChange={(n) => setVolume(v.id, n)} min={0} />
            </div>
          );
        })}
      </div>
    </InputSection>
  );
}
