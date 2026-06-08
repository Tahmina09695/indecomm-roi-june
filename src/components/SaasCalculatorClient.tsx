"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Header } from "./Header";
import { PlatformCallout } from "./PlatformCallout";
import { SaasVolumeInputs } from "./saas/SaasVolumeInputs";
import { SaasRolesTable } from "./saas/SaasRolesTable";
import { SaasInternalCostInputs } from "./saas/SaasInternalCostInputs";
import { SaasPricingInputs } from "./saas/SaasPricingInputs";
import { SaasResultsPanel } from "./saas/SaasResultsPanel";
import { SaasActionBar } from "./saas/SaasActionBar";
import { SaasPrintSummary } from "./saas/SaasPrintSummary";
import { useSaasScenario } from "@/store/saasScenarioStore";
import { readHashScenario, writeHashScenario, loadLocal, saveLocal } from "@/lib/share";
import { SAAS_MODELS, getGroupForModel } from "@/models";

export function SaasCalculatorClient({ modelId }: { modelId: string }) {
  const model = SAAS_MODELS[modelId];
  const group = getGroupForModel(modelId);
  const setModel = useSaasScenario((s) => s.setModel);
  const setClientName = useSaasScenario((s) => s.setClientName);
  const inputs = useSaasScenario((s) => s.inputs);
  const hydrated = useRef(false);

  // Hydrate on mount
  useEffect(() => {
    if (!model) return;
    const fromHash = readHashScenario();
    if (fromHash) {
      setModel(model, fromHash as any);
    } else {
      const fromLocal = loadLocal(`saas-${model.id}`);
      setModel(model, (fromLocal as any) ?? null);
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Persist on change
  useEffect(() => {
    if (!hydrated.current || !model) return;
    const t = setTimeout(() => {
      writeHashScenario(inputs as any);
      saveLocal(`saas-${model.id}`, inputs as any);
    }, 250);
    return () => clearTimeout(t);
  }, [inputs, model]);

  if (!model) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        productLogoSrc={model.platform.logo}
        productName={model.platform.name}
        groupHref={group ? `/group/${group.id}` : undefined}
        groupName={group?.name}
      />

      <main className="flex-1" style={{ background: "linear-gradient(180deg, #F7F8FC 0%, #EEF2FB 100%)" }}>
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <nav className="text-xs text-slate-500 mb-1">
                <Link href="/" className="hover:text-orange">All Groups</Link>
                {group && (
                  <>
                    <span className="mx-1.5 opacity-60">/</span>
                    <Link href={`/group/${group.id}`} className="hover:text-orange">{group.name}</Link>
                  </>
                )}
              </nav>
              <h1 className="text-2xl font-bold text-navy">{model.name}</h1>
              <div className="text-xs text-slate-500">SaaS / Licensing — Automation ROI</div>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  value={inputs.clientName ?? ""}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter client name"
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange/40 outline-none"
                />
              </div>
              <SaasActionBar />
            </div>
          </div>

          <PlatformCallout
            name={model.platform.name}
            logoSrc={model.platform.logo}
            blurb={model.platform.blurb}
            capabilities={model.platform.capabilities}
            accentHex={model.platform.accentHex}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <SaasVolumeInputs />
              <SaasRolesTable />
              <SaasInternalCostInputs />
              <SaasPricingInputs />
            </div>
            <SaasResultsPanel />
          </div>
        </div>

        <SaasPrintSummary model={model} />
      </main>
    </div>
  );
}
