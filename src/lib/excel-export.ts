/**
 * Excel exporter for the ROI calculator — single-sheet snapshot.
 *
 * Layout (top to bottom):
 *   1) Header (model name, client, date, platform)
 *   2) KPI callout-boxes (4 large color-coded panels mimicking the screen)
 *   3) Native Excel bar chart (in-house vs Indecomm per-loan cost)
 *   4) Key Assumptions
 *   5) Detailed Calculations
 *
 * Gridlines are hidden on every worksheet (per user preference).
 *
 * Services flavor (`exportServicesToExcel`) supports retention: when the model
 * has retention enabled, the post-outsourcing total = Indecomm fee + retained
 * staff, and the Excel shows a retention breakdown section.
 *
 * ExcelJS is dynamically imported so its ~600 KB only loads the first time
 * the user clicks "Save to Excel".
 */
import type { ModelConfig } from "@/models/_types";
import type { SaasModelConfig } from "@/models/_saas-types";
import type { ScenarioInputs } from "./engine";
import type { SaasInputs } from "./saas-engine";
import { computeRoi } from "./engine";
import { computeSaasRoi } from "./saas-engine";

// Brand standards
const NAVY = "FF002060";
const ORANGE = "FFF1A421";
const LIGHT_GRAY = "FFF1F5F9";
const LIGHT_NAVY = "FFE6ECF5";
const NAVY_TINT = "FFF4F6FB";

/**
 * Convert a "#RRGGBB" or "#RGB" hex string into ExcelJS's "FFRRGGBB" ARGB form.
 * Falls back to ORANGE if the input is malformed so we never crash mid-export.
 */
function toArgb(hex: string): string {
  if (!hex) return ORANGE;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return ORANGE;
  return `FF${h.toUpperCase()}`;
}

/**
 * Theme derived from a model's platform.accentHex. Centralizes the four shades
 * we use throughout the Excel so each product (AuditGenius orange, DocGenius
 * purple, DecisionGenius deep blue, IDXGenius light blue) gets a consistent
 * look without scattering hex codes.
 */
type Theme = {
  accent: string;       // full-strength accent  (e.g. "FFF1A421")
  accentTint: string;   // very light bg tint   ("cream" equivalent)
  accentMid: string;    // mid-tone border/dividers
};

function makeTheme(accentHex: string): Theme {
  const accent = toArgb(accentHex);
  // Light-pastel tint approximation (works for any base hue).
  // We blend each channel with white at ~92% to get a ~8% tinted background.
  const r = parseInt(accent.substring(2, 4), 16);
  const g = parseInt(accent.substring(4, 6), 16);
  const b = parseInt(accent.substring(6, 8), 16);
  const tintCh = (c: number) => Math.round(c * 0.08 + 255 * 0.92).toString(16).padStart(2, "0").toUpperCase();
  const accentTint = `FF${tintCh(r)}${tintCh(g)}${tintCh(b)}`;
  // Mid-tone (~40% accent + 60% white)
  const midCh = (c: number) => Math.round(c * 0.4 + 255 * 0.6).toString(16).padStart(2, "0").toUpperCase();
  const accentMid = `FF${midCh(r)}${midCh(g)}${midCh(b)}`;
  return { accent, accentTint, accentMid };
}

/**
 * Fetch a logo PNG from /public and return its raw bytes for ExcelJS embedding.
 * Returns null on failure so the export still succeeds (just without the logo).
 */
