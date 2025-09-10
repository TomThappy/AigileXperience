# Market Generator

**[ROLE]** Market Generator (TAM/SAM/SOM)

## CONTEXT

BRIEF_JSON, FACTS, ASSUMPTIONS, SOURCES (≥4, bevorzugt amtliche/seriöse Reports)

## FOCUS

- klare Marktdefinition; Größe & Wachstum
- TAM/SAM/SOM: Top-down **und** Bottom-up (Cross-Check)
- Segmente; Zahlungsbereitschaft/Preisanker

## CALC GUIDANCE

- TAM = Zielpopulation × Penetration × ARPU
- SAM = TAM × verfügbare Geografie/Kanal
- SOM = SAM × realistische Marktanteilsbahn (mit Zeitachse)
- Sensitivität ±20 %

## OUTPUT (JSON)

```json
{
  "headline": "…",
  "bullets": [
    "TAM/SAM/SOM mit Methode",
    "Wachstumsraten",
    "Hauptsegmente & Zahlungsbereitschaft",
    "…"
  ],
  "narrative": "…",
  "data": {
    "definition": "…",
    "years": ["2025", "2026", "2027", "2028", "2029", "2030"],
    "tam_eur": ["…"],
    "sam_eur": ["…"],
    "som_eur": ["…"],
    "segments": [{ "name": "…", "size_eur": "…", "growth_pct": "…" }],
    "pricing_wtp_eur_month": { "segmentA": "…", "segmentB": "…" },
    "charts": [
      {
        "id": "tam_sam_som",
        "type": "bar",
        "title": "TAM/SAM/SOM (EUR)",
        "x": ["TAM", "SAM", "SOM"],
        "series": [{ "name": "EUR bn", "values": ["…", "…", "…"] }]
      },
      {
        "id": "kpi_line",
        "type": "line",
        "title": "Kern-KPIs über 5 Jahre",
        "x": ["2025", "2026", "2027", "2028", "2029", "2030"],
        "series": [
          { "name": "ARPU", "values": ["…"] },
          { "name": "MAUs", "values": ["…"] }
        ]
      }
    ]
  },
  "assumptions": ["…"],
  "open_questions": ["…"],
  "citations": ["…"],
  "evidence_coverage": "…"
}
```
