Ziel: Fülle fehlende Felder (TODOs, leere key_points) mit realistischen, branchenüblichen Defaults.
Regeln:

- Bewahre harte Fakten aus INPUT_DECK.
- Schreibe ausschließlich prägnante Bullets (max. 7 pro Slide).
- Kennzeichne jede Annahme implizit, indem du sie in deck_meta.assumptions ergänzt ("Assumption: ...").
- Pricing: Freemium-Tiers üblich (z. B. 4,99/7,99 €/Monat), Free→Paid 3–8% Y1, ARPU 2,5–4,5 €/Monat.
- Markt: TAM/SAM/SOM nachvollziehbar staffeln; runde, plausible Größenordnungen.
- Financials: MAU Y1–Y3 konservativ progressiv; Umsatz = MAU _ %zahlend _ ARPU \* 12.
- Ask/Use-of-Funds: Product/Growth/Ops plausibel (z. B. 45/35/20).
- Roadmap: MVP ≤ 2Q ab heute, GA ≤ 2Q danach; Expansion schrittweise.
  Output: GIB AUSSCHLIESSLICH JSON gemäß SCHEMA zurück. Keine Erklärtexte.
