"use client";
import { useScenario } from "@/store/scenarioStore";
import { computeRoi } from "@/lib/engine";
import { fmtCurrency, fmtCurrencyPrecise, fmtPercent } from "@/lib/format";
import type { ModelConfig } from "@/models/_types";

/**
 * One-page ROI Dashboard (print-only). Compact, graph-forward, fits on a single
 * letter-size landscape page. The rest of the calculator UI is hidden via global
 * print CSS in globals.css.
 *
 * Color rules:
 *  - Client / in-house content = navy (#002060) — stable Indecomm anchor
 *  - Indecomm / outsourced content uses the model's platform.accentHex:
 *      AuditGenius → orange  · DocGenius → purple  · DecisionGenius → deep blue
 *
 * IMPORTANT: All bar/donut visuals use inline SVG (no Recharts) so they render
 * reliably in the browser's print engine where flex/grid widths can collapse.
 */
export function PrintSummary({ model }: { model: ModelConfig }) {
  const inputs = useScenario((s) => s.inputs);
  const r = computeRoi(model, inputs);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const auditedAnnual = Math.round(r.auditedLoansAnnual);
  const auditedPerMonth = Math.round(auditedAnnual / 12);

  // Product accent + derived tints (the "cream" equivalent for each product).
  // Adding hex-alpha suffixes keeps the tinted backgrounds proportional to the
  // accent across products without needing a per-product cream definition.
  const ACCENT = model.platform.accentHex;       // e.g. "#F1A421"
  const ACCENT_TINT = `${ACCENT}15`;             // 8% bg
  const ACCENT_BORDER_FADE = `${ACCENT}55`;      // ~33% border on dividers
  const ACCENT_LOGO_FADE = `${ACCENT}66`;

  return (
    <div className="print-only" style={{ fontFamily: "Open Sans, sans-serif", color: "#002060" }}>
      <div style={{ padding: "0.25in 0.4in", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "2px solid #002060", paddingBottom: 8, marginBottom: 10,
        }}>
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
          <div style={{ fontSize: 17, fontWeight: 800 }}>{model.name} — ROI Snapshot</div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Prepared for: <strong style={{ color: "#002060" }}>{inputs.clientName || "(Client)"}</strong>
            <span style={{ marginLeft: 10 }}>· Audited volume: <strong>{auditedPerMonth.toLocaleString()}</strong> loans/month ({auditedAnnual.toLocaleString()}/yr)</span>
          </div>
        </div>

        {/* HERO band */}
        <table style={{ width: "100%", marginBottom: 10, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{
                border: `3px solid ${ACCENT}`, borderRadius: 10, padding: 12,
                background: ACCENT_TINT,
                width: "100%",
              }}>
                <table style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Return on Investment</div>
                        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{fmtPercent(r.savingsPct, 1)}</div>
                        <div style={{ fontSize: 10, color: "#002060AA" }}>vs. running in-house</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#002060AA" }}>Annual Savings</div>
                        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.0, marginTop: 2 }}>{fmtCurrency(r.annualSavings)}</div>
                        <div style={{ fontSize: 10, color: "#002060AA" }}>Savings/loan: <strong>{fmtCurrencyPrecise(r.perLoanSavings)}</strong></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Two-column body — using <table> for print-safe layout */}
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 8 }}>
          <tbody>
            <tr style={{ verticalAlign: "top" }}>
              {/* LEFT: cost cards + bar chart */}
              <td style={{ width: "60%" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, marginBottom: 8 }}>
                  <tbody>
                    <tr style={{ verticalAlign: "top" }}>
                      <td style={{ width: "50%" }}>
                        <div style={{ border: "1px solid #002060", borderRadius: 8, padding: 9, background: "#F4F6FB" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#002060" }}>Your In-house Annual Cost</div>
                          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmtCurrency(r.internal.totalAnnual)}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>Avg/loan: <strong>{fmtCurrencyPrecise(r.perLoanInternal)}</strong></div>
                        </div>
                      </td>
                      <td style={{ width: "50%" }}>
                        <div style={{ border: `2px solid ${ACCENT}`, borderRadius: 8, padding: 9, background: ACCENT_TINT }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ACCENT }}>
                            {r.retention.enabled ? "Post-Outsourcing + Retention Staff" : "Indecomm Annual Cost"}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
                            {fmtCurrency(r.retention.enabled ? r.postOutsourcingAnnual : r.outsourced.totalAnnual)}
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                            Avg/loan: <strong>{fmtCurrencyPrecise(r.perLoanOutsourced)}</strong>
                          </div>
                          {r.retention.enabled && (
                            <div style={{ fontSize: 9, color: "#475569", marginTop: 4, paddingTop: 4, borderTop: `1px solid ${ACCENT_BORDER_FADE}` }}>
                              Indecomm fee: <strong>{fmtCurrency(r.outsourced.totalAnnual)}</strong>
                              <br />
                              Retained staff: <strong>{fmtCurrency(r.retention.totalAnnual)}</strong>
                              {" "}({fmtPercent(r.retention.retentionPct, 0)} retention + {r.retention.retainedSupervisors} sup.)
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Per-loan comparison bar chart — inline SVG (print-safe) */}
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>
                    Per-Loan Cost Comparison
                  </div>
                  <SvgBarChart
                    internal={r.perLoanInternal}
                    outsourced={r.perLoanOutsourced}
                    rightLabel={r.retention.enabled ? "Post-Outsourcing + Retention Staff" : "Indecomm"}
                    rightColor={ACCENT}
                  />
                  <div style={{ fontSize: 10.5, color: "#002060", marginTop: 8, textAlign: "right" }}>
                    Save <strong>{fmtCurrencyPrecise(r.perLoanSavings)}</strong> per audited loan with Indecomm.
                  </div>
                </div>
              </td>

              {/* RIGHT: Indecomm Differentiator */}
              <td style={{ width: "40%" }}>
                <div style={{ border: `2px solid ${ACCENT}`, borderLeft: `8px solid ${ACCENT}`, borderRadius: 8, padding: 12, background: ACCENT_TINT }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ background: "white", border: `1px solid ${ACCENT_LOGO_FADE}`, borderRadius: 6, padding: 4 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={model.platform.logo} alt={model.platform.name} style={{ height: 26 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: ACCENT }}>Indecomm Differentiator</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#002060" }}>{model.platform.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#002060", lineHeight: 1.45, marginBottom: 8 }}>
                    <strong>{model.platform.name}</strong> — {model.platform.blurb}
                  </div>
                  <ul style={{ paddingLeft: 14, margin: 0, fontSize: 10.5, color: "#002060", lineHeight: 1.45 }}>
                    <li><strong>Robust reporting &amp; interactive dashboards</strong> — real-time visibility into QC performance, defects, and trends.</li>
                    <li>Consistent QC quality across loan types and channels.</li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 9, color: "#64748b", marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
          Indecomm · Powered by {model.platform.name}. Figures are illustrative and based on assumptions entered by the user; not a contractual offer.
        </div>
      </div>
    </div>
  );
}

