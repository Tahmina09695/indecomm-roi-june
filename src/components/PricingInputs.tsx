"use client";
import { useScenario } from "@/store/scenarioStore";
import { NumberInput } from "./InputSection";
import { computeRoi } from "@/lib/engine";
import { fmtCurrency } from "@/lib/format";

/**
 * Indecomm Pricing section.
 * Visually distinct from client/in-house inputs: orange-accented frame and
 * "Indecomm" tag in the header, so the team can immediately see this is "Indecomm side".
 */
export function PricingInputs() {
  const model = useScenario((s) => s.model);
  const inputs = useScenario((s) => s.inputs);
  const setPricing = useScenario((s) => s.setPricing);
  if (!model) return null;

  const r = computeRoi(model, inputs);

  return (
    <section className="bg-orange/10 border-2 border-orange border-l-8 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-3 bg-orange/15 border-b border-orange/30 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-orange text-navy px-2 py-0.5 rounded">Indecomm</span>
            <h3 className="text-base font-bold text-navy">Indecomm Pricing</h3>
          </div>
          <p className="text-xs text-navy/70 mt-0.5">Outsourced rate — both rep and client can adjust</p>
        </div>
      </div>
      <div className="px-5 pb-5 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy/60">
                <th className="py-2 pr-3">Line</th>
                <th className="py-2 pr-3">Unit Price</th>
                <th className="py-2 pr-3 text-right">Monthly Qty</th>
                <th className="py-2 text-right">Annual Cost</th>
              </tr>
            </thead>
            <tbody>
              {model.pricing.map((p) => {
                const line = r.outsourced.items.find((it) => it.pricingId === p.id)!;
                const isFTE = p.type === "perFTE";
                return (
                  <tr key={p.id} className="border-t border-orange/20">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-navy">{p.label}</div>
                      <div className="text-xs text-navy/60">{isFTE ? "$ per FTE per month" : "$ per loan"}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <NumberInput
                        value={inputs.pricing[p.id] ?? (isFTE ? (p as any).defaultMonthlyPricePerFTE : (p as any).defaultPrice)}
                        onChange={(n) => setPricing(p.id, n)}
                        prefix="$"
                        step={1}
                        min={0}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right text-navy/80">
                      {Math.round(line.monthlyVolumeOrFTEs).toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-semibold text-navy">{fmtCurrency(line.annualCost)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-orange bg-orange/15">
                <td className="py-2 pr-3 text-xs uppercase tracking-wide font-bold text-navy">Indecomm Annual Spend</td>
                <td colSpan={2} />
                <td className="py-2 text-right font-bold text-navy text-base">{fmtCurrency(r.outsourced.totalAnnual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
