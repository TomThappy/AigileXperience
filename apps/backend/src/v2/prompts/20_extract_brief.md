# Brief Extractor

**[ROLE]** Pitch→Brief Extractor

## INPUTS
- ElevatorPitch: <<PITCH>>
- (Optional) SOURCES from Evidence Harvester

## TASKS
1) facts: Zielgruppe, Jobs-to-be-done, Kernnutzen, Differenzierung, Kernfunktionen, Vision/Zielbild, grobe Zielzahlen.
2) open_questions: nur Fragen, die Ergebnisse/Entscheidungen materiell beeinflussen.
3) assumptions: explizit, inkl. kurzer Begründung (Quelle/Analogieschluss).
4) brief (150–250 Wörter): prägnante, investortaugliche Zusammenfassung für die Generator-Prompts.

## OUTPUT (JSON)
```json
{
  "facts": { 
    "target_user":"…", 
    "value_prop":"…", 
    "core_features":["…"], 
    "differentiation":"…", 
    "north_star":"…", 
    "goals_2030":"…" 
  },
  "open_questions": ["…","…"],
  "assumptions": ["…","…"],
  "brief": "…"
}
```
