import type { ScenarioInputs } from "./engine";

// Base64URL encode/decode for compact URL hash storage.
function b64uEncode(s: string): string {
  if (typeof window === "undefined") return Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(s: string): string {
  const pad = (str: string) => str + "===".slice((str.length + 3) % 4);
  const norm = pad(s.replace(/-/g, "+").replace(/_/g, "/"));
  if (typeof window === "undefined") return Buffer.from(norm, "base64").toString("utf-8");
  return decodeURIComponent(escape(atob(norm)));
}

export function encodeScenario(s: ScenarioInputs): string {
  return b64uEncode(JSON.stringify(s));
}

export function decodeScenario(encoded: string): ScenarioInputs | null {
  try {
    const json = b64uDecode(encoded);
    return JSON.parse(json) as ScenarioInputs;
  } catch {
    return null;
  }
}

export function readHashScenario(): ScenarioInputs | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  const m = h.match(/[#&]d=([^&]+)/);
  if (!m) return null;
  return decodeScenario(decodeURIComponent(m[1]));
}

export function writeHashScenario(s: ScenarioInputs) {
  if (typeof window === "undefined") return;
  const encoded = encodeScenario(s);
  const newHash = `#d=${encoded}`;
  if (window.location.hash !== newHash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${newHash}`);
  }
}

export function getShareableUrl(s: ScenarioInputs): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}${window.location.search}#d=${encodeScenario(s)}`;
}

const LS_KEY_PREFIX = "roi-scenario-";
export function saveLocal(modelId: string, s: ScenarioInputs) {
  try { localStorage.setItem(LS_KEY_PREFIX + modelId, JSON.stringify(s)); } catch {}
}
export function loadLocal(modelId: string): ScenarioInputs | null {
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + modelId);
    return raw ? (JSON.parse(raw) as ScenarioInputs) : null;
  } catch {
    return null;
  }
}
