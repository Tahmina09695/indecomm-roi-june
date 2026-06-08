"use client";
import { useState } from "react";
import { useSaasScenario } from "@/store/saasScenarioStore";

export function SaasActionBar() {
  const model = useSaasScenario((s) => s.model);
  const inputs = useSaasScenario((s) => s.inputs);
  const reset = useSaasScenario((s) => s.reset);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const onSaveExcel = async () => {
    if (!model || busy) return;
    try {
      setBusy(true);
      const { exportSaasToExcel } = await import("@/lib/excel-export");
      await exportSaasToExcel(model, inputs);
      showToast("Excel file downloaded");
    } catch (err) {
      console.error(err);
      showToast("Excel export failed — see console");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {/* Primary action (orange) — the polished per-prospect artifact. */}
      <button
        onClick={() => window.print()}
        className="bg-orange text-navy font-semibold text-sm rounded-md px-3 py-2 hover:brightness-95"
      >
        Download Dashboard
      </button>
      <button
        onClick={onSaveExcel}
        disabled={busy}
        className="bg-white border border-slate-300 text-navy font-semibold text-sm rounded-md px-3 py-2 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait"
      >
        {busy ? "Saving…" : "Save to Excel"}
      </button>
      <button
        onClick={() => { if (confirm("Reset to model defaults?")) reset(); }}
        className="text-slate-500 text-sm rounded-md px-3 py-2 hover:text-navy"
      >
        Reset
      </button>
      {toast && (
        <span className="text-xs bg-navy text-white px-3 py-1.5 rounded-md">{toast}</span>
      )}
    </div>
  );
}
