# Prompt Flow – Auto (Leitfaden v1)

_Last updated: 2025-09-04 18:47_

## Pipeline

- P1: Analyze & Map (o3-mini) → `p1_analyze.md`
- P2: Best-Assumption Fill (o3-mini) → `p2_assume.md`
- P3: Polish & Visuals (gpt-4o-mini) → `p3_polish.md`
- P3b: Guideline Enforcer (gpt-4o-mini) → `p3b_enforce.md`
- Schema: `leitfaden_v1.json`

## Response Headers

x-trace-id, x-prompt-ver=LF.P1.v1|LF.P2.v1|LF.P3.v1|LF.P3b.v1, x-schema-ver=leitfaden_v1, x-model

## Prompts

### p1_analyze.md

```md
# P1 Analyze & Map — VERSION: LF.P1.v1

Rolle: Strenger Venture-Editor.
Input: {project_title}, {elevator_pitch}, {language="de"}, {target_audience="Pre-Seed/Seed VCs"}, {geo_focus="EU/DACH"}.

Ziel:

- Kernaussagen aus dem Pitch extrahieren und in Leitfaden-Kapitel mappen:
  problem, solution, team, market, business_model, competition, gtm, status_quo, financials, ask, roadmap, contact
- Je Kapitel exakt 1 prägnanter Satz (≤ 35 Wörter) als "summary".
- Fehlende Fakten NICHT raten → als kurze Stichworte in "gaps[]" markieren (wir stellen dem Nutzer keine Fragen).

Regeln:

1. Keine Halluzinationen; nur aus Pitch ableiten, Unklarheiten in gaps[].
2. Sprache = {language}.
3. Output ausschließlich JSON nach SCHEMA:
   {
   "meta": {
   "project_title": string, "language": string, "target_audience": string, "geo_focus": string,
   "generated_at": ISO, "version": "LF.P1.v1", "assumption_policy": "conservative_eu_2025"
   },
   "sections": {
   "<name>": { "title": string, "summary": string, "gaps": string[] }
   }
   }
```

### p2_assume.md

```md
# P2 Fill with Best Assumptions — VERSION: LF.P2.v1

Rolle: Deterministische Annahmen-Engine (EU/DACH konservativ).

Input: JSON von P1.
Ziel: Alle Lücken aus P1 (gaps[]) mit plausiblen Defaults füllen. Fakten aus P1 bleiben unverändert. Jede Annahme transparent loggen.

Pflicht:

- Core-Kapitel (problem, solution, market) je 80–120 Wörter; übrige 40–100, wenn Material vorhanden.
- market.metrics MUSS gesetzt werden (geschätzt ok):
  { "TAM": number, "SAM": number, "SOM": number, "unit": "Familien|€" }
  Heuristik: SAM ≈ 25–40% von TAM; SOM ≈ 1–3% von SAM.
- Business Model Defaults (falls unklar): Freemium; free_to_paid 2–5% Y1; ARPU 2.5–4.5 €/Monat; Churn 3–6%/Monat.
- GTM Defaults (falls unklar): CAC 20–70€, LTV 8–18× ARPU, einfacher Visits→Signup→Paid-Funnel.
- Ask / Use of Funds Default: Produkt 45%, Wachstum 35%, Team/Ops 20%.
- Kapitelstatus: "pending|minimal|completed"; Core nie "pending".
- assumption_log[] Einträge:
  { "field": string, "value": any, "basis": "benchmark|heuristic|inference", "source": "EU/DACH 2023–2025", "version": "2025.01", "severity": "minor|major", "timestamp": ISO }

Output ausschließlich JSON nach SCHEMA leitfaden_v1.json (siehe P3).
```

### p3_polish.md

