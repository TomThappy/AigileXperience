/**
 * Auto-Assumptions: befüllt fehlende Inhalte deterministisch mit branchenüblichen Defaults.
 * - Kennzeichnet jede Annahme in deck_meta.assumptions
 * - Überschreibbar per client-provided "overrides" (Recalc-Endpoint)
 */
import { Deck } from "@aigilexperience/common";

type Overrides = Record<string, any>;

/** Simple helpers */
const pct = (n: number) => `${Math.round(n * 100)}%`;
const eurPM = (n: number) => `${n.toFixed(2)} €/Monat`;

export function applyBestAssumptions(
  deck: Deck,
  overrides: Overrides = {},
): Deck {
  const A: string[] = deck.deck_meta.assumptions || [];

  // 1) Pricing/Conversion/ARPU (wenn leer)
  const hasBM = deck.slides.find((s) => s.type === "business_model");
  if (hasBM) {
    const bm = hasBM;
    const already = bm.key_points.join(" ").toLowerCase();
    if (!already.includes("pricing")) {
      const tiers = overrides["pricing.tiers"] || [
        "Free",
        "Plus (4,99 €/Monat)",
        "Family (7,99 €/Monat)",
      ];
      bm.key_points.push(`Pricing-Tiers: ${tiers.join(" · ")}`);
      A.push("Assumption: marktübliche Freemium-Tiers mit 4,99/7,99 €/Monat.");
    }
    if (!already.includes("conversion")) {
      const conv = overrides["pricing.free_to_paid"] ?? 0.06;
      bm.key_points.push(`Free→Paid Conversion (Year 1): ${pct(conv)}`);
      A.push(`Assumption: Free→Paid ${pct(conv)} im Startmarkt.`);
    }
    if (!already.includes("arpu")) {
      const arpu = overrides["pricing.arpu_month"] ?? 3.2;
      bm.key_points.push(`ARPU (Monat): ${eurPM(arpu)}`);
      A.push(`Assumption: ARPU ${eurPM(arpu)}.`);
    }
  }

  // 2) Market (TAM/SAM/SOM grob, wird in Charts gezeigt)
  const mk = deck.slides.find((s) => s.type === "market");
  if (mk && mk.key_points.length === 0) {
    const TAM = overrides["market.tam"] ?? 12_000_000; // Haushalte / Familien
    const SAM = overrides["market.sam"] ?? 3_600_000; // digital affine Zielgruppe
    const SOM = overrides["market.som"] ?? 360_000; // 10% der SAM
    mk.key_points.push(`TAM: ${TAM.toLocaleString("de-DE")} Familien`);
    mk.key_points.push(`SAM: ${SAM.toLocaleString("de-DE")} Familien`);
    mk.key_points.push(
      `SOM (3 Jahre): ${SOM.toLocaleString("de-DE")} Familien`,
    );
    A.push(
      "Assumption: TAM/SAM/SOM pragmatisch hergeleitet (Benchmarks variieren je Markt).",
    );
  }

  // 3) Financials basic plan (Year1-3) – wenn leer
  const fin = deck.slides.find((s) => s.type === "financials");
  if (fin && fin.key_points.length === 0) {
    const payingPct = overrides["fin.paying_pct"] ?? 0.18;
    const arpu = overrides["pricing.arpu_month"] ?? 3.2;
    const mauY1 = overrides["fin.mau_y1"] ?? 60_000;
    const mauY2 = overrides["fin.mau_y2"] ?? 200_000;
    const mauY3 = overrides["fin.mau_y3"] ?? 600_000;
    const rev = (mau: number) => Math.round(mau * payingPct * arpu * 12);
    fin.key_points.push(
      `MAU Y1–Y3: ${mauY1.toLocaleString()} · ${mauY2.toLocaleString()} · ${mauY3.toLocaleString()}`,
    );
    fin.key_points.push(`% zahlend: ${pct(payingPct)} · ARPU: ${eurPM(arpu)}`);
    fin.key_points.push(
      `Umsatz Y1–Y3 (≈): ${rev(mauY1).toLocaleString("de-DE")}€ · ${rev(mauY2).toLocaleString("de-DE")}€ · ${rev(mauY3).toLocaleString("de-DE")}€`,
    );
    A.push("Assumption: lineare KPI-Progression, konservative Conversion.");
  }

  // 4) Ask/Use-of-Funds – wenn leer
  const ask = deck.slides.find((s) => s.type === "ask");
  if (ask && ask.key_points.length === 0) {
    const raise = overrides["ask.raise_eur"] ?? 500_000;
    const use = overrides["ask.use_of_funds"] || {
      Product: 0.45,
      Growth: 0.35,
      Ops: 0.2,
    };
    ask.key_points.push(`Runde: ${raise.toLocaleString("de-DE")} €`);
    ask.key_points.push(
      `Use of Funds: Product ${pct(use.Product)} · Growth ${pct(use.Growth)} · Ops ${pct(use.Ops)}`,
    );
    A.push("Assumption: Seed-typische Mittelverwendung (Product/Growth/Ops).");
  }

  // 5) Roadmap – wenn leer
  const rm = deck.slides.find((s) => s.type === "roadmap");
  if (rm && rm.key_points.length === 0) {
    const now = new Date();
    const y = now.getFullYear();
    rm.key_points.push(`MVP: Q4 ${y}`);
    rm.key_points.push(`GA: Q2 ${y + 1}`);
    rm.key_points.push(`EU-Expansion: ab Q4 ${y + 1}`);
    A.push("Assumption: MVP→GA in 6–8 Monaten möglich.");
  }

  deck.deck_meta.assumptions = Array.from(
    new Set([...(deck.deck_meta.assumptions || []), ...A]),
  );
  return deck;
}
