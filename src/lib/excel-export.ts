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

/**
 * Formula-driven sibling of kpiCallout(). Identical visual layout, but the
 * value cell holds an Excel formula referencing inputs elsewhere on the sheet
 * (and a numFmt) instead of a pre-formatted display string. Required when the
 * KPI must recalculate after the user edits an input cell.
 */
function kpiCalloutFormula(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  startRow: number,
  startCol: number,
  label: string,
  formula: string,
  numFmt: string,
  opts: { accentHex: string; tintHex: string; borderHex: string },
) {
  const colA = String.fromCharCode(64 + startCol);
  const colB = String.fromCharCode(64 + startCol + 1);
  const r1 = startRow;
  const r2 = startRow + 1;

  ws.mergeCells(`${colA}${r1}:${colB}${r1}`);
  ws.mergeCells(`${colA}${r2}:${colB}${r2}`);

  const labelCell = ws.getCell(`${colA}${r1}`);
  labelCell.value = label;
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.tintHex } };
  labelCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: opts.accentHex } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  outline(labelCell, opts.borderHex, "medium");

  const valueCell = ws.getCell(`${colA}${r2}`);
  valueCell.value = { formula };
  valueCell.numFmt = numFmt;
  valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.tintHex } };
  valueCell.font = { name: "Calibri", bold: true, size: 18, color: { argb: "FF002060" } };
  valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  outline(valueCell, opts.borderHex, "medium");

  ws.getRow(r1).height = 18;
  ws.getRow(r2).height = 28;
}

// =========================================================================
// SERVICES EXPORT
// =========================================================================