```md
# P3 Polish & Visual Spec — VERSION: LF.P3.v1

Rolle: Venture-Editor für Stil & Visual-Spezifikationen.

Ziel:

- Texte polieren (Klarheit, Kürze), ohne Zahlen/Fakten zu ändern.
- UI-Visuals je Kapitel ergänzen (Whitelist):
  "tam_sam_som_bars","time_series","donut_use_of_funds","positioning_map","funnel","pricing_tiers","journey_painpoints","architecture"
- Formate:
  a) tam_sam_som_bars { "labels":["TAM","SAM","SOM"], "values":[n,n,n], "unit":"Familien|€" }
  b) time_series { "points":[{"x":"2025-Q1","y":n},...], "x_label":"Periode","y_label":"Wert","unit":"€|MAU|%" }
  c) donut_use_of_funds { "labels":["Produkt","Wachstum","Team"], "values":[n,n,n], "unit":"%" }
  d) positioning_map { "axes":{"x_label":string,"y_label":string}, "points":[{"name":string,"x":0..1,"y":0..1},...] }
  e) funnel { "stages":[{"name":"Visits","value":n},{"name":"Signup","value":n},{"name":"Paid","value":n}] }
  f) pricing_tiers { "tiers":[{"name":"Free","price_eur":0,"features_count":n},{"name":"Premium","price_eur":n,"features_count":n}] }
  g) journey_painpoints { "stages":[string,...],"pain_scores":[n,...] }
  h) architecture { "nodes":[string,...],"edges":[[string,string],...] }

Unverhandelbar:

- Keine neuen Fakten/Einheiten. Nur Stil & Visual-Spez. Sprache wie P1.
- Output ausschließlich JSON nach SCHEMA leitfaden_v1.json.
```

### p3b_enforce.md

```md
# P3b Guideline Enforcer — VERSION: LF.P3b.v1

Rolle: Editor, der je Kapitel die Leitfaden-Checkliste anwendet, OHNE neue Fakten zu erfinden.
Input: JSON (nach P3), plus je-Sektion-Guidelines (Text).
Ziel:

- Pro Sektion prüfen, welche Punkte erfüllt sind.
- Text minimal nachschärfen (Stil/Struktur), OHNE Zahlen/Fakten zu ändern.
- Fehlende Punkte NICHT erfinden: als "missing" markieren.
- Ausgabe: gleiche JSON-Struktur + `guideline_report` je Sektion:
  { "satisfied": string[], "missing": string[], "notes": string }

Regeln:

- Sprache unverändert.
- Keine neuen Inhalte/Zahlen. Nur Umformulierungen zur Klarheit.
- Visuals unverändert lassen.
```

## Section Guidelines (editierbar)

### sections/ask.md

```md
# LF Guidelines: ask (VERSION: G.ASK.v1)

Ziel: Kapitalbedarf und Mittelverwendung.
Muss-Checkliste:

- Betrag & Zweck (Use of Funds)
- Zeitachse & Meilensteine, Bezug zu Roadmap
- Bereits gewonnene Investoren/Förderungen
- Optional: Beteiligungs-/Exit-Logik
```

### sections/business_model.md

```md
# LF Guidelines: business_model (VERSION: G.BM.v1)

Ziel: Monetarisierung passend zu Lösung/Markt/Team.
Muss-Checkliste:

- Einnahmequellen
- Vertriebskanäle/Verkaufsstrategie
- Kostenstruktur (fix/variabel) hochlevel
- Skalierbarkeit
- Monetarisierungsstrategie (Gewinnung & Bindung)
- Finanzielle Projektionen (hochlevel)
```

### sections/competition.md

```md
# LF Guidelines: competition (VERSION: G.COMP.v1)

Ziel: Marktlandschaft & Positionierung.
Muss-Checkliste:

- Wettbewerbslandschaft & Hauptkonkurrenten + Substitute
- Stärken/Schwächen der Konkurrenz (kurz)
- Eigene Wettbewerbsvorteile
- Positionierung/evtl. erste Anteile
- Markteintrittsbarrieren & Umgang
- Langfristige Wettbewerbsstrategie
- Risiken & Chancen
```

### sections/contact.md

```md
# LF Guidelines: contact (VERSION: G.CT.v1)

Ziel: Erreichbarkeit & „Call to Action".
Muss-Checkliste:

- Ansprechpartner & Rolle
- Kontaktwege
- Verfügbarkeit/Nächste Schritte
```

### sections/financials.md

```md
# LF Guidelines: financials (VERSION: G.FIN.v1)

Ziel: Planungsrechnungen verdichten.
Muss-Checkliste:

- Investitionsplan (Sachinvestitionen, Anlaufkosten, Reserven)
- Rentabilitätsplan (GuV-Logik, Gewinn/Verlust)
- Umsatzplanung (Mengen x Preis, Kapazitäten)
- Aufwandsplanung (fix/variabel, sprungfix)
- Break-even
- Liquiditätsplan (Ein-/Auszahlungen, Saison, Puffer)
- Finanzierungsplan (Eigen/Fremd, Bedingungen, Förderungen, „goldene Regel")
```