async function fetchLogoBytes(src: string): Promise<ArrayBuffer | null> {
  try {
    // src is a path like "/logos/Doc-Genius-Logo_color_Black.png"
    const res = await fetch(src);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

type CellOpts = { hex?: string; bold?: boolean; size?: number; color?: string; align?: "left" | "center" | "right" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function style(cell: any, opts: CellOpts = {}) {
  if (opts.hex) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.hex } };
  cell.font = {
    name: "Calibri",
    bold: opts.bold ?? false,
    size: opts.size ?? 11,
    color: { argb: opts.color ?? (opts.hex === NAVY || opts.hex === ORANGE ? "FFFFFFFF" : "FF1B2440") },
  };
  cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", wrapText: true };
}

/**
 * Apply a thin medium-gray border around a single cell. Used to give the
 * callout-box KPIs and the section panels a clean outlined look without
 * relying on Excel's gridlines (which we hide globally).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function outline(cell: any, color = "FF1B2440", weight: "thin" | "medium" | "thick" = "thin") {
  cell.border = {
    top: { style: weight, color: { argb: color } },
    left: { style: weight, color: { argb: color } },
    bottom: { style: weight, color: { argb: color } },
    right: { style: weight, color: { argb: color } },
  };
}

function safeFilename(s: string): string {
  return (s || "scenario").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Render a KPI callout box that spans 2 columns × 2 rows starting at `startCell`.
 * Layout:
 *   Row 1: label (top half, accent text on accent-tinted background)
 *   Row 2: value (bottom half, large bold)
 *
 *   ws         — worksheet
 *   startRow   — 1-indexed start row
 *   startCol   — 1-indexed start column
 *   label      — small uppercase label
 *   value      — formatted display string
 *   accentHex  — accent color (NAVY, ORANGE, LIGHT_NAVY, etc.)
 *   tintHex    — background tint
 *   borderHex  — outline color
 */
function kpiCallout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  startRow: number,
  startCol: number,
  label: string,
  value: string,
  opts: { accentHex: string; tintHex: string; borderHex: string },
) {
  const colA = String.fromCharCode(64 + startCol);     // e.g. "A"
  const colB = String.fromCharCode(64 + startCol + 1); // e.g. "B"
  const r1 = startRow;
  const r2 = startRow + 1;

  // Merge two cells horizontally for label, two for value
  ws.mergeCells(`${colA}${r1}:${colB}${r1}`);
  ws.mergeCells(`${colA}${r2}:${colB}${r2}`);

  const labelCell = ws.getCell(`${colA}${r1}`);
  labelCell.value = label;
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.tintHex } };
  labelCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: opts.accentHex } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  outline(labelCell, opts.borderHex, "medium");

  const valueCell = ws.getCell(`${colA}${r2}`);
  valueCell.value = value;
  valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.tintHex } };
  valueCell.font = { name: "Calibri", bold: true, size: 18, color: { argb: "FF002060" } };
  valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  outline(valueCell, opts.borderHex, "medium");

  ws.getRow(r1).height = 18;
  ws.getRow(r2).height = 28;
}

// Currency formatter for display strings inside callout cells.
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtUsdPrecise = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// =========================================================================
// SERVICES EXPORT
// =========================================================================