export async function exportServicesToExcel(model: ModelConfig, inputs: ScenarioInputs): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Indecomm ROI Calculator";
  wb.created = new Date();

  // We still call the engine to seed default values for the editable cells and
  // to expose `r` for any visualization that needs concrete numbers (e.g. the
  // cell-rendered bar chart). All headline KPIs use FORMULAS that point at
  // input cells below — editing an input recalculates everything downstream.
  const r = computeRoi(model, inputs);
  const clientName = inputs.clientName?.trim() || "(Client)";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `Indecomm ROI — ${model.name}`;
  style(ws.getCell("A1"), { hex: NAVY, bold: true, size: 18 });
  style(ws.getCell("F1"), { hex: NAVY });
  ws.getRow(1).height = 44;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Powered by ${model.platform.name}`;
  style(ws.getCell("A2"), { hex: NAVY, size: 10, color: "FFE6ECF5" });

  const headerLogoSrc = model.platform.logoWhite ?? model.platform.logo;
  const logoBytes = await fetchLogoBytes(headerLogoSrc);
  if (logoBytes) {
    const ext = (headerLogoSrc.match(/\.(\w+)$/)?.[1] ?? "png").toLowerCase();
    const imgId = wb.addImage({
      buffer: logoBytes as ArrayBuffer & { byteLength: number },
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

  // ============================================================================
  // KPI BAND — six callouts, all formula-driven (forward-referencing the input
  // cells laid out below). Excel resolves forward refs on calc, so this works.
  // ============================================================================
  let row = 6;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "KEY METRICS  (edit any value in the INPUTS block below — all totals recalculate)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 22;
  row++;

  // We need stable cell addresses for every formula we'll build below.
  // The "promise" cells get filled in further down once the INPUTS layout
  // determines their row numbers. We declare placeholders here and bind the
  // KPI callouts to them via string concatenation — same pattern the SaaS
  // exporter uses.
  //
  // For now: build the KPI shells with text "(loading…)" and rewrite them
  // once we know the input cell addresses. We do this by holding off the
  // KPI callout calls until AFTER inputs are written.

  // Reserve the 6 KPI cell positions (rows 7–12, since each callout = 2 rows
  // and we have 2 rows of 3 callouts each).
  const kpiRow1 = row;       // first row of callouts (label row)
  const kpiRow2 = row + 3;   // second row of callouts
  row += 6;

  // Sub-line: FTEs + audited volume (also formula-driven below)
  const kpiSublineRow = row;
  row += 2;

  // ============================================================================
  // INPUTS BLOCK — every editable value. Cells are tinted cream so the user
  // knows what's editable. Formula cells (FTEs, indirect cost, etc.) are
  // bold to distinguish them visually.
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "INPUTS  (yellow-tinted cells are editable)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 22;
  row++;

  // ---- Volumes ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Volumes";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  // Track each volume's editable cell address (B-column). Derived volumes get
  // a FORMULA so they recompute when the upstream primitives change. The
  // engine's recomputeDerivedVolumes uses arbitrary JS, so for derived volumes
  // we fall back to the engine's last-known value and tag it (computed).
  const volumeRows: Record<string, string> = {};
  for (const v of model.volumeInputs) {
    const isPercent = v.type === "percent";
    const isDerived = v.type === "derived";
    const raw = inputs.volumes[v.id] ?? (v.type !== "derived" ? v.defaultValue : 0);
    ws.getCell(`A${row}`).value = v.label + (isDerived ? "  (computed)" : "");
    ws.getCell(`B${row}`).value = raw;
    ws.getCell(`B${row}`).numFmt = isPercent ? '0.00%' : '#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), {
      bold: true,
      align: "right",
      hex: isDerived ? LIGHT_GRAY : "FFFFF8DC",
    });
    volumeRows[v.id] = `B${row}`;
    row++;
  }

  // Sample rate (separate field from volumes in the model config)
  let sampleRateCell: string | undefined;
  if (model.sampleRate) {
    ws.getCell(`A${row}`).value = model.sampleRate.label;
    ws.getCell(`B${row}`).value = inputs.volumes[model.sampleRate.id] ?? model.sampleRate.default;
    ws.getCell(`B${row}`).numFmt = '0.00%';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    sampleRateCell = `B${row}`;
    row++;
  }
  row++;

  // ---- Roles (productivity, hourly rate, FTEs needed) ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Direct Roles — productivity & hourly rate";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ["Role", "Productivity", "Hourly Rate", "Basis", "FTEs Needed", ""].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  type RoleRef = {
    roleId: string;
    rowNum: number;
    productivityCell: string;
    hourlyRateCell: string;
    fteCell: string;
  };
  const roleRefs: RoleRef[] = [];

  for (const role of model.roles) {
    const ri = inputs.roles[role.id];
    const productivity = ri?.productivity ?? role.defaultProductivity;
    const hr = ri?.hourlyRate ?? role.defaultHourlyRate;
    const volCell = volumeRows[role.volumeKey] ?? "B7";
    const multiplier = role.productivityMultiplier ?? 1;

    ws.getCell(`A${row}`).value = role.label;
    ws.getCell(`B${row}`).value = productivity;
    ws.getCell(`B${row}`).numFmt = '#,##0.00';
    ws.getCell(`C${row}`).value = hr;
    ws.getCell(`C${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`D${row}`).value = role.productivityBasis === "perDay" ? "per day" : "per month";

    // FTE formula — mirrors computeRoleFTEs() in engine.ts:
    //   sample = appliesSampleRate ? sampleRateCell : 1
    //   monthlyVol = volume × sample
    //   perDay:   FTEs = monthlyVol × multiplier / 20 / prod
    //   perMonth: FTEs = monthlyVol × multiplier / prod
    const sampleExpr = role.appliesSampleRate && sampleRateCell ? sampleRateCell : "1";
    const monthlyExpr = `${volCell}*${sampleExpr}`;
    const fteFormula = role.productivityBasis === "perDay"
      ? `${monthlyExpr}*${multiplier}/20/B${row}`
      : `${monthlyExpr}*${multiplier}/B${row}`;
    ws.getCell(`E${row}`).value = { formula: fteFormula };
    ws.getCell(`E${row}`).numFmt = '#,##0.00';

    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`C${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`D${row}`), { align: "right", color: "FF64748B", size: 10 });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });

    roleRefs.push({
      roleId: role.id,
      rowNum: row,
      productivityCell: `B${row}`,
      hourlyRateCell: `C${row}`,
      fteCell: `E${row}`,
    });
    row++;
  }

  // Direct labor total (sum of FTE × hourlyRate × 2080 across roles)
  ws.getCell(`A${row}`).value = "Direct Labor (annual)";
  const directLaborTerms = roleRefs.map((rr) => `${rr.fteCell}*${rr.hourlyRateCell}*2080`).join("+") || "0";
  ws.getCell(`E${row}`).value = { formula: directLaborTerms };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  style(ws.getCell(`E${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  const directLaborCell = `E${row}`;
  row += 2;

  // ---- Supervisor & Benefits ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Supervisor & Benefits";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ws.getCell(`A${row}`).value = "Span of control";
  ws.getCell(`B${row}`).value = inputs.supervisor.spanOfControl;
  ws.getCell(`B${row}`).numFmt = '#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const spanCell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Annual supervisor salary";
  ws.getCell(`B${row}`).value = inputs.supervisor.salary;
  ws.getCell(`B${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const supSalaryCell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Benefits & Taxes %";
  ws.getCell(`B${row}`).value = inputs.benefitsRate;
  ws.getCell(`B${row}`).numFmt = '0.00%';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const benefitsRateCell = `B${row}`;
  row++;

  // Supervisor cost (computed): SUM(direct FTEs) / span × salary
  const directFteSumExpr = roleRefs.map((rr) => rr.fteCell).join("+") || "0";
  ws.getCell(`A${row}`).value = "Supervisor Cost (annual)";
  ws.getCell(`E${row}`).value = { formula: `(${directFteSumExpr})/${spanCell}*${supSalaryCell}` };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  style(ws.getCell(`E${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  const supervisorCostCell = `E${row}`;
  row++;

  // Benefits (computed): (direct + supervisor) × rate
  ws.getCell(`A${row}`).value = "Benefits & Taxes (annual)";
  ws.getCell(`E${row}`).value = { formula: `(${directLaborCell}+${supervisorCostCell})*${benefitsRateCell}` };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  style(ws.getCell(`E${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  const benefitsCell = `E${row}`;
  row += 2;

  // ---- Indirect costs ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indirect Costs (annual pool × allocation %)";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ["Category", "Annual Pool", "Allocation %", "", "Cost"].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  type IndirectRef = { id: string; costCell: string };
  const indirectRefs: IndirectRef[] = [];
  for (const i of model.indirectCosts) {
    const ii = inputs.indirect[i.id];
    ws.getCell(`A${row}`).value = i.label;
    ws.getCell(`B${row}`).value = ii?.pool ?? i.defaultAnnualPool;
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    ws.getCell(`C${row}`).value = ii?.pct ?? i.defaultAllocationPct;
    ws.getCell(`C${row}`).numFmt = '0.00%';
    ws.getCell(`E${row}`).value = { formula: `B${row}*C${row}` };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`C${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    indirectRefs.push({ id: i.id, costCell: `E${row}` });
    row++;
  }

  // Indirect total
  ws.getCell(`A${row}`).value = "Indirect Total";
  const indirectSumExpr = indirectRefs.length > 0
    ? `SUM(${indirectRefs[0].costCell}:${indirectRefs[indirectRefs.length - 1].costCell})`
    : "0";
  ws.getCell(`E${row}`).value = { formula: indirectSumExpr };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  style(ws.getCell(`E${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  const indirectTotalCell = `E${row}`;
  row += 2;

  // In-house grand total
  ws.getCell(`A${row}`).value = "IN-HOUSE TOTAL ANNUAL COST";
  ws.getCell(`E${row}`).value = {
    formula: `${directLaborCell}+${supervisorCostCell}+${benefitsCell}+${indirectTotalCell}`,
  };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, color: "FFFFFFFF" });
  style(ws.getCell(`E${row}`), { hex: NAVY, bold: true, color: "FFFFFFFF", align: "right", size: 12 });
  const internalTotalCell = `E${row}`;
  row += 2;

  // ---- Indecomm Pricing ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm Pricing";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ["Pricing Line", "Unit Price", "Type", "Monthly Qty", "Annual Cost"].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  type PricingRef = { id: string; annualCostCell: string; pricingDefIndex: number };
  const pricingRefs: PricingRef[] = [];

  model.pricing.forEach((p, idx) => {
    const unit = inputs.pricing[p.id] ?? (p.type === "perLoan" ? p.defaultPrice : p.defaultMonthlyPricePerFTE);
    ws.getCell(`A${row}`).value = p.label;
    ws.getCell(`B${row}`).value = unit;
    ws.getCell(`B${row}`).numFmt = p.type === "perFTE" ? '"$"#,##0' : '"$"#,##0.00';
    ws.getCell(`C${row}`).value = p.type === "perFTE" ? "$/FTE/mo" : "$/loan";

    let monthlyQtyExpr: string;
    if (p.type === "perLoan") {
      const volCell = volumeRows[p.volumeKey] ?? "B7";
      const sampleExpr = p.appliesSampleRate && sampleRateCell ? sampleRateCell : "1";
      monthlyQtyExpr = `${volCell}*${sampleExpr}`;
    } else {
      // perFTE: base = roleFTE, optionally rounded, × fteMultiplier, + fteOffset
      const rr = roleRefs.find((x) => x.roleId === p.roleId);
      const baseCell = rr?.fteCell ?? "0";
      const rounded = p.roundBaseFte === "round"
        ? `ROUND(${baseCell},0)`
        : p.roundBaseFte === "ceil"
        ? `CEILING(${baseCell},1)`
        : p.roundBaseFte === "floor"
        ? `FLOOR(${baseCell},1)`
        : baseCell;
      const mult = p.fteMultiplier ?? 1;
      const off = p.fteOffset ?? 0;
      monthlyQtyExpr = `${rounded}*${mult}+${off}`;
    }
    ws.getCell(`D${row}`).value = { formula: monthlyQtyExpr };
    ws.getCell(`D${row}`).numFmt = '#,##0.00';

    // Annual cost = monthlyQty × unitPrice × 12
    ws.getCell(`E${row}`).value = { formula: `D${row}*B${row}*12` };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';

    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`C${row}`), { align: "right", color: "FF64748B", size: 10 });
    style(ws.getCell(`D${row}`), { align: "right" });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });

    pricingRefs.push({ id: p.id, annualCostCell: `E${row}`, pricingDefIndex: idx });
    row++;
  });

  // Indecomm total
  ws.getCell(`A${row}`).value = "Indecomm Annual Fee";
  const indecommSumExpr = pricingRefs.length > 0
    ? pricingRefs.map((pr) => pr.annualCostCell).join("+")
    : "0";
  ws.getCell(`E${row}`).value = { formula: indecommSumExpr };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: theme.accentTint, bold: true });
  style(ws.getCell(`E${row}`), { hex: theme.accentTint, bold: true, align: "right" });
  const indecommFeeCell = `E${row}`;
  row += 2;

  // ---- Retention block (if model supports it) ----
  let postOutsourcingTotalCell = indecommFeeCell;
  let retentionTotalCell: string | undefined;
  let retentionEnabledCell: string | undefined;
  let retentionPctCell: string | undefined;
  let retainedSupCell: string | undefined;
  let retainedDirectCostCell: string | undefined;
  let retainedSupCostCell: string | undefined;
  let retainedBenefitsCell: string | undefined;
  let retainedIndirectCell: string | undefined;

  if (model.retention) {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = "Retention (post-outsourcing in-house staff)";
    style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
    row++;

    // Toggle: 1 = enabled, 0 = disabled. We store the numeric value so
    // downstream formulas can multiply by it cleanly.
    ws.getCell(`A${row}`).value = "Retention enabled (1 = yes, 0 = no)";
    ws.getCell(`B${row}`).value = inputs.retention?.enabled ? 1 : 0;
    ws.getCell(`B${row}`).numFmt = '0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    retentionEnabledCell = `B${row}`;
    row++;

    ws.getCell(`A${row}`).value = "Retention %";
    ws.getCell(`B${row}`).value = inputs.retention?.retentionPct ?? model.retention.defaultRetentionPct;
    ws.getCell(`B${row}`).numFmt = '0.0%';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    retentionPctCell = `B${row}`;
    row++;

    ws.getCell(`A${row}`).value = "Retained supervisors";
    ws.getCell(`B${row}`).value = inputs.retention?.retainedSupervisors ?? model.retention.defaultRetainedSupervisors;
    ws.getCell(`B${row}`).numFmt = '#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    retainedSupCell = `B${row}`;
    row++;

    // Retained direct labor = directLabor × retentionPct × enabled
    ws.getCell(`A${row}`).value = "  Retained direct labor";
    ws.getCell(`E${row}`).value = {
      formula: `${directLaborCell}*${retentionPctCell}*${retentionEnabledCell}`,
    };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
    style(ws.getCell(`E${row}`), { size: 10, color: "FF64748B", align: "right" });
    retainedDirectCostCell = `E${row}`;
    row++;

    // Retained supervisor cost = retainedSupCount × supSalary × enabled
    ws.getCell(`A${row}`).value = "  Retained supervisors";
    ws.getCell(`E${row}`).value = {
      formula: `${retainedSupCell}*${supSalaryCell}*${retentionEnabledCell}`,
    };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
    style(ws.getCell(`E${row}`), { size: 10, color: "FF64748B", align: "right" });
    retainedSupCostCell = `E${row}`;
    row++;

    // Retained benefits = (retainedDirect + retainedSupCost) × benefitsRate
    ws.getCell(`A${row}`).value = "  Retained benefits & taxes";
    ws.getCell(`E${row}`).value = {
      formula: `(${retainedDirectCostCell}+${retainedSupCostCell})*${benefitsRateCell}`,
    };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
    style(ws.getCell(`E${row}`), { size: 10, color: "FF64748B", align: "right" });
    retainedBenefitsCell = `E${row}`;
    row++;

    // Retained indirect = indirectTotal × retentionPct × enabled
    ws.getCell(`A${row}`).value = "  Retained indirect (pro-rated)";
    ws.getCell(`E${row}`).value = {
      formula: `${indirectTotalCell}*${retentionPctCell}*${retentionEnabledCell}`,
    };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
    style(ws.getCell(`E${row}`), { size: 10, color: "FF64748B", align: "right" });
    retainedIndirectCell = `E${row}`;
    row++;

    // Retention total
    ws.getCell(`A${row}`).value = "Retained Team Total";
    ws.getCell(`E${row}`).value = {
      formula: `${retainedDirectCostCell}+${retainedSupCostCell}+${retainedBenefitsCell}+${retainedIndirectCell}`,
    };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { bold: true });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    retentionTotalCell = `E${row}`;
    row += 2;

    // Post-outsourcing total = Indecomm fee + retention total
    ws.getCell(`A${row}`).value = "POST-OUTSOURCING TOTAL (Indecomm + retained team)";
    ws.getCell(`E${row}`).value = { formula: `${indecommFeeCell}+${retentionTotalCell}` };
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF" });
    style(ws.getCell(`E${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF", align: "right", size: 12 });
    postOutsourcingTotalCell = `E${row}`;
    row += 2;
  }

  // ============================================================================
  // SAVINGS + per-loan denominator (all formula-driven)
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Savings & per-loan figures";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  // Audited loans / year (denominator) — mirrors the engine:
  //   if perLoanDenominator: vol × sample (if applicable) × 12
  //   else: sum of perLoan pricing volumes × sample × 12
  let auditedLoansFormula: string;
  if (model.perLoanDenominator) {
    const d = model.perLoanDenominator;
    const volCell = volumeRows[d.volumeKey] ?? "B7";
    const sExpr = d.appliesSampleRate && sampleRateCell ? sampleRateCell : "1";
    auditedLoansFormula = `${volCell}*${sExpr}*12`;
  } else {
    const perLoanTerms: string[] = [];
    for (const p of model.pricing) {
      if (p.type === "perLoan") {
        const volCell = volumeRows[p.volumeKey] ?? "B7";
        const sExpr = p.appliesSampleRate && sampleRateCell ? sampleRateCell : "1";
        perLoanTerms.push(`${volCell}*${sExpr}*12`);
      }
    }
    auditedLoansFormula = perLoanTerms.length > 0 ? perLoanTerms.join("+") : "0";
  }
  ws.getCell(`A${row}`).value = "Audited loans / year";
  ws.getCell(`E${row}`).value = { formula: auditedLoansFormula };
  ws.getCell(`E${row}`).numFmt = '#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`E${row}`), { bold: true, align: "right" });
  const auditedLoansCell = `E${row}`;
  row++;

  // Annual savings
  ws.getCell(`A${row}`).value = "Annual Savings";
  ws.getCell(`E${row}`).value = { formula: `${internalTotalCell}-${postOutsourcingTotalCell}` };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF" });
  style(ws.getCell(`E${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF", align: "right" });
  const annualSavingsCell = `E${row}`;
  row++;

  // Savings %
  ws.getCell(`A${row}`).value = "Savings %";
  ws.getCell(`E${row}`).value = { formula: `IF(${internalTotalCell}=0,0,${annualSavingsCell}/${internalTotalCell})` };
  ws.getCell(`E${row}`).numFmt = '0.0%';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`E${row}`), { bold: true, align: "right" });
  const savingsPctCell = `E${row}`;
  row++;

  // Per-loan: internal
  ws.getCell(`A${row}`).value = "In-house Cost / Loan";
  ws.getCell(`E${row}`).value = { formula: `IF(${auditedLoansCell}=0,0,${internalTotalCell}/${auditedLoansCell})` };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0.00';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`E${row}`), { bold: true, align: "right" });
  const perLoanInternalCell = `E${row}`;
  row++;

  // Per-loan: post-outsourcing (Indecomm + retention)
  ws.getCell(`A${row}`).value = "Indecomm Cost / Loan";
  ws.getCell(`E${row}`).value = { formula: `IF(${auditedLoansCell}=0,0,${postOutsourcingTotalCell}/${auditedLoansCell})` };
  ws.getCell(`E${row}`).numFmt = '"$"#,##0.00';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`E${row}`), { bold: true, align: "right" });
  const perLoanOutsourcedCell = `E${row}`;
  row += 2;

  // ============================================================================
  // Fill in the KPI band callouts now that we know all the cell addresses.
  // ============================================================================
  const outsourcedLabel = model.retention ? "Post-Outsourcing Total" : "Indecomm Annual Cost";

  kpiCalloutFormula(ws, kpiRow1, 1, "In-house Annual Cost", internalTotalCell, '"$"#,##0', {
    accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY,
  });
  kpiCalloutFormula(ws, kpiRow1, 3, outsourcedLabel, postOutsourcingTotalCell, '"$"#,##0', {
    accentHex: theme.accent, tintHex: theme.accentTint, borderHex: theme.accent,
  });
  kpiCalloutFormula(ws, kpiRow1, 5, "Annual Savings", annualSavingsCell, '"$"#,##0', {
    accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent,
  });
  kpiCalloutFormula(ws, kpiRow2, 1, "Savings %", savingsPctCell, '0.0%', {
    accentHex: "FFFFFFFF", tintHex: theme.accent, borderHex: theme.accent,
  });
  kpiCalloutFormula(ws, kpiRow2, 3, "In-house Cost / Loan", perLoanInternalCell, '"$"#,##0.00', {
    accentHex: NAVY, tintHex: NAVY_TINT, borderHex: NAVY,
  });
  kpiCalloutFormula(ws, kpiRow2, 5, "Indecomm Cost / Loan", perLoanOutsourcedCell, '"$"#,##0.00', {
    accentHex: theme.accent, tintHex: theme.accentTint, borderHex: theme.accent,
  });

  // Sub-line: FTEs + audited volume (formula-driven)
  ws.mergeCells(`A${kpiSublineRow}:F${kpiSublineRow}`);
  ws.getCell(`A${kpiSublineRow}`).value = {
    formula: `"In-house FTEs needed: "&TEXT((${directFteSumExpr})+(${directFteSumExpr})/${spanCell},"0.00")&" · Audited loans/year: "&TEXT(${auditedLoansCell},"#,##0")`,
  };
  style(ws.getCell(`A${kpiSublineRow}`), { size: 10, color: "FF64748B", align: "center" });

  // ============================================================================
  // PER-LOAN BAR CHART (cell-rendered, non-formula but visually accurate to the
  // snapshot — Excel users get the live numbers from the KPI band above).
  // We use the engine's pre-computed per-loan values for the bar widths so the
  // visualization matches the moment of export. The labels under it show the
  // formula-driven cells, which update on edit.
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "PER-LOAN COST COMPARISON  (snapshot — edit inputs to see numbers update above)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  ws.getCell(`A${row}`).value = "";
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = "Cost per loan";
  ws.getCell(`F${row}`).value = "Live Value";
  style(ws.getCell(`A${row}`), { size: 10, color: "FF64748B" });
  style(ws.getCell(`B${row}`), { bold: true, color: "FF64748B", size: 10, align: "center" });
  style(ws.getCell(`F${row}`), { bold: true, color: "FF64748B", size: 10, align: "right" });
  row++;

  // Snapshot bar widths come from `r` (engine result at export time).
  // The displayed value in column F is a FORMULA — it updates when inputs change.
  const servicesMaxVal = Math.max(r.perLoanInternal, r.perLoanOutsourced, 1);
  const drawServicesBar = (label: string, snapshotValue: number, liveValueCell: string, color: string) => {
    const br = row;
    ws.getCell(`A${br}`).value = label;
    style(ws.getCell(`A${br}`), { bold: true });
    const totalCells = 4;
    const filled = Math.ceil((snapshotValue / servicesMaxVal) * totalCells);
    for (let i = 0; i < totalCells; i++) {
      const c = ws.getCell(`${String.fromCharCode(66 + i)}${br}`);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i < filled ? color : "FFEEF2F8" } };
      style(c, { color: "FFFFFFFF", size: 9 });
    }
    const last = ws.getCell(`F${br}`);
    last.value = { formula: liveValueCell };
    last.numFmt = '"$"#,##0.00';
    style(last, { bold: true, color: "FF002060", align: "right", size: 12 });
    ws.getRow(br).height = 22;
    row++;
  };
  drawServicesBar("In-house", r.perLoanInternal, perLoanInternalCell, NAVY);
  drawServicesBar(model.retention ? "Post-Outsourcing + Retention" : "Indecomm", r.perLoanOutsourced, perLoanOutsourcedCell, theme.accent);
  row += 2;

  // ============================================================================
  // Footer
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm · This workbook is fully formula-driven — edit any value in the INPUTS block and all downstream totals will recalculate. Figures are illustrative; not a contractual offer.";
  style(ws.getCell(`A${row}`), { size: 9, color: "FF64748B", align: "center" });

  // Force Excel to recalculate on open so the KPI band shows correct values
  // even on first open (ExcelJS sets calcProperties.fullCalcOnLoad).

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fname = `Indecomm-ROI-${safeFilename(model.name)}-${safeFilename(clientName)}-${todayStr()}.xlsx`;
  await downloadBlob(blob, fname);

  // Reference unused-but-useful values so the linter doesn't trip on
  // intentionally-not-surfaced cell addresses.
  void retentionTotalCell;
  void retainedDirectCostCell;
  void retainedSupCostCell;
  void retainedBenefitsCell;
  void retainedIndirectCell;
  void r;
}

// =========================================================================
// SAAS EXPORT
// =========================================================================

export async function exportSaasToExcel(model: SaasModelConfig, inputs: SaasInputs): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Indecomm ROI Calculator";
  wb.created = new Date();

  // We still compute the result so the workbook contains "result" hints for
  // every formula (Excel uses these as last-known values until it recalculates
  // on open). The visible numbers all come from live formulas — edit any input
  // and downstream totals update.
  const r = computeSaasRoi(model, inputs);
  const clientName = inputs.clientName?.trim() || "(Client)";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const theme = makeTheme(model.platform.accentHex);
  const threeYear = model.enableThreeYearView === true;
  const esc = model.pricingEscalatorAnnual ?? 0;
  const capacityFreed = model.tone === "capacity-freed";
  const fteLabel = capacityFreed ? "FTE Capacity Freed" : "FTEs Reduced";

  const ws = wb.addWorksheet("Automation ROI", {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
  });
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  // ============================================================================
  // HEADER (rows 1–4)
  // ============================================================================
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `Indecomm Automation ROI — ${model.name}`;
  style(ws.getCell("A1"), { hex: NAVY, bold: true, size: 18 });
  style(ws.getCell("F1"), { hex: NAVY });
  ws.getRow(1).height = 44;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Platform: ${model.platform.name}`;
  style(ws.getCell("A2"), { hex: NAVY, size: 10, color: "FFE6ECF5" });

  // Embed product logo (top-right). Prefer the white-version when available.
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

  // ============================================================================
  // INPUTS BLOCK — all editable, all formula-referenced downstream.
  //
  // We track each named row so the formula-building code below can reference
  // cells by label rather than hard-coding row numbers. This makes the section
  // safe to reorder later without breaking formulas.
  // ============================================================================
  let row = 6;

  // Section header
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "INPUTS  (edit any value below — totals recalculate automatically)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 22;
  row++;

  // ---- Volumes ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Volumes (monthly)";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  // Track each volume's cell address so role formulas can reference them.
  const volumeRows: Record<string, string> = {}; // volumeKey → "B12" etc.
  for (const v of model.volumeInputs) {
    if (v.type === "derived") continue;
    const monthly = inputs.volumes[v.id] ?? v.defaultValue;
    ws.getCell(`A${row}`).value = v.label;
    ws.getCell(`B${row}`).value = monthly;
    ws.getCell(`B${row}`).numFmt = '#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    volumeRows[v.id] = `B${row}`;
    row++;
  }
  row++;

  // ---- Roles ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Roles — productivity & rates";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  // Column headers for the roles block
  ["Role", "Baseline Prod/day", "Improvement %", "Hourly Rate", "FTEs Before", "FTEs After"]
    .forEach((h, i) => {
      const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
      c.value = h;
      style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
    });
  row++;

  // Track per-role cell addresses so downstream cost formulas can reference them.
  type RoleRef = {
    roleId: string;
    label: string;
    rowNum: number;
    volumeCell: string;     // volume cell address (B-column)
    baselineCell: string;   // baseline productivity (B)
    improvementCell: string;// improvement % (C)
    hourlyCell: string;     // hourly rate (D)
    fteBeforeCell: string;  // FTEs Before (E) — formula
    fteAfterCell: string;   // FTEs After (F) — formula
    basis: "perDay" | "perMonth";
  };
  const roleRefs: RoleRef[] = [];

  for (const role of model.roles) {
    const ri = inputs.roles[role.id];
    const baseline = ri?.baselineProductivity ?? role.defaultBaselineProductivity;
    const lift = ri?.improvementPct ?? role.defaultImprovementPct;
    const hr = ri?.hourlyRate ?? role.defaultHourlyRate;

    // Locate the per-role volume cell. Each NFCU role has its own volume
    // (respaVolume / postCloseVolume / trailingDocsVolume).
    const volCell = volumeRows[role.volumeKey] ?? "B7"; // fallback

    ws.getCell(`A${row}`).value = role.label;
    ws.getCell(`B${row}`).value = baseline;
    ws.getCell(`C${row}`).value = lift;
    ws.getCell(`D${row}`).value = hr;

    // FTE formulas:
    //   perDay basis:  FTEs = ROUND(volume / 20 / productivity, 0)
    //   perMonth basis: FTEs = ROUND(volume / productivity, 0)
    // Improved productivity = baseline * (1 + improvement %)
    //
    // When the role is fully eliminated by the platform (e.g. IDXGenius
    // replacing manual indexing), force FTEs After to 0 — matches the
    // engine's eliminatedByPlatform override.
    if (role.productivityBasis === "perDay") {
      ws.getCell(`E${row}`).value = { formula: `ROUND(${volCell}/20/B${row},0)` };
      ws.getCell(`F${row}`).value = role.eliminatedByPlatform
        ? 0
        : { formula: `ROUND(${volCell}/20/(B${row}*(1+C${row})),0)` };
    } else {
      ws.getCell(`E${row}`).value = { formula: `ROUND(${volCell}/B${row},0)` };
      ws.getCell(`F${row}`).value = role.eliminatedByPlatform
        ? 0
        : { formula: `ROUND(${volCell}/(B${row}*(1+C${row})),0)` };
    }

    // Number formats
    ws.getCell(`B${row}`).numFmt = '#,##0.00';
    ws.getCell(`C${row}`).numFmt = '0.0%';
    ws.getCell(`D${row}`).numFmt = '"$"#,##0';
    ws.getCell(`E${row}`).numFmt = '#,##0';
    ws.getCell(`F${row}`).numFmt = '#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`C${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`D${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`E${row}`), { bold: true, align: "right" });
    style(ws.getCell(`F${row}`), { bold: true, align: "right", color: theme.accent });

    roleRefs.push({
      roleId: role.id,
      label: role.label,
      rowNum: row,
      volumeCell: volCell,
      baselineCell: `B${row}`,
      improvementCell: `C${row}`,
      hourlyCell: `D${row}`,
      fteBeforeCell: `E${row}`,
      fteAfterCell: `F${row}`,
      basis: role.productivityBasis,
    });
    row++;
  }
  row++;

  // ---- Supervisor & Benefits ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Supervisor & Benefits";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ws.getCell(`A${row}`).value = "Span of control";
  ws.getCell(`B${row}`).value = inputs.supervisor.spanOfControl;
  ws.getCell(`B${row}`).numFmt = '#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const spanCell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Annual supervisor salary";
  ws.getCell(`B${row}`).value = inputs.supervisor.salary;
  ws.getCell(`B${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const supSalaryCell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Benefits & Taxes %";
  ws.getCell(`B${row}`).value = inputs.benefitsRate;
  ws.getCell(`B${row}`).numFmt = '0.0%';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const benefitsRateCell = `B${row}`;
  row++;
  row++;

  // ---- Indirect costs ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indirect Costs (annual pool × allocation %)";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  ["Category", "Annual Pool", "Allocation %", "Cost (Before)"]
    .forEach((h, i) => {
      const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
      c.value = h;
      style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
    });
  row++;

  type IndirectRef = { id: string; poolCell: string; pctCell: string; costCell: string; rowNum: number };
  const indirectRefs: IndirectRef[] = [];
  for (const i of model.indirectCosts) {
    const ii = inputs.indirect[i.id];
    ws.getCell(`A${row}`).value = i.label;
    ws.getCell(`B${row}`).value = ii?.monthlyCost ?? i.defaultAnnualPool;
    ws.getCell(`C${row}`).value = ii?.beforeAllocationPct ?? i.defaultAllocationPct;
    ws.getCell(`D${row}`).value = { formula: `B${row}*C${row}` };
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    ws.getCell(`C${row}`).numFmt = '0.0%';
    ws.getCell(`D${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`C${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    style(ws.getCell(`D${row}`), { bold: true, align: "right" });
    indirectRefs.push({ id: i.id, poolCell: `B${row}`, pctCell: `C${row}`, costCell: `D${row}`, rowNum: row });
    row++;
  }

  // Indirect Total (Before) — sum of cost cells; will be reused in "After" via FTE ratio.
  ws.getCell(`A${row}`).value = "Indirect Total (Before)";
  if (indirectRefs.length > 0) {
    const sumRange = `${indirectRefs[0].costCell}:${indirectRefs[indirectRefs.length - 1].costCell}`;
    ws.getCell(`D${row}`).value = { formula: `SUM(${sumRange})` };
  } else {
    ws.getCell(`D${row}`).value = 0;
  }
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  style(ws.getCell(`D${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  const indirectTotalBeforeCell = `D${row}`;
  row++;
  row++;

  // ---- Current Platform Cost (legacy systems being replaced) ----
  let currentPlatformCell: string | undefined;
  if (model.pricing.defaultCurrentPlatformAnnualCost !== undefined) {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = "Current Platform Cost (Legacy Systems)";
    style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
    row++;

    ws.getCell(`A${row}`).value = "Annual cost of current platforms (Y1)";
    ws.getCell(`B${row}`).value = inputs.pricing.currentPlatformAnnualCost ?? 0;
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    currentPlatformCell = `B${row}`;
    row++;
    row++;
  }

  // ---- Indecomm Pricing ----
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm Platform Pricing";
  style(ws.getCell(`A${row}`), { hex: LIGHT_NAVY, bold: true });
  row++;

  let licenseCell: string;
  if (model.pricing.defaultFixedAnnualLicense !== undefined) {
    ws.getCell(`A${row}`).value = "Annual license (Y1, RFP-quoted)";
    ws.getCell(`B${row}`).value = inputs.pricing.fixedAnnualLicense ?? 0;
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    licenseCell = `B${row}`;
    row++;
  } else {
    ws.getCell(`A${row}`).value = "License per loan per month";
    ws.getCell(`B${row}`).value = inputs.pricing.perLoanMonthlyFee;
    ws.getCell(`B${row}`).numFmt = '"$"#,##0.00';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
    const perLoanFeeCell = `B${row}`;
    row++;

    // Annual license derived: volume × 12 × per-loan fee.
    // Use the first role's volume key as the denominator (matches engine).
    const firstVolCell = Object.values(volumeRows)[0] ?? "B7";
    ws.getCell(`A${row}`).value = "Annual license (computed)";
    ws.getCell(`B${row}`).value = { formula: `${firstVolCell}*12*${perLoanFeeCell}` };
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { bold: true });
    style(ws.getCell(`B${row}`), { bold: true, align: "right" });
    licenseCell = `B${row}`;
    row++;
  }

  ws.getCell(`A${row}`).value = "Implementation fee (one-time, Y1)";
  ws.getCell(`B${row}`).value = inputs.pricing.oneTimeImplementationFee;
  ws.getCell(`B${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const implCell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Annual escalator % (Y2 / Y3)";
  ws.getCell(`B${row}`).value = esc;
  ws.getCell(`B${row}`).numFmt = '0.0%';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { bold: true, align: "right", hex: "FFFFF8DC" });
  const escCell = `B${row}`;
  row++;
  row += 2;

  // ============================================================================
  // COMPUTED RESULTS — all formulas referencing the input cells above.
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "ANNUAL COST BUILD-UP  (formulas — edit inputs above to recalculate)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  ws.getRow(row).height = 20;
  row++;

  // Headers: Component / FTEs Before / FTEs After / Cost Before / Cost After
  ["Component", "FTEs Before", "FTEs After", "Cost Before", "Cost After"].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  // Per-role direct cost rows (Before/After).
  //   Cost = FTEs × (hourly rate × 2080)
  const roleCostRows: { beforeCostCell: string; afterCostCell: string; fteBefore: string; fteAfter: string }[] = [];
  for (const rref of roleRefs) {
    ws.getCell(`A${row}`).value = rref.label;
    ws.getCell(`B${row}`).value = { formula: `${rref.fteBeforeCell}` };
    ws.getCell(`C${row}`).value = { formula: `${rref.fteAfterCell}` };
    ws.getCell(`D${row}`).value = { formula: `${rref.fteBeforeCell}*${rref.hourlyCell}*2080` };
    ws.getCell(`E${row}`).value = { formula: `${rref.fteAfterCell}*${rref.hourlyCell}*2080` };
    ws.getCell(`B${row}`).numFmt = '#,##0';
    ws.getCell(`C${row}`).numFmt = '#,##0';
    ws.getCell(`D${row}`).numFmt = '"$"#,##0';
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`B${row}`), { align: "right" });
    style(ws.getCell(`C${row}`), { align: "right", color: theme.accent });
    style(ws.getCell(`D${row}`), { align: "right" });
    style(ws.getCell(`E${row}`), { align: "right", color: theme.accent });
    roleCostRows.push({
      beforeCostCell: `D${row}`,
      afterCostCell: `E${row}`,
      fteBefore: `B${row}`,
      fteAfter: `C${row}`,
    });
    row++;
  }

  // Direct roles subtotal
  const directRolesStart = roleCostRows[0]?.beforeCostCell ?? "D1";
  const directRolesEnd = roleCostRows[roleCostRows.length - 1]?.beforeCostCell ?? "D1";
  const directRolesAfterStart = roleCostRows[0]?.afterCostCell ?? "E1";
  const directRolesAfterEnd = roleCostRows[roleCostRows.length - 1]?.afterCostCell ?? "E1";
  const fteBeforeStart = roleCostRows[0]?.fteBefore ?? "B1";
  const fteBeforeEnd = roleCostRows[roleCostRows.length - 1]?.fteBefore ?? "B1";
  const fteAfterStart = roleCostRows[0]?.fteAfter ?? "C1";
  const fteAfterEnd = roleCostRows[roleCostRows.length - 1]?.fteAfter ?? "C1";

  ws.getCell(`A${row}`).value = "Direct roles subtotal";
  ws.getCell(`B${row}`).value = { formula: `SUM(${fteBeforeStart}:${fteBeforeEnd})` };
  ws.getCell(`C${row}`).value = { formula: `SUM(${fteAfterStart}:${fteAfterEnd})` };
  ws.getCell(`D${row}`).value = { formula: `SUM(${directRolesStart}:${directRolesEnd})` };
  ws.getCell(`E${row}`).value = { formula: `SUM(${directRolesAfterStart}:${directRolesAfterEnd})` };
  ws.getCell(`B${row}`).numFmt = '#,##0';
  ws.getCell(`C${row}`).numFmt = '#,##0';
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  ["A", "B", "C", "D", "E"].forEach((col) => style(ws.getCell(`${col}${row}`), { hex: LIGHT_GRAY, bold: true, align: col === "A" ? "left" : "right" }));
  const directRolesFteBeforeSumCell = `B${row}`;
  const directRolesFteAfterSumCell = `C${row}`;
  const directRolesCostBeforeCell = `D${row}`;
  const directRolesCostAfterCell = `E${row}`;
  row++;

  // Supervisor: FTE = direct FTE / span; cost = FTE × salary.
  ws.getCell(`A${row}`).value = "Supervisor / Manager";
  ws.getCell(`B${row}`).value = { formula: `${directRolesFteBeforeSumCell}/${spanCell}` };
  ws.getCell(`C${row}`).value = { formula: `${directRolesFteAfterSumCell}/${spanCell}` };
  ws.getCell(`D${row}`).value = { formula: `B${row}*${supSalaryCell}` };
  ws.getCell(`E${row}`).value = { formula: `C${row}*${supSalaryCell}` };
  ws.getCell(`B${row}`).numFmt = '#,##0.00';
  ws.getCell(`C${row}`).numFmt = '#,##0.00';
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`B${row}`), { align: "right" });
  style(ws.getCell(`C${row}`), { align: "right", color: theme.accent });
  style(ws.getCell(`D${row}`), { align: "right" });
  style(ws.getCell(`E${row}`), { align: "right", color: theme.accent });
  const supFteBeforeCell = `B${row}`;
  const supFteAfterCell = `C${row}`;
  const supCostBeforeCell = `D${row}`;
  const supCostAfterCell = `E${row}`;
  row++;

  // Direct total (incl. supervisor)
  ws.getCell(`A${row}`).value = "Direct total (incl. supervisor)";
  ws.getCell(`D${row}`).value = { formula: `${directRolesCostBeforeCell}+${supCostBeforeCell}` };
  ws.getCell(`E${row}`).value = { formula: `${directRolesCostAfterCell}+${supCostAfterCell}` };
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  ["A", "B", "C", "D", "E"].forEach((col) => style(ws.getCell(`${col}${row}`), { hex: LIGHT_GRAY, bold: true, align: col === "A" ? "left" : "right" }));
  const directTotalBeforeCell = `D${row}`;
  const directTotalAfterCell = `E${row}`;
  row++;

  // Benefits
  ws.getCell(`A${row}`).value = "Benefits & Taxes";
  ws.getCell(`D${row}`).value = { formula: `${directTotalBeforeCell}*${benefitsRateCell}` };
  ws.getCell(`E${row}`).value = { formula: `${directTotalAfterCell}*${benefitsRateCell}` };
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`D${row}`), { align: "right" });
  style(ws.getCell(`E${row}`), { align: "right", color: theme.accent });
  const benefitsBeforeCell = `D${row}`;
  const benefitsAfterCell = `E${row}`;
  row++;

  // Indirect — After scales proportionally with FTE ratio (matches engine).
  ws.getCell(`A${row}`).value = "Indirect costs (Before / After ratio)";
  ws.getCell(`D${row}`).value = { formula: `${indirectTotalBeforeCell}` };
  ws.getCell(`E${row}`).value = {
    formula: `IF(${directRolesFteBeforeSumCell}=0,0,${indirectTotalBeforeCell}*(${directRolesFteAfterSumCell}/${directRolesFteBeforeSumCell}))`,
  };
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  style(ws.getCell(`A${row}`));
  style(ws.getCell(`D${row}`), { align: "right" });
  style(ws.getCell(`E${row}`), { align: "right", color: theme.accent });
  const indirectBeforeRefCell = `D${row}`;
  const indirectAfterRefCell = `E${row}`;
  row++;

  // Current Platform Cost row (Before only; legacy system being replaced)
  if (currentPlatformCell) {
    ws.getCell(`A${row}`).value = "Current platform cost (legacy systems)";
    ws.getCell(`D${row}`).value = { formula: `${currentPlatformCell}` };
    ws.getCell(`E${row}`).value = 0;
    ws.getCell(`D${row}`).numFmt = '"$"#,##0';
    ws.getCell(`E${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`));
    style(ws.getCell(`D${row}`), { align: "right" });
    style(ws.getCell(`E${row}`), { align: "right", color: "FF94A3B8" });
    row++;
  }

  // In-house annual total — sum of direct + benefits + indirect (+ current platform for Before)
  ws.getCell(`A${row}`).value = "IN-HOUSE ANNUAL TOTAL";
  if (currentPlatformCell) {
    ws.getCell(`D${row}`).value = {
      formula: `${directTotalBeforeCell}+${benefitsBeforeCell}+${indirectBeforeRefCell}+${currentPlatformCell}`,
    };
  } else {
    ws.getCell(`D${row}`).value = {
      formula: `${directTotalBeforeCell}+${benefitsBeforeCell}+${indirectBeforeRefCell}`,
    };
  }
  ws.getCell(`E${row}`).value = {
    formula: `${directTotalAfterCell}+${benefitsAfterCell}+${indirectAfterRefCell}`,
  };
  ws.getCell(`D${row}`).numFmt = '"$"#,##0';
  ws.getCell(`E${row}`).numFmt = '"$"#,##0';
  ["A", "B", "C", "D", "E"].forEach((col) => style(ws.getCell(`${col}${row}`), { hex: NAVY, bold: true, color: "FFFFFFFF", align: col === "A" ? "left" : "right" }));
  const annualBeforeCell = `D${row}`;
  const annualAfterCell = `E${row}`;
  row += 2;

  // ============================================================================
  // PLATFORM SPEND BY YEAR (Y1 / Y2 / Y3) — uses escalator.
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "PLATFORM SPEND BY YEAR  (Y1 includes one-time implementation)";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  ["", "Year 1", "Year 2", "Year 3"].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  ws.getCell(`A${row}`).value = "Annual license";
  ws.getCell(`B${row}`).value = { formula: `${licenseCell}` };
  ws.getCell(`C${row}`).value = { formula: `${licenseCell}*(1+${escCell})` };
  ws.getCell(`D${row}`).value = { formula: `${licenseCell}*(1+${escCell})*(1+${escCell})` };
  ["B", "C", "D"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { align: "right" });
  });
  style(ws.getCell(`A${row}`));
  const licenseY1Cell = `B${row}`;
  const licenseY2Cell = `C${row}`;
  const licenseY3Cell = `D${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Implementation (Y1 only)";
  ws.getCell(`B${row}`).value = { formula: `${implCell}` };
  ws.getCell(`C${row}`).value = 0;
  ws.getCell(`D${row}`).value = 0;
  ["B", "C", "D"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { align: "right" });
  });
  style(ws.getCell(`A${row}`));
  const implY1Cell = `B${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Platform spend";
  ws.getCell(`B${row}`).value = { formula: `${licenseY1Cell}+${implY1Cell}` };
  ws.getCell(`C${row}`).value = { formula: `${licenseY2Cell}` };
  ws.getCell(`D${row}`).value = { formula: `${licenseY3Cell}` };
  ["B", "C", "D"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { hex: LIGHT_GRAY, bold: true, align: "right" });
  });
  style(ws.getCell(`A${row}`), { hex: LIGHT_GRAY, bold: true });
  const platY1Cell = `B${row}`;
  const platY2Cell = `C${row}`;
  const platY3Cell = `D${row}`;
  row += 2;

  // ============================================================================
  // SAVINGS BY YEAR (with legacy platform cost escalating Y2/Y3)
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "ANNUAL SAVINGS BY YEAR";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  ["Metric", "Year 1", "Year 2", "Year 3", "3-Year Cumulative"].forEach((h, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i)}${row}`);
    c.value = h;
    style(c, { hex: LIGHT_GRAY, bold: true, align: i === 0 ? "left" : "right" });
  });
  row++;

  // "Before" annual escalates with legacy platform (when present).
  // Y2 Before = (annualBefore − legacyY1) + legacyY1×(1+esc)
  //          = annualBefore + legacyY1×esc
  // Y3 Before = annualBefore + legacyY1×((1+esc)^2 − 1)
  const legacyCellExpr = currentPlatformCell ?? "0";
  ws.getCell(`A${row}`).value = "In-house Before (annual)";
  ws.getCell(`B${row}`).value = { formula: `${annualBeforeCell}` };
  ws.getCell(`C${row}`).value = { formula: `${annualBeforeCell}+${legacyCellExpr}*${escCell}` };
  ws.getCell(`D${row}`).value = { formula: `${annualBeforeCell}+${legacyCellExpr}*((1+${escCell})*(1+${escCell})-1)` };
  ws.getCell(`E${row}`).value = { formula: `B${row}+C${row}+D${row}` };
  ["B", "C", "D", "E"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { align: "right" });
  });
  style(ws.getCell(`A${row}`));
  const beforeY1Cell = `B${row}`;
  const beforeY2Cell = `C${row}`;
  const beforeY3Cell = `D${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Total spend with Indecomm";
  ws.getCell(`B${row}`).value = { formula: `${annualAfterCell}+${platY1Cell}` };
  ws.getCell(`C${row}`).value = { formula: `${annualAfterCell}+${platY2Cell}` };
  ws.getCell(`D${row}`).value = { formula: `${annualAfterCell}+${platY3Cell}` };
  ws.getCell(`E${row}`).value = { formula: `B${row}+C${row}+D${row}` };
  ["B", "C", "D", "E"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { align: "right" });
  });
  style(ws.getCell(`A${row}`));
  const totalSpendY1 = `B${row}`;
  const totalSpendY2 = `C${row}`;
  const totalSpendY3 = `D${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Annual Savings";
  ws.getCell(`B${row}`).value = { formula: `${beforeY1Cell}-${totalSpendY1}` };
  ws.getCell(`C${row}`).value = { formula: `${beforeY2Cell}-${totalSpendY2}` };
  ws.getCell(`D${row}`).value = { formula: `${beforeY3Cell}-${totalSpendY3}` };
  ws.getCell(`E${row}`).value = { formula: `B${row}+C${row}+D${row}` };
  ["B", "C", "D", "E"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`${col}${row}`), { hex: theme.accent, bold: true, align: "right" });
  });
  style(ws.getCell(`A${row}`), { hex: theme.accent, bold: true });
  const savingsY1 = `B${row}`;
  const savingsY2 = `C${row}`;
  const savingsY3 = `D${row}`;
  const cumulativeSavings = `E${row}`;
  row++;

  ws.getCell(`A${row}`).value = "Savings %";
  ws.getCell(`B${row}`).value = { formula: `IF(${beforeY1Cell}=0,0,${savingsY1}/${beforeY1Cell})` };
  ws.getCell(`C${row}`).value = { formula: `IF(${beforeY2Cell}=0,0,${savingsY2}/${beforeY2Cell})` };
  ws.getCell(`D${row}`).value = { formula: `IF(${beforeY3Cell}=0,0,${savingsY3}/${beforeY3Cell})` };
  ws.getCell(`E${row}`).value = { formula: `IF((${beforeY1Cell}+${beforeY2Cell}+${beforeY3Cell})=0,0,${cumulativeSavings}/(${beforeY1Cell}+${beforeY2Cell}+${beforeY3Cell}))` };
  ["B", "C", "D", "E"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '0.0%';
    style(ws.getCell(`${col}${row}`), { align: "right" });
  });
  style(ws.getCell(`A${row}`));
  row++;

  // ROI % row — savings ÷ Indecomm platform spend (matches the on-screen ROI line).
  // Cumulative ROI = total savings ÷ total platform spend across Y1+Y2+Y3.
  ws.getCell(`A${row}`).value = "ROI %";
  ws.getCell(`B${row}`).value = { formula: `IF(${platY1Cell}=0,0,${savingsY1}/${platY1Cell})` };
  ws.getCell(`C${row}`).value = { formula: `IF(${platY2Cell}=0,0,${savingsY2}/${platY2Cell})` };
  ws.getCell(`D${row}`).value = { formula: `IF(${platY3Cell}=0,0,${savingsY3}/${platY3Cell})` };
  ws.getCell(`E${row}`).value = { formula: `IF((${platY1Cell}+${platY2Cell}+${platY3Cell})=0,0,${cumulativeSavings}/(${platY1Cell}+${platY2Cell}+${platY3Cell}))` };
  ["B", "C", "D", "E"].forEach((col) => {
    ws.getCell(`${col}${row}`).numFmt = '0%';
    style(ws.getCell(`${col}${row}`), { align: "right", bold: true });
  });
  style(ws.getCell(`A${row}`), { bold: true });
  const cumulativeRoiCell = `E${row}`;
  row += 2;

  // ============================================================================
  // KPI BAND (callout boxes referencing formulas above) — places the headline
  // numbers prominently. These are formula-driven too.
  // ============================================================================
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = threeYear ? "3-YEAR ROI HEADLINE" : "ROI HEADLINE";
  style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, size: 12 });
  row++;

  if (threeYear) {
    // Year 1 / Year 2 / Year 3 / Cumulative
    ws.getCell(`A${row}`).value = "Y1 Savings";
    ws.getCell(`B${row}`).value = { formula: `${savingsY1}` };
    ws.getCell(`C${row}`).value = "Y2 Savings";
    ws.getCell(`D${row}`).value = { formula: `${savingsY2}` };
    ws.getCell(`E${row}`).value = "Y3 Savings";
    ws.getCell(`F${row}`).value = { formula: `${savingsY3}` };
    ["B", "D", "F"].forEach((col) => {
      ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
      style(ws.getCell(`${col}${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF", align: "right", size: 13 });
    });
    ["A", "C", "E"].forEach((col) => style(ws.getCell(`${col}${row}`), { hex: theme.accentTint, bold: true }));
    row++;

    ws.getCell(`A${row}`).value = "3-Year Cumulative Savings";
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = { formula: `${cumulativeSavings}` };
    ws.getCell(`B${row}`).numFmt = '"$"#,##0';
    style(ws.getCell(`A${row}`), { hex: NAVY, bold: true, color: "FFFFFFFF" });
    style(ws.getCell(`B${row}`), { hex: NAVY, bold: true, color: "FFFFFFFF", align: "right", size: 14 });
    row++;

    // Headline cumulative-ROI banner (parallel to the on-screen colored banner).
    ws.getCell(`A${row}`).value = "3-Year Cumulative ROI";
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = { formula: `${cumulativeRoiCell}` };
    ws.getCell(`B${row}`).numFmt = '0%';
    style(ws.getCell(`A${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF" });
    style(ws.getCell(`B${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF", align: "right", size: 14 });
    row++;

    ws.getCell(`A${row}`).value = fteLabel;
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = { formula: `${directRolesFteBeforeSumCell}+${supFteBeforeCell}-${directRolesFteAfterSumCell}-${supFteAfterCell}` };
    ws.getCell(`B${row}`).numFmt = '#,##0.00';
    style(ws.getCell(`A${row}`), { bold: true });
    style(ws.getCell(`B${row}`), { bold: true, align: "right" });
    row++;
  } else {
    // 2-year layout
    ws.getCell(`A${row}`).value = "Y1 Savings";
    ws.getCell(`B${row}`).value = { formula: `${savingsY1}` };
    ws.getCell(`C${row}`).value = "Y2 Savings";
    ws.getCell(`D${row}`).value = { formula: `${savingsY2}` };
    ["B", "D"].forEach((col) => {
      ws.getCell(`${col}${row}`).numFmt = '"$"#,##0';
      style(ws.getCell(`${col}${row}`), { hex: theme.accent, bold: true, color: "FFFFFFFF", align: "right", size: 13 });
    });
    ["A", "C"].forEach((col) => style(ws.getCell(`${col}${row}`), { hex: theme.accentTint, bold: true }));
    row++;

    ws.getCell(`A${row}`).value = fteLabel;
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = { formula: `${directRolesFteBeforeSumCell}+${supFteBeforeCell}-${directRolesFteAfterSumCell}-${supFteAfterCell}` };
    ws.getCell(`B${row}`).numFmt = '#,##0.00';
    style(ws.getCell(`A${row}`), { bold: true });
    style(ws.getCell(`B${row}`), { bold: true, align: "right" });
    row++;
  }

  row += 2;

  // Footer
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = "Indecomm · This workbook is fully formula-driven — edit any value in the INPUTS block above and all downstream totals will recalculate. Figures are illustrative and based on assumptions entered by the user; not a contractual offer.";
  style(ws.getCell(`A${row}`), { size: 9, color: "FF64748B", align: "center" });

  // Force Excel to recalculate on open so the formulas show correct values
  // even without us providing cached results.
  // (ExcelJS sets `properties.calcProperties.fullCalcOnLoad` automatically.)

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fname = `Indecomm-Automation-ROI-${safeFilename(model.name)}-${safeFilename(clientName)}-${todayStr()}.xlsx`;
  await downloadBlob(blob, fname);

  // Reference unused-by-headline-but-useful values so TS doesn't complain when
  // we choose not to surface them in the KPI band yet.
  void r;
}
