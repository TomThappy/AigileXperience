/**
 * Deterministisches Recalc ohne LLM:
 * - wendet numerische Overrides an (deep-merge)
 * - leitet SAM/SOM heuristisch ab, wenn nicht gesetzt
 * - normalisiert Use-of-Funds
 * - einfache KPI-Ableitungen (falls sinnvoll)
 */
type AnyObj = Record<string, any>;

function deepMerge<T extends AnyObj>(base: T, patch: AnyObj): T {
  const out: AnyObj = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof out[k] === "object" &&
      out[k] !== null &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function recalcLeitfadenV1(input: {
  dossier: AnyObj;
  overrides?: AnyObj;
}) {
  let d = deepMerge(input.dossier, input.overrides || {});

  // Heuristik: Marktmetriken
  const m = d?.sections?.market?.metrics || {};
  const hasTAM = typeof m.TAM === "number" && m.TAM > 0;
  const hasSAM = typeof m.SAM === "number" && m.SAM > 0;
  const hasSOM = typeof m.SOM === "number" && m.SOM > 0;

  if (hasTAM && !hasSAM) {
    // SAM ~ 35% TAM (EU/DACH konservativ)
    d.sections.market.metrics.SAM = Math.round(m.TAM * 0.35);
  }
  if ((hasSAM || d.sections.market.metrics.SAM) && !hasSOM) {
    const sam = d.sections.market.metrics.SAM || m.SAM;
    // SOM ~ 2% SAM
    d.sections.market.metrics.SOM = Math.max(1, Math.round(sam * 0.02));
  }
  if (!d.sections.market.metrics.unit) {
    d.sections.market.metrics.unit = m.unit || "Familien";
  }

  // Use of Funds normalisieren, falls überschrieben
  if (d.sections?.ask?.use_of_funds) {
    const u = d.sections.ask.use_of_funds;
    const prod = Number(u.Produkt ?? 0.45);
    const growth = Number(u.Wachstum ?? 0.35);
    const team = Number(u.Team ?? u.Ops ?? 0.2);
    const sum = prod + growth + team || 1;
    d.sections.ask.use_of_funds = {
      Produkt: prod / sum,
      Wachstum: growth / sum,
      Team: team / sum,
    };
  }

  // Einfache Pricing/GTm-Ableitung (nur wenn vorhanden)
  const bm = d.sections?.business_model || {};
  const pricing = bm.pricing || {};
  const arpu = Number(pricing.arpu_month ?? 0);
  const f2p = Number(pricing.free_to_paid ?? 0); // 0..1
  const funnel = d.sections?.gtm?.funnel || {}; // { visits, signup, paid }

  if (arpu > 0 && f2p > 0 && funnel?.visits && funnel?.signup) {
    const signup = Number(funnel.signup);
    const paid = Math.max(1, Math.round(signup * clamp01(f2p)));
    d.sections.gtm.funnel.paid = paid;
    d.sections.financials = d.sections.financials || {};
    d.sections.financials.derived = d.sections.financials.derived || {};
    d.sections.financials.derived.mrr_estimate_eur = Math.round(paid * arpu);
  }

  // Flag in Meta
  d.meta = d.meta || {};
  d.meta.recalc_at = new Date().toISOString();
  d.meta.recalc_note = "Deterministic recalc (no LLM)";
  return d;
}
