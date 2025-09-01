export const JSON_SCHEMA = `
{
  "deck_meta": {
    "project_name": "",
    "language": "de",
    "target_audience": "Pre-Seed/Seed VCs, Business Angels",
    "assumptions": []
  },
  "slides": [
    { "id":"01","type":"cover","title":"","purpose":"Kernversprechen","key_points":[],"visuals":[],"data_requirements":[],"open_questions":[] },
    { "id":"02","type":"mission","title":"Mission / Vision","purpose":"Warum es das gibt","key_points":[],"visuals":[],"data_requirements":[],"open_questions":[] },
    { "id":"03","type":"problem","title":"Problem & Schmerz","purpose":"Relevanz","key_points":[],"visuals":["Painpoint-Journey"],"data_requirements":["Segmente","Alternativen"],"open_questions":[] },
    { "id":"04","type":"solution","title":"Lösung & Funktionen","purpose":"Wie gelöst wird","key_points":[],"visuals":["Feature-Blocks"],"data_requirements":["MVP-Umfang","Privacy/Safety"],"open_questions":[] },
    { "id":"05","type":"value","title":"Wertversprechen","purpose":"Outcome vs. Output","key_points":[],"visuals":["Before/After"],"data_requirements":[],"open_questions":[] },
    { "id":"06","type":"market","title":"Marktgröße & Fokus","purpose":"TAM/SAM/SOM","key_points":[],"visuals":["TAM/SAM/SOM"],"data_requirements":["Quellen"],"open_questions":[] },
    { "id":"07","type":"gtm","title":"Go-to-Market","purpose":"Akquise/Kanäle","key_points":[],"visuals":["Funnel/KPI"],"data_requirements":["Budget/KPIs"],"open_questions":[] },
    { "id":"08","type":"business_model","title":"Monetarisierung","purpose":"Pricing/ARPU","key_points":[],"visuals":["Tiers"],"data_requirements":["Conversion"],"open_questions":[] },
    { "id":"09","type":"financials","title":"Finanzplan","purpose":"Umsatz/Runway","key_points":[],"visuals":["Umsatz/CF"],"data_requirements":["Kostenblöcke","Break-even"],"open_questions":[] },
    { "id":"10","type":"competition","title":"Wettbewerb","purpose":"Differenzierung","key_points":[],"visuals":["Matrix/Map"],"data_requirements":["Moat"],"open_questions":[] },
    { "id":"11","type":"roadmap","title":"Roadmap","purpose":"Meilensteine","key_points":[],"visuals":["Timeline"],"data_requirements":["MVP/GA"],"open_questions":[] },
    { "id":"12","type":"team","title":"Team","purpose":"Warum wir","key_points":[],"visuals":["Fotos/Logos"],"data_requirements":["Advisors/Hires"],"open_questions":[] },
    { "id":"13","type":"ask","title":"Finanzierungsbedarf","purpose":"Wie viel/wofür","key_points":[],"visuals":["Use-of-Funds"],"data_requirements":["Ticket","Runway"],"open_questions":[] },
    { "id":"14","type":"contact","title":"Kontakt","purpose":"Call-to-Action","key_points":[],"visuals":["QR"],"data_requirements":[],"open_questions":[] }
  ],
  "missing_info_questions": [],
  "warnings": []
}
`;

export const SYSTEM_PROMPT = `
Du bist ein strenger Pitch-Editor. Erzeuge aus einem Elevator-Pitch ein vollständiges Pitchdeck gemäß bereitgestelltem JSON-Schema.
1) Inferenz pro Standard-Kategorie.
2) Lückenprüfung: max. 12 präzise Rückfragen in "missing_info_questions".
3) Fehlende Daten: KEINE Halluzination; nutze "TODO: …".
4) Bullet-Points, keine Fließtexte, Zahlen mit Einheit + Annahmen.
5) Konsistenz (Roadmap ↔ KPIs ↔ Financials).
Antwort NUR als JSON.
`;