/**
 * Inline-SVG horizontal bar chart. Print-safe — no flex/grid percentage widths
 * to confuse the print engine. Renders in-house (navy) vs Indecomm (product
 * accent) bars with dollar-value labels on the right. `rightLabel` and
 * `rightColor` are overridable so retention scenarios and per-product
 * theming both work.
 */
function SvgBarChart({
  internal,
  outsourced,
  rightLabel = "Indecomm",
  rightColor = "#F1A421",
}: {
  internal: number;
  outsourced: number;
  rightLabel?: string;
  rightColor?: string;
}) {
  // Long retention labels need a wider label column so they don't overlap the bar.
  const labelColWidth = rightLabel.length > 15 ? 180 : 70;
  const width = 480;
  const height = 100;
  const max = Math.max(internal, outsourced, 1);
  const valueColWidth = 90;
  const barX = labelColWidth;
  const barAvailable = width - labelColWidth - valueColWidth;
  const rowH = 30;
  const gap = 14;

  const rows = [
    { label: "In-house", value: internal, color: "#002060" },
    { label: rightLabel, value: outsourced, color: rightColor },
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
            <text
              x={width - 4}
              y={y + rowH / 2 + 4}
              fontSize={13}
              fontWeight={800}
              fill="#002060"
              textAnchor="end"
            >
              {`$${row.value.toFixed(2)} / loan`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
