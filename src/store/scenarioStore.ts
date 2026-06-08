"use client";
import { create } from "zustand";
import type { ScenarioInputs } from "@/lib/engine";
import { buildDefaultInputs, recomputeDerivedVolumes } from "@/lib/engine";
import type { ModelConfig } from "@/models/_types";

type State = {
  model: ModelConfig | null;
  inputs: ScenarioInputs;
  setModel: (m: ModelConfig, initial?: ScenarioInputs | null) => void;
  setClientName: (name: string) => void;
  setVolume: (id: string, value: number) => void;
  setRole: (id: string, patch: Partial<{ productivity: number; hourlyRate: number }>) => void;
  setSupervisor: (patch: Partial<{ spanOfControl: number; salary: number }>) => void;
  setBenefitsRate: (n: number) => void;
  setIndirect: (id: string, patch: Partial<{ pool: number; pct: number }>) => void;
  setPricing: (id: string, value: number) => void;
  setRetention: (
    patch: Partial<{ enabled: boolean; retentionPct: number; retainedSupervisors: number }>,
  ) => void;
  reset: () => void;
};

const emptyInputs: ScenarioInputs = {
  clientName: "",
  volumes: {},
  roles: {},
  supervisor: { spanOfControl: 1, salary: 0 },
  benefitsRate: 0,
  indirect: {},
  pricing: {},
};

export const useScenario = create<State>((set, get) => ({
  model: null,
  inputs: emptyInputs,
  setModel: (m, initial) => {
    const base = buildDefaultInputs(m);
    let inputs = initial ?? base;
    // Re-derive volumes in case stored data is stale
    inputs = { ...inputs, volumes: recomputeDerivedVolumes(m, { ...base.volumes, ...inputs.volumes }) };
    set({ model: m, inputs });
  },
  setClientName: (name) => set((s) => ({ inputs: { ...s.inputs, clientName: name } })),
  setVolume: (id, value) => {
    const { model, inputs } = get();
    if (!model) return;
    const nextVolumes = recomputeDerivedVolumes(model, { ...inputs.volumes, [id]: value });
    set({ inputs: { ...inputs, volumes: nextVolumes } });
  },
  setRole: (id, patch) =>
    set((s) => ({
      inputs: {
        ...s.inputs,
        roles: {
          ...s.inputs.roles,
          [id]: { ...(s.inputs.roles[id] ?? { productivity: 0, hourlyRate: 0 }), ...patch },
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
          [id]: { ...(s.inputs.indirect[id] ?? { pool: 0, pct: 0 }), ...patch },
        },
      },
    })),
  setPricing: (id, value) =>
    set((s) => ({ inputs: { ...s.inputs, pricing: { ...s.inputs.pricing, [id]: value } } })),
  setRetention: (patch) =>
    set((s) => {
      // Seed retention from model defaults if not already present, then patch.
      const base = s.inputs.retention ?? (s.model?.retention
        ? {
            enabled: false,
            retentionPct: s.model.retention.defaultRetentionPct,
            retainedSupervisors: s.model.retention.defaultRetainedSupervisors,
          }
        : undefined);
      if (!base) return s;
      return { inputs: { ...s.inputs, retention: { ...base, ...patch } } };
    }),
  reset: () => {
    const { model } = get();
    if (model) set({ inputs: buildDefaultInputs(model) });
  },
}));
