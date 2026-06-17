"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { NumberInput } from "../InputSection";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency } from "@/lib/format";

/**
 * SaaS pricing section (visually distinct from client side - accent-tinted).
 *
 * Default mode: per-loan license + one-time implementation fee.
 *
 * Custom-RFP mode (when the model defines `defaultFixedAnnualLicense`): the
 * license row becomes a fixed annual figure (the RFP-quoted bundle price)
 * and the per-loan field hides. This is the NFCU pattern.
 *
 * When the model also defines `defaultCurrentPlatformAnnualCost`, a separate
 * "Current platform cost (Before)" row appears — that figure is added to
 * the client's Before annual cost and replaced by Indecomm's fee on After.
 */
export function SaasPricingInputs() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const setPricing = useSaasScenario((s) => s.setPricing);
  if (!model) return null;
  const r = computeSaasRoi(model, inputs);
  const accent = model.platform.accentHex;

  // Custom-RFP mode (e.g., NFCU): the license is a fixed annual figure
  // instead of per-loan × volume. The legacy-platform cost row has moved
  // to its own ClientPlatformCostInputs section above this card so the
  // client-side cost picture reads as one cohesive block.
  const hasFixedLicense = model.pricing.defaultFixedAnnualLicense !== undefined;

  return (
    <section className="rounded-xl shadow-card overflow-hidden border-2 border-l-8" style={{ borderColor: accent, background: `${accent}11` }}>
      <div className="px-5 py-3 border-b" style={{ background: `${accent}22`, borderColor: `${accent}55` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded" style={{ background: accent }}>{model.platform.name}</span>
          <h3 className="text-base font-bold text-navy">Platform Pricing</h3>
        </div>
        <p className="text-xs text-navy/70 mt-0.5">
          {hasFixedLicense
            ? "RFP-quoted annual license + implementation. Current legacy platform cost is also editable."
            : "License + implementation fee — both editable."}
        </p>
      </div>
      <div className="px-5 pb-5 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy/60">
                <th className="py-2 pr-3">Line</th>
                <th className="py-2 pr-3">Unit Price</th>
                <th className="py-2 pr-3 text-right">Volume</th>
                <th className="py-2 text-right">Annual / Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Note: Current Platform Cost row has moved to its own
                  "Current Platform Cost (Legacy Systems)" section above the
                  Indecomm pricing card — keeps client-side costs grouped
                  together. See ClientPlatformCostInputs.tsx. */}

              {/* License row — either fixed annual (custom RFP) or per-loan × volume */}
              {hasFixedLicense ? (
                <tr className="border-t" style={{ borderColor: `${accent}33` }}>
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-navy">{model.pricing.licenseLineLabel}</div>
                    <div className="text-xs text-navy/60">Fixed annual (RFP-quoted, all in-scope platforms)</div>
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={inputs.pricing.fixedAnnualLicense ?? 0}
                      onChange={(n) => setPricing({ fixedAnnualLicense: n })}
                      prefix="$"
                      step={50_000}
                      min={0}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right text-navy/60 text-xs">annual</td>
                  <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(r.platform.annualLicense)} / yr</td>
                </tr>
              ) : (
                <tr className="border-t" style={{ borderColor: `${accent}33` }}>
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-navy">{model.pricing.licenseLineLabel}</div>
                    <div className="text-xs text-navy/60">$ per {model.perLoanUnitLabel ?? "loan"} per month</div>
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={inputs.pricing.perLoanMonthlyFee}
                      onChange={(n) => setPricing({ perLoanMonthlyFee: n })}
                      prefix="$"
                      step={1}
                      min={0}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right text-navy/80">
                    {Math.round(r.platform.loansPerMonth).toLocaleString()} / mo
                  </td>
                  <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(r.platform.annualLicense)} / yr</td>
                </tr>
              )}

              <tr className="border-t" style={{ borderColor: `${accent}33` }}>
                <td className="py-2 pr-3">
                  <div className="font-semibold text-navy">{model.pricing.implementationLineLabel}</div>
                  <div className="text-xs text-navy/60">One-time, Year 1 only</div>
                </td>
                <td className="py-2 pr-3">
                  <NumberInput
                    value={inputs.pricing.oneTimeImplementationFee}
                    onChange={(n) => setPricing({ oneTimeImplementationFee: n })}
                    prefix="$"
                    step={10_000}
                    min={0}
                  />
                </td>
                <td className="py-2 pr-3 text-right text-navy/60 text-xs">one-time</td>
                <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(r.platform.oneTimeImpl)}</td>
              </tr>
              <tr className="border-t-2 bg-white" style={{ borderColor: accent }}>
                <td className="py-2 pr-3 text-xs uppercase tracking-wide font-bold text-navy">Year 1 Platform Spend</td>
                <td colSpan={2} />
                <td className="py-2 text-right font-bold text-navy text-base">{fmtCurrency(r.platform.year1Spend)}</td>
              </tr>
              <tr className="bg-white">
                <td className="py-2 pr-3 text-xs uppercase tracking-wide font-bold text-navy">Year 2 Platform Spend</td>
                <td colSpan={2} />
                <td className="py-2 text-right font-bold text-navy text-base">{fmtCurrency(r.platform.year2Spend)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