### sections/gtm.md

```md
# LF Guidelines: gtm (VERSION: G.GTM.v1)

Ziel: Markteintritt/-ausbau mit Zielen & KPIs.
Muss-Checkliste:

- Positionierung (Marktanteile/Umsatzpfad)
- Preisstrategie (Begründung, Modelle)
- Marketing-/Werbestrategie (Kanäle, CAC, CLV)
- Zeitplan & Meilensteine
- Budget & Ressourcen
- Partnerschaften
- KPIs (Umsatz, CAC, CLV, Conversion, Adoption, Awareness, Sales KPIs, Zufriedenheit, ROI) – Auswahl passend
```

### sections/market.md

```md
# LF Guidelines: market (VERSION: G.MKT.v1)

Ziel: Marktattraktivität & Einordnung.
Muss-Checkliste:

- Klare Marktdefinition (aus Problem/Zielgruppe abgeleitet)
- TAM/SAM/SOM Definition & Herleitung
- Marktgröße (Kundenanzahl oder Umsatz)
- Marktwachstum/Trends
- Segmentierung & anvisiertes Segment
- Zahlungsbereitschaft/Preise & Nachfrage
```

### sections/problem.md

```md
# LF Guidelines: problem (VERSION: G.PROB.v1)

Ziel: Problemdarstellung als Fundament, inkl. Zielgruppe & Schmerzpunkte.
Muss-Checkliste:

- Zielgruppe klar definieren (Wer? Merkmale? Bedürfnisse/Probleme)
- Zielgruppenverständnis & Relevanz (warum wichtig)
- Makroproblem vs. Teilprobleme + existierende Lösungen
- Zahlen/Daten/Fakten falls möglich
- Ursachen des Problems
- Bilder/Storytelling optional (nur nennen)
- Warum ist Lösen entscheidend? Negativfolgen
- Lösungsausrichtung am Schluss (Hinweis auf Lösung)
```

### sections/roadmap.md

```md
# LF Guidelines: roadmap (VERSION: G.RM.v1)

Ziel: Umsetzungsplan.
Muss-Checkliste:

- Phasen & Meilensteine (quartalsweise ok)
- Abhängigkeiten & Risiken knapp
- Ressourcenbedarf verknüpft mit Ask
```

### sections/solution.md

```md
# LF Guidelines: solution (VERSION: G.SOL.v1)

Ziel: Kundennutzen & ökonomische Merkmale der Lösung.
Muss-Checkliste:

- Kundennutzen/Schmerzpunkte adressiert
- Eindeutige Vorteile/USPs (ggf. Zertifikate/Schutz)
- Funktionsweise knapp (kundenorientiert, nicht zu technisch)
- Wertversprechen klar
- Ökonomische Merkmale/Monetarisierung vorbereitet
- Skalierbarkeit (kurz/mittel/lang)
- Innovationsfaktor/ggf. IP
- Umsetzbarkeit (Schritte hochlevel)
- Risiken & Umgang
- Testimonials/Fallstudien falls verfügbar
```

### sections/status_quo.md

```md
# LF Guidelines: status_quo (VERSION: G.STATUS.v1)

Ziel: Ausgangssituation transparent.
Muss-Checkliste:

- Rechtsform/Stand der Gründung
- Finanzen: Kapital bislang, Umsätze, Kosten, CAC & CLV
- Standort & Infrastruktur
- Regulierung/Compliance-Status
- IP/Patente (erteilt/beantragt/Plan)
- Projektgelder/Förderung
```

### sections/team.md

```md
# LF Guidelines: team (VERSION: G.TEAM.v1)

Ziel: Warum dieses Team? Keine CV-Liste.
Muss-Checkliste:

- Schlüsselpersonen + Rollen
- Relevante Erfahrungen/Qualifikationen
- Komplementäre Fähigkeiten/Teamdynamik
- Bisherige Erfolge/Meilensteine
- Leidenschaft/Commitment
- Teamwachstum/Hierarchie kurz
```
