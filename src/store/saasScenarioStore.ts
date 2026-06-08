"use client";
import { create } from "zustand";
import type { SaasInputs } from "@/lib/saas-engine";
import { buildSaasDefaults, recomputeSaasDerivedVolumes } from "@/lib/saas-engine";
import type { SaasModelConfig } from "@/models/_saas-types";

type State = {
  model: SaasModelConfig | null;
  inputs: SaasInputs;
  setModel: (m: SaasModelConfig, initial?: SaasInputs | null) => void;
  setClientName: (name: string) => void;
  setVolume: (id: string, value: number) => void;
  setRole: (
    id: string,
    patch: Partial<{ baselineProductivity: number; hourlyRate: number; improvementPct: number }>,
  ) => void;
  setSupervisor: (patch: Partial<{ spanOfControl: number; salary: number }>) => void;
  setBenefitsRate: (n: number) => void;
  setIndirect: (
    id: string,
    patch: Partial<{ monthlyCost: number; beforeAllocationPct: number }>,
  ) => void;
  setPricing: (patch: Partial<{ perLoanMonthlyFee: number; oneTimeImplementationFee: number }>) => void;
  reset: () => void;
};

const emptyInputs: SaasInputs = {
  clientName: "",
  volumes: {},
  roles: {},
  supervisor: { spanOfControl: 1, salary: 0 },
  benefitsRate: 0,
  indirect: {},
  pricing: { perLoanMonthlyFee: 0, oneTimeImplementationFee: 0 },
};

export const useSaasScenario = create<State>((set, get) => ({
  model: null,
  inputs: emptyInputs,
  setModel: (m, initial) => {
    const base = buildSaasDefaults(m);
    let inputs = initial ?? base;
    inputs = { ...inputs, volumes: recomputeSaasDerivedVolumes(m, { ...base.volumes, ...inputs.volumes }) };
    set({ model: m, inputs });
  },
  setClientName: (name) => set((s) => ({ inputs: { ...s.inputs, clientName: name } })),
  setVolume: (id, value) => {
    const { model, inputs } = get();
    if (!model) return;
    const nextVolumes = recomputeSaasDerivedVolumes(model, { ...inputs.volumes, [id]: value });
    set({ inputs: { ...inputs, volumes: nextVolumes } });
  },
  setRole: (id, patch) =>
    set((s) => ({
      inputs: {
        ...s.inputs,
        roles: {
          ...s.inputs.roles,
          [id]: {
            ...(s.inputs.roles[id] ?? { baselineProductivity: 0, hourlyRate: 0, improvementPct: 0 }),
            ...patch,
          },
        },
      },
    })),
  setSupervisor: (patch) =>
    set((s) => ({ inputs: { ...s.inputs, supervisor: { ...s.inputs.supervisor, ...patch } } })),
  setBenefitsRate: (n) => set((s) => ({ inputs: { ...s.inputs, benefitsRate: n } })),
  setIndirect: (id, patch) =>
    set((s) => ({
      inputs: {
        ...s.inputs,
        indirect: {
          ...s.inputs.indirect,
          [id]: { ...(s.inputs.indirect[id] ?? { monthlyCost: 0, beforeAllocationPct: 0 }), ...patch },
        },
      },
    })),
  setPricing: (patch) =>
    set((s) => ({ inputs: { ...s.inputs, pricing: { ...s.inputs.pricing, ...patch } } })),
  reset: () => {
    const { model } = get();
    if (model) set({ inputs: buildSaasDefaults(model) });
  },
}));
