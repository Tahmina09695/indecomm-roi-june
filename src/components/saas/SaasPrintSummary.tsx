"use client";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { computeSaasRoi } from "@/lib/saas-engine";
import { fmtCurrency, fmtCurrencyPrecise, fmtPercent } from "@/lib/format";
import type { SaasModelConfig } from "@/models/_saas-types";

/**
 * One-page SaaS Dashboard (print-only). Compact, graph-forward, landscape letter.
 * Hero shows Year 1 + Year 2 ROI %. Body shows Before vs After cost cards and
 * a per-loan comparison bar chart.
 */
export function SaasPrintSummary({ model }: { model: SaasModelConfig }) {
  const inputs = useSaasScenario((s) => s.inputs);
  const r = computeSaasRoi(model, inputs);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const accent = model.platform.accentHex;

  return (
    <div className="print-only" style={{ fontFamily: "Open Sans, sans-serif", color: "#002060" }}>
      <div style={{ padding: "0.25in 0.4in", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #002060", paddingBottom: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/indecomm.png" alt="Indecomm" style={{ height: 34 }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={model.platform.logo} alt={model.platform.name} style={{ height: 34 }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 700, textTransform: "uppercase" }}>ROI Dashboard</div>
            <div style={{ fontSize: 11 }}>{today}</div>
          </div>
        </div>

        {/* Title row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{model.name} — Automation ROI Snapshot</div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Prepared for: <strong style={{ color: "#002060" }}>{inputs.clientName || "(Client)"}</strong>
            <span style={{ marginLeft: 10 }}>· Volume: <strong>{Math.round(r.platform.loansPerMonth).toLocaleString()}</strong> {model.perLoanUnitLabel ?? "loans"}/month</span>
          </div>
        </div>

        {/* HERO band — leads with $ savings for "savings-first" models (e.g., IDX),
            and leads with ROI % for "roi-first" models (e.g., DG). */}
        <table style={{ width: "100%", marginBottom: 10, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ border: `3px solid ${accent}`, borderRadius: 10, padding: 12, background: `${accent}15`, width: "100%" }}>
                <table style={{ width: "100%" }}>
                  <tbody>
                    {model.displayPreference === "savings-first" ? (
                      <tr>
                        <td>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Year 1 Annual Savings</div>
                          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{fmtCurrency(r.year1.savings)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>{fmtPercent(r.year1.savingsPct, 1)} of current cost</div>
                        </td>
                        <td style={{ borderLeft: `2px solid ${accent}55`, paddingLeft: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Year 2 Annual Savings</div>
                          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.0, marginTop: 2, color: accent }}>{fmtCurrency(r.year2.savings)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>{fmtPercent(r.year2.savingsPct, 1)} of current cost</div>
                        </td>
                        <td style={{ textAlign: "right", borderLeft: `2px solid ${accent}55`, paddingLeft: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>FTEs Reduced</div>
                          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{r.internal.fteSaved.toFixed(1)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>{r.internal.totalFTEBefore.toFixed(1)} → {r.internal.totalFTEAfter.toFixed(1)} FTEs</div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Year 1 ROI</div>
                          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{fmtPercent(r.year1.roiPct, 0)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>Savings: <strong>{fmtCurrency(r.year1.savings)}</strong> ({fmtPercent(r.year1.savingsPct, 0)})</div>
                        </td>
                        <td style={{ borderLeft: `2px solid ${accent}55`, paddingLeft: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Year 2 ROI</div>
                          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.0, marginTop: 2, color: accent }}>{fmtPercent(r.year2.roiPct, 0)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>Savings: <strong>{fmtCurrency(r.year2.savings)}</strong> ({fmtPercent(r.year2.savingsPct, 0)})</div>
                        </td>
                        <td style={{ textAlign: "right", borderLeft: `2px solid ${accent}55`, paddingLeft: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>FTEs Reduced</div>
                          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{r.internal.fteSaved.toFixed(1)}</div>
                          <div style={{ fontSize: 10, color: "#002060AA" }}>{r.internal.totalFTEBefore.toFixed(1)} → {r.internal.totalFTEAfter.toFixed(1)} FTEs</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Body: 2-column with table layout for print safety */}
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 8 }}>
          <tbody>
            <tr style={{ verticalAlign: "top" }}>
              <td style={{ width: "60%" }}>
                {/* Annual cost cards: Before vs After */}
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, marginBottom: 8 }}>
                  <tbody>
                    <tr style={{ verticalAlign: "top" }}>
                      <td style={{ width: "50%" }}>
                        <div style={{ border: "1px solid #002060", borderRadius: 8, padding: 9, background: "#F4F6FB" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#002060" }}>Annual Cost Before</div>
                          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmtCurrency(r.internal.annualBefore)}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{r.internal.totalFTEBefore.toFixed(1)} FTEs · {fmtCurrencyPrecise(r.perLoanBefore)}/loan</div>
                        </div>
                      </td>
                      <td style={{ width: "50%" }}>
                        <div style={{ border: `2px solid ${accent}`, borderRadius: 8, padding: 9, background: `${accent}15` }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: accent }}>Annual Cost After (Y2)</div>
                          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmtCurrency(r.internal.annualAfter + r.platform.year2Spend)}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{r.internal.totalFTEAfter.toFixed(1)} FTEs · {fmtCurrencyPrecise(r.perLoanAfter)}/loan</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Per-loan comparison bar chart - inline SVG */}
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>
                    Per-Loan Cost Comparison (Year 2 Steady State)
                  </div>
                  <SvgBar before={r.perLoanBefore} after={r.perLoanAfter} accent={accent} />
                  <div style={{ fontSize: 10.5, color: "#002060", marginTop: 6, textAlign: "right" }}>
                    Save <strong>{fmtCurrencyPrecise(r.perLoanSavings)}</strong> per {model.perLoanUnitLabel ?? "loan"} at steady state.
                  </div>
                </div>
              </td>

              {/* Platform Differentiator */}
              <td style={{ width: "40%" }}>
                <div style={{ border: `2px solid ${accent}`, borderLeft: `8px solid ${accent}`, borderRadius: 8, padding: 12, background: `${accent}15` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ background: "white", border: `1px solid ${accent}66`, borderRadius: 6, padding: 4 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={model.platform.logo} alt={model.platform.name} style={{ height: 26 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: accent }}>Why this platform</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#002060" }}>{model.platform.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#002060", lineHeight: 1.45, marginBottom: 8 }}>
                    {model.platform.blurb}
                  </div>
                  {model.platform.capabilities && model.platform.capabilities.length > 0 && (
                    <ul style={{ paddingLeft: 14, margin: 0, fontSize: 10.5, color: "#002060", lineHeight: 1.45 }}>
                      {model.platform.capabilities.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 9, color: "#64748b", marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
          Indecomm · {model.platform.name}. Figures are illustrative and based on assumptions entered by the user; not a contractual offer.
        </div>
      </div>
    </div>
  );
}

function SvgBar({ before, after, accent }: { before: number; after: number; accent: string }) {
  const width = 480;
  const height = 100;
  const max = Math.max(before, after, 1);
  const labelColWidth = 70;
  const valueColWidth = 90;
  const barX = labelColWidth;
  const barAvailable = width - labelColWidth - valueColWidth;
  const rowH = 30;
  const gap = 14;
  const rows = [
    { label: "Before", value: before, color: "#002060" },
    { label: "After",  value: after,  color: accent },
  ];
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {rows.map((row, i) => {
        const y = 8 + i * (rowH + gap);
        const w = (row.value / max) * barAvailable;
        return (
          <g key={row.label}>
            <text x={0} y={y + rowH / 2 + 4} fontSize={12} fontWeight={700} fill="#002060">{row.label}</text>
            <rect x={barX} y={y} width={barAvailable} height={rowH} fill="#f1f5f9" rx={4} />
            <rect x={barX} y={y} width={w} height={rowH} fill={row.color} rx={4} />
            <text x={width - 4} y={y + rowH / 2 + 4} fontSize={13} fontWeight={800} fill="#002060" textAnchor="end">
              {`$${row.value.toFixed(2)} / loan`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
