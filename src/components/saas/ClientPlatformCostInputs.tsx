"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { InputSection, FieldLabel, NumberInput } from "../InputSection";
import { fmtCurrency } from "@/lib/format";

/**
 * "Current Platform Cost (Legacy Systems)" input section.
 *
 * Renders ONLY when the active model defines
 * `model.pricing.defaultCurrentPlatformAnnualCost`. Visually grouped with
 * the client's other in-house cost build-up sections (between Benefits and
 * Indirect) so the prospect's total cost picture reads as one cohesive
 * story before the Indecomm pricing section appears below it.
 *
 * The actual cost is added to the "Annual Before" total by the engine — see
 * SaasInternalBreakdown.currentPlatformAnnualCost.
 */
export function ClientPlatformCostInputs() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setPricing = useSaasScenario((s) => s.setPricing);
  if (!model) return null;

  // Only render when the model declares a legacy-platform cost.
  if (model.pricing.defaultCurrentPlatformAnnualCost === undefined) return null;

  const value = inputs.pricing.currentPlatformAnnualCost ?? 0;

  return (
    <InputSection
      title="Current Platform Cost (Legacy Systems)"
      subtitle="Today's annual spend on systems being replaced"
      defaultOpen
      callout={
        <>
          <strong>Why this matters:</strong> The annual cost of your current
          platforms (e.g., Paradatec, Hyland Voyager, Trinity) is part of
          your true "Before" cost. Indecomm's per-loan platform pricing
          replaces these legacy systems — that swap-out is a meaningful
          component of the savings story.
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel
            label="Annual Cost of Current Platforms"
            help="Combined annual licensing/maintenance for the systems being replaced."
          />
          <NumberInput
            value={value}
            onChange={(n) => setPricing({ currentPlatformAnnualCost: n })}
            prefix="$"
            step={50_000}
            min={0}
          />
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm flex items-center justify-between">
          <span className="text-slate-600 text-xs">Adds to Annual Before</span>
          <span className="font-bold text-navy">{fmtCurrency(value)} / yr</span>
        </div>
      </div>
    </InputSection>
  );
}