export async function exportServicesToExcel(model: ModelConfig, inputs: ScenarioInputs): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Indecomm ROI Calculator";
  wb.created = new Date();

  const r = computeRoi(model, inputs);
  const clientName = inputs.clientName?.trim() || "(Client)";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const retentionOn = r.retention.enabled;

  // Per-model theme derived from platform.accentHex so DocGenius → purple,
  // AuditGenius → orange, DecisionGenius → deep blue, etc.
  const theme = makeTheme(model.platform.accentHex);

  // Hidden gridlines per user preference, frozen header band.
  const ws = wb.addWorksheet("ROI Snapshot", {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
    properties: { defaultColWidth: 18 },
  });
  // Use 6 columns so 3 callout boxes (each spanning 2 cols) fit on one row.
  ws.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];

  // -------- Header --------
  // Navy band across A..E, with the product logo sitting in column F (top-right).
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `Indecomm ROI — ${model.name}`;
  style(ws.getCell("A1"), { hex: NAVY, bold: true, size: 18 });
  // Paint F1 navy too so the row reads as one continuous band; image will float above it.
  style(ws.getCell("F1"), { hex: NAVY });
  ws.getRow(1).height = 44;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Powered by ${model.platform.name}`;
  style(ws.getCell("A2"), { hex: NAVY, size: 10, color: "FFE6ECF5" });

  // Embed product logo in the top-right of the header band (column F, row 1).
  // Use the WHITE-version logo when the model provides one (better contrast on
  // the navy header band). Falls back to the standard colored logo otherwise.
  // ExcelJS expects the image bytes + an anchor as { col, row } in 0-indexed
  // worksheet coordinates (with fractional offsets).
  const headerLogoSrc = model.platform.logoWhite ?? model.platform.logo;
  const logoBytes = await fetchLogoBytes(headerLogoSrc);
  if (logoBytes) {
    const ext = (headerLogoSrc.match(/\.(\w+)$/)?.[1] ?? "png").toLowerCase();
    const imgId = wb.addImage({
      buffer: logoBytes as ArrayBuffer & { byteLength: number },
      extension: ext === "jpg" || ext === "jpeg" ? "jpeg" : (ext as "png" | "gif"),
    });
    // Anchor to top-right cell F1; size keeps logo crisp.
    ws.addImage(imgId, {
      tl: { col: 5.05, row: 0.05 },
      ext: { width: 130, height: 38 },
      editAs: "absolute",
    });
  }

  ws.getCell("A4").value = "Prepared for:";
  ws.mergeCells("B4:C4");
  ws.getCell("B4").value = clientName;
  ws.getCell("D4").value = "Date:";
  ws.mergeCells("E4:F4");
  ws.getCell("E4").value = dateStr;
  style(ws.getCell("A4"), { bold: true });
  style(ws.getCell("B4"), { bold: true });
  style(ws.getCell("D4"), { bold: true });
  style(ws.getCell("E4"), { bold: true });

  // -------- KPI Callout Band --------
  // Compare label: when retention is on, the "Indecomm" callout becomes
  // "Post-Outsourcing Total" so the comparison is apples-to-apples.
  let row = 6;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "KEY METRICS";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 22;
  row++;

  // First row of callouts: In-house, Indecomm/Post-Outsourcing, Annual Savings
  const outsourcedDisplay = retentionOn ? r.postOutsourcingAnnual : r.outsourced.totalAnnual;
  const outsourcedLabel = retentionOn ? "Post-Outsourcing + Retention Staff" : "Indecomm Annual Cost";
  kpiCallout(ws, row, 1, "In-house Annual Cost", fmtUsd(r.internal.totalAnnual), {
    accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY,
  });
  kpiCallout(ws, row, 3, outsourcedLabel, fmtUsd(outsourcedDisplay), {
    accentHex: theme.accent, tintHex: theme.accentTint, borderHex: theme.accent,
  });
  kpiCallout(ws, row, 5, "Annual Savings", fmtUsd(r.annualSavings), {
    accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent,
  });
  row += 3;

  // Second row of callouts: Savings %, In-house cost/loan, Indecomm cost/loan
  kpiCallout(ws, row, 1, "Savings %", fmtPct(r.savingsPct), {
    accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent,
  });
  kpiCallout(ws, row, 3, "In-house Cost / Loan", fmtUsdPrecise(r.perLoanInternal), {
    accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY,
  });
  kpiCallout(ws, row, 5, "Indecomm Cost / Loan", fmtUsdPrecise(r.perLoanOutsourced), {
    accentHex: theme.accent, tintHex: theme.accentTint, borderHex: theme.accent,
  });
  row += 3;

  // Quick sub-line: FTEs + audited volume
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = `In-house FTEs needed: ${r.internal.totalFTE.toFixed(2)} · Audited loans/year: ${Math.round(r.auditedLoansAnnual).toLocaleString()}`;
  style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B", align: "center" });
  row += 2;

  // -------- Retention breakdown (if enabled) --------
  if (retentionOn) {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = "POST-OUTSOURCING + RETENTION STAFF  (Indecomm fee + Retained team)";
    style(ws.getCell(`A${row}`), { hex: theme.accent, bold: true, size: 12 });
    row++;

    const lines: [string, number][] = [
      ["Indecomm annual fee", r.outsourced.totalAnnual],
      [`Retained in-house staff (${(r.retention.retentionPct * 100).toFixed(0)}% retention + ${r.retention.retainedSupervisors} supervisor${r.retention.retainedSupervisors === 1 ? "" : "s"})`, r.retention.totalAnnual],
      ["TOTAL POST-OUTSOURCING COST", r.postOutsourcingAnnual],
    ];
    for (const [label, val] of lines) {
      const isTotal = label.startsWith("TOTAL");
      ws.mergeCells(`A${row}:D${row}`);
      ws.getCell(`A${row}`).value = label;
      ws.mergeCells(`E${row}:F${row}`);
      ws.getCell(`E${row}`).value = val;
      ws.getCell(`E${row}`).numFmt = '"$"#,##0';
      const hex = isTotal ? theme.accentTint : undefined;
      style(ws.getCell(`A${row}`), { hex, bold: isTotal });
      style(ws.getCell(`E${row}`), { hex, bold: true, align: "right" });
      if (isTotal) {
        outline(ws.getCell(`A${row}`), theme.accent, "medium");
        outline(ws.getCell(`E${row}`), theme.accent, "medium");
      }
      row++;
    }
    // Sub-detail: retained breakdown
    row++;
    const subLines: [string, number][] = [
      ["  Retained direct labor", r.retention.retainedDirectCost],
      [`  Retained supervisor(s) — ${r.retention.retainedSupervisors}`, r.retention.retainedSupervisorCost],
      ["  Retained benefits & taxes", r.retention.retainedBenefits],
      ["  Retained indirect (pro-rated)", r.retention.retainedIndirect],
    ];
    for (const [label, val] of subLines) {
      ws.mergeCells(`A${row}:D${row}`);
      ws.getCell(`A${row}`).value = label;
      ws.mergeCells(`E${row}:F${row}`);
      ws.getCell(`E${row}`).value = val;
      ws.getCell(`E${row}`).numFmt = '"$"#,##0';
      style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
      style(ws.getCell(`E${row}`), { size: 10, color: "FF64748B", align: "right" });
      row++;
    }
    row++;
  }

  // -------- Per-loan cost comparison (cell-rendered bar chart) --------
  // ExcelJS chart support is inconsistent across versions, so we render the
  // bar visualization with color-filled cells. It's print-safe, looks good in
  // both Excel and Numbers, and survives copy/paste into PowerPoint.
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "PER-LOAN COST COMPARISON";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  // Header row for the bar visualization
  ws.getCell(`A${row}`).value = "";
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = "Cost per loan";
  ws.getCell(`F${row}`).value = "Value";
  style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
  style(ws.getCell(`B${row}`), { bold: true, color: "FF64748B", size: 10, align: "center" });
  style(ws.getCell(`F${row}`), { bold: true, color: "FF64748B", size: 10, align: "right" });
  row++;

  // Visual bars (color-filled cells with width proportional to value)
  // 4 cells wide (B..E) represent the bar; F holds the $ value.
  const servicesMaxVal = Math.max(r.perLoanInternal, r.perLoanOutsourced, 1);
  const drawServicesBar = (label: string, value: number, color: string) => {
    const br = row;
    ws.getCell(`A${br}`).value = label;
    style(ws.getCell(`A${br}`), { bold: true });
    const totalCells = 4;
    const filled = Math.ceil((value / servicesMaxVal) * totalCells);
    for (let i = 0; i < totalCells; i++) {
      const c = ws.getCell(`${String.fromCharCode(66 + i)}${br}`);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i < filled ? color : "FFEEF2F8" } };
      style(c, { color: "FFFFFFFF", size: 9 });
    }
    const last = ws.getCell(`F${br}`);
    last.value = fmtUsdPrecise(value);
    style(last, { bold: true, color: "FF002060", align: "right", size: 12 });
    ws.getRow(br).height = 22;
    row++;
  };
  drawServicesBar("In-house", r.perLoanInternal, NAVY);
  drawServicesBar(retentionOn ? "Post-Outsourcing + Retention" : "Indecomm", r.perLoanOutsourced, theme.accent);
  row++;

  // -------- Key Assumptions --------
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "KEY ASSUMPTIONS";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  const subhead = (label: string) => {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = label;
    style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
    row++;
  };
  const kv = (label: string, val: number | string, fmt?: "currency" | "percent" | "number") => {
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.mergeCells(`E${row}:F${row}`);
    ws.getCell(`E${row}`).value = val;
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    if (fmt === "currency") ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    else if (fmt === "percent") ws.getCell(`E${row}`).numFmt = '0.00%';
    else if (typeof val === "number") ws.getCell(`E${row}`).numFmt = '#,##0.00';
    row++;
  };

  subhead("Volumes");
  for (const v of model.volumeInputs) {
    const raw = inputs.volumes[v.id] ?? v.defaultValue;
    kv(v.label + (v.type === "derived" ? "  (computed)" : ""), raw, v.type === "percent" ? "percent" : "number");
  }
  if (model.sampleRate) {
    kv(model.sampleRate.label, inputs.volumes[model.sampleRate.id] ?? model.sampleRate.default, "percent");
  }
  row++;

  subhead("Direct Roles");
  ["Role", "Productivity", "Hourly Rate", "", "FTEs Needed"].forEach((h, i) => {
    if (i === 3) { ws.mergeCells(`D${row}:D${row}`); }
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  ws.mergeCells(`E${row}:F${row}`);
  ws.getCell(`E${row}`).value = "FTEs Needed";
  style(ws.getCell(`E${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  row++;
  for (const role of model.roles) {
    const ri = inputs.roles[role.id];
    const breakdown = r.internal.directs.find((d) => d.roleId === role.id)!;
    ws.getCell(`A${row}`).value = role.label;
    ws.getCell(`B${row}`).value = `${ri?.productivity ?? role.defaultProductivity} / ${role.productivityBasis === "perDay" ? "day" : "month"}`;
    ws.getCell(`C${row}`).value = ri?.hourlyRate ?? role.defaultHourlyRate;
    ws.getCell(`C${row}`).numFmt = '"$"#,##0.00';
    ws.mergeCells(`E${row}:F${row}`);
    ws.getCell(`E${row}`).value = breakdown.fteCount;
    ws.getCell(`E${row}`).numFmt = '#,##0.00';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { align: "right" });
    style(ws.getCell(`C${row}`), { align: "right" });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    row++;
  }
  row++;

  subhead("Supervisor & Benefits");
  kv("Span of control", inputs.supervisor.spanOfControl, "number");
  kv("Annual supervisor salary", inputs.supervisor.salary, "currency");
  kv("Benefits & Taxes %", inputs.benefitsRate, "percent");
  row++;

  subhead("Indirect Costs");
  for (const i of model.indirectCosts) {
    const ii = inputs.indirect[i.id];
    kv(`  ${i.label} — pool × allocation %`,
      `${fmtUsd(ii?.pool ?? i.defaultAnnualPool)} × ${((ii?.pct ?? i.defaultAllocationPct) * 100).toFixed(1)}%`);
  }
  kv("Indirect Total", r.internal.indirectTotal, "currency");
  row++;

  subhead("Indecomm Pricing");
  for (const p of model.pricing) {
    const unit = inputs.pricing[p.id] ?? (p.type === "perLoan" ? p.defaultPrice : p.defaultMonthlyPricePerFTE);
    kv(`${p.label} (${p.type === "perFTE" ? "$/FTE/mo" : "$/loan"})`, unit, "currency");
  }

  // Retention assumptions (if model has retention)
  if (model.retention) {
    row++;
    subhead("Retention Assumptions");
    kv("Retention enabled", retentionOn ? "Yes" : "No");
    if (retentionOn) {
      kv("Retained team %", r.retention.retentionPct, "percent");
      kv("Retained supervisors (fixed)", r.retention.retainedSupervisors, "number");
    }
  }

  row += 2;

  // -------- Footer --------
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm · Figures are illustrative and based on assumptions entered by the user; not a contractual offer.";
  style(ws.getCell(`A${row}`), { size: 9, color: "FF64748B", align: "center" });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fname = `Indecomm-ROI-${safeFilename(model.name)}-${safeFilename(clientName)}-${todayStr()}.xlsx`;
  await downloadBlob(blob, fname);
}

// =========================================================================
// SAAS EXPORT
// =========================================================================

export async function exportSaasToExcel(model: SaasModelConfig, inputs: SaasInputs): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Indecomm ROI Calculator";
  wb.created = new Date();

  const r = computeSaasRoi(model, inputs);
  const clientName = inputs.clientName?.trim() || "(Client)";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const theme = makeTheme(model.platform.accentHex);

  const ws = wb.addWorksheet("Automation ROI", {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
  });
  ws.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];

  // Header — navy band with product logo floating top-right in column F.
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `Indecomm Automation ROI — ${model.name}`;
  style(ws.getCell("A1"), { hex: NAVY, bold: true, size: 18 });
  style(ws.getCell("F1"), { hex: NAVY });
  ws.getRow(1).height = 44;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Platform: ${model.platform.name}`;
  style(ws.getCell("A2"), { hex: NAVY, size: 10, color: "FFE6ECF5" });

  // Embed product logo (top-right). Prefer the white-version when available
  // since the header band is navy.
  const saasHeaderLogo = model.platform.logoWhite ?? model.platform.logo;
  const saasLogoBytes = await fetchLogoBytes(saasHeaderLogo);
  if (saasLogoBytes) {
    const ext = (saasHeaderLogo.match(/\.(\w+)$/)?.[1] ?? "png").toLowerCase();
    const imgId = wb.addImage({
      buffer: saasLogoBytes as ArrayBuffer & { byteLength: number },
      extension: ext === "jpg" || ext === "jpeg" ? "jpeg" : (ext as "png" | "gif"),
    });
    ws.addImage(imgId, {
      tl: { col: 5.05, row: 0.05 },
      ext: { width: 130, height: 38 },
      editAs: "absolute",
    });
  }

  ws.getCell("A4").value = "Prepared for:";
  ws.mergeCells("B4:C4");
  ws.getCell("B4").value = clientName;
  ws.getCell("D4").value = "Date:";
  ws.mergeCells("E4:F4");
  ws.getCell("E4").value = dateStr;
  style(ws.getCell("A4"), { bold: true });
  style(ws.getCell("B4"), { bold: true });
  style(ws.getCell("D4"), { bold: true });
  style(ws.getCell("E4"), { bold: true });

  // KPI band — Year 1 + Year 2 + FTEs reduced
  let row = 6;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "KEY METRICS — YEAR 1 vs YEAR 2";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 22;
  row++;

  const savingsFirst = model.displayPreference === "savings-first";
  // Row 1 of callouts: Y1 savings/ROI, Y2 savings/ROI, FTEs reduced
  if (savingsFirst) {
    kpiCallout(ws, row, 1, "Year 1 Annual Savings", fmtUsd(r.year1.savings), { accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent });
    kpiCallout(ws, row, 3, "Year 2 Annual Savings", fmtUsd(r.year2.savings), { accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent });
  } else {
    kpiCallout(ws, row, 1, "Year 1 ROI", fmtPct(r.year1.roiPct), { accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent });
    kpiCallout(ws, row, 3, "Year 2 ROI", fmtPct(r.year2.roiPct), { accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent });
  }
  kpiCallout(ws, row, 5, "FTEs Reduced", r.internal.fteSaved.toFixed(2), { accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY });
  row += 3;

  // Row 2 of callouts: Annual Before, Annual After (Y2), Y2 Total Spend
  kpiCallout(ws, row, 1, "Annual Cost — Before", fmtUsd(r.internal.annualBefore), { accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY });
  kpiCallout(ws, row, 3, "Annual Cost — After (Y2)", fmtUsd(r.internal.annualAfter + r.platform.year2Spend), { accentHex: theme.accent, tintHex: theme.accentTint, borderHex: theme.accent });
  kpiCallout(ws, row, 5, savingsFirst ? "Y1 Savings %" : "Y1 Savings", savingsFirst ? fmtPct(r.year1.savingsPct) : fmtUsd(r.year1.savings), { accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY });
  row += 3;

  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = `Total FTEs: ${r.internal.totalFTEBefore.toFixed(2)} → ${r.internal.totalFTEAfter.toFixed(2)} · Volume: ${Math.round(r.platform.loansPerMonth).toLocaleString()} ${model.perLoanUnitLabel ?? "loans"}/month`;
  style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B", align: "center" });
  row += 2;

  // -------- Per-loan bar chart (cell-rendered) --------
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "PER-LOAN COST COMPARISON (Year 2 steady state)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;
  ws.getCell(`A${row}`).value = "Cost / Loan";
  ws.getCell(`B${row}`).value = "Before";
  ws.getCell(`C${row}`).value = "After";
  style(ws.getCell(`A${row}`), { bold: true, color: "FF64748B", size: 10 });
  style(ws.getCell(`B${row}`), { bold: true, color: "FF002060", align: "right", size: 10 });
  style(ws.getCell(`C${row}`), { bold: true, color: theme.accent, align: "right", size: 10 });
  row++;
  ws.getCell(`A${row}`).value = "Cost per loan";
  ws.getCell(`B${row}`).value = r.perLoanBefore;
  ws.getCell(`C${row}`).value = r.perLoanAfter;
  ws.getCell(`B${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`C${row}`).numFmt = '"$"#,##0.00';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { align: "right" });
  style(ws.getCell(`C${row}`), { align: "right" });
  row++;

  const maxVal = Math.max(r.perLoanBefore, r.perLoanAfter, 1);
  const drawBar = (label: string, value: number, color: string) => {
    const br = row;
    ws.getCell(`A${br}`).value = label;
    style(ws.getCell(`A${br}`), { bold: true });
    const totalCells = 5;
    const filled = Math.ceil((value / maxVal) * totalCells);
    for (let i = 0; i < totalCells; i++) {
      const c = ws.getCell(`${String.fromCharCode(66 + i)}${br}`);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i < filled ? color : "FFEEF2F8" } };
      style(c, { color: "FFFFFFFF", size: 9 });
    }
    const last = ws.getCell(`F${br}`);
    last.value = fmtUsdPrecise(value);
    style(last, { bold: true, color: "FF002060", align: "right", size: 11 });
    last.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F8" } };
    ws.getRow(br).height = 22;
    row++;
  };
  drawBar("Before", r.perLoanBefore, NAVY);
  drawBar("After (Y2)", r.perLoanAfter, theme.accent);
  row++;

  // -------- Key Assumptions --------
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "KEY ASSUMPTIONS";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  const subhead2 = (label: string) => {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = label;
    style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
    row++;
  };
  const kv2 = (label: string, val: number | string, fmt?: "currency" | "percent" | "number") => {
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.mergeCells(`E${row}:F${row}`);
    ws.getCell(`E${row}`).value = val;
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    if (fmt === "currency") ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    else if (fmt === "percent") ws.getCell(`E${row}`).numFmt = '0.00%';
    else if (typeof val === "number") ws.getCell(`E${row}`).numFmt = '#,##0.00';
    row++;
  };

  subhead2("Volumes");
  for (const v of model.volumeInputs) {
    const raw = inputs.volumes[v.id] ?? v.defaultValue;
    kv2(v.label, raw, v.type === "percent" ? "percent" : "number");
  }
  row++;

  subhead2("Roles (Before vs After)");
  for (const role of model.roles) {
    const ri = inputs.roles[role.id];
    const breakdown = r.internal.roles.find((d) => d.roleId === role.id)!;
    kv2(
      `${role.label} — baseline ${ri?.baselineProductivity ?? role.defaultBaselineProductivity} / ${role.productivityBasis === "perDay" ? "day" : "month"} @ $${ri?.hourlyRate ?? role.defaultHourlyRate}/hr, +${((ri?.improvementPct ?? role.defaultImprovementPct) * 100).toFixed(0)}%`,
      `${breakdown.fteBefore} → ${breakdown.fteAfter} FTEs`,
    );
  }
  row++;

  subhead2("Supervisor & Benefits");
  kv2("Span of control", inputs.supervisor.spanOfControl, "number");
  kv2("Supervisor salary", inputs.supervisor.salary, "currency");
  kv2("Benefits & Taxes %", inputs.benefitsRate, "percent");
  row++;

  subhead2("Platform Pricing");
  kv2("License fee ($ / loan / month)", inputs.pricing.perLoanMonthlyFee, "currency");
  kv2("Implementation fee (one-time)", inputs.pricing.oneTimeImplementationFee, "currency");
  kv2("Year 1 platform spend", r.platform.year1Spend, "currency");
  kv2("Year 2 platform spend", r.platform.year2Spend, "currency");

  row += 2;

  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm · Figures are illustrative and based on assumptions entered by the user; not a contractual offer.";
  style(ws.getCell(`A${row}`), { size: 9, color: "FF64748B", align: "center" });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fname = `Indecomm-Automation-ROI-${safeFilename(model.name)}-${safeFilename(clientName)}-${todayStr()}.xlsx`;
  await downloadBlob(blob, fname);
}
