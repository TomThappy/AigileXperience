# CLAUDE.md – AI Change Notes

- Ziel: Zusammenfassung wesentlicher AI-generierter Änderungen und Prompts.
- Struktur:
  - Datum
  - Kontext/PR#
  - Prompt/Parameter
  - Output-Zusammenfassung
  - Annahmen/Warnungen

---

## Session 2025-09-04: V2 Pipeline System Implementation 🚀

### Kontext

**Problem**: Backend hatte 400/502-Fehler bei Dossier-Generierung
**Lösung**: Kompletter Rewrite zu modularem Pipeline-System
**Status**: V2 System implementiert, V1 als Fallback verfügbar

### Major Changes

#### 1. V1 Bugfixes (Commits: eb128de, c5fe900, 3feeebe)

- **Problem**: `temperature` Parameter nicht unterstützt von o3-mini, o1-\* Modellen
- **Fix**: Erweiterte Modell-Kompatibilitätsprüfung in `llm.ts`
- **Problem**: Request Timeouts führten zu 502-Fehlern
- **Fix**: 25s Timeout-Wrapper um Pipeline-Calls
- **Problem**: `max_tokens` vs `max_completion_tokens` Unterschiede
- **Fix**: Modell-spezifische Parameter-Logik

```typescript
// Vorher: Nur o1-* ausgeschlossen
const supportsTemp = !model.startsWith("o1-") && model !== "gpt-4o-mini";

// Nachher: o1-*, o3-* und gpt-4o-mini ausgeschlossen
const supportsTemp =
  !model.startsWith("o1-") &&
  !model.startsWith("o3-") &&
  model !== "gpt-4o-mini";
```

#### 2. V2 Pipeline System (Commit: 64b9460)

**Prompt**: "Ich will das Ganze bei Eingabe von Projekttitel und Elevator Pitch nun anders gestalten: [Detailed 6-step pipeline specification]"

**AI Response**: Vollständige Implementierung eines modularen Pipeline-Systems

##### Architektur-Komponenten:

- **PipelineManager.ts**: Hauptorchestrator mit Dependency-Management
- **StepProcessor.ts**: LLM + Script-basierte Einzelschritt-Verarbeitung
- **CacheManager.ts**: Hash-basiertes intelligentes Caching
- **types.ts**: Vollständige TypeScript-Interface-Definitionen
- **10+ Prompt-Dateien**: Spezialisierte Prompts pro Dossier-Sektion

##### Pipeline-Schritte:

```
0. Input Processing → pitch.json (Hash-Generierung)
1. Evidence Harvester → sources.json (Quellen-Recherche)
2. Brief Extraction → brief.json (Facts/Assumptions)
3. Dossier Sections → Problem/Solution/Market/BizModel (parallel)
4. Number Validation → Konsistenz-Checks (deterministisch)
5. Investor Scoring → Comprehensive Evaluation
6. Final Assembly → dossier.json Export
```

##### API Endpoints:

- `POST /api/v2/dossier/generate` (Haupt-Generierung)
- `GET /api/v2/dossier/status/:id` (Pipeline-Status)
- `POST /api/v2/dossier/resume/:id` (Resume-Fähigkeit)
- `GET /api/v2/health` (V2-Health-Check)

#### 3. Bugfixes V2 (Commits: c5fe900, 7549943)

- **Problem**: `require()` in ES-Modules nicht verfügbar
- **Fix**: Import-basierte crypto-Verwendung
- **Problem**: `claude-3.5-sonnet` Modell nicht verfügbar
- **Fix**: Temporär alle Schritte auf `gpt-4o` umgestellt

### Aktueller Status

- **V1 System**: ✅ Funktional (`/api/auto/run`)
- **V2 System**: 🔄 In Testing (`/api/v2/dossier/generate`)
- **Known Issues**:
  1. Claude API Key fehlt
  2. JSON-Parsing (```json wrapper)
  3. Prompt-Pfade evtl. nicht korrekt in Render

### Render Logs Analysis

**Problem**: V2 System zeigt mehrere Fehler:

1. `require is not defined` → ✅ Fixed
2. `claude-3.5-sonnet` not found → ✅ Fixed (GPT-4o verwendet)
3. JSON parsing fails with ```json wrapper → 🔄 Next

### Prompts Used

#### Master System Prompt (00_master_system_prompt.md):

```
You are a rigorous venture analyst and pitch-deck architect.
MANDATE: Evidence-first, transparent assumptions, show formulas, consistent numbers.
OUTPUT: Structured JSON with headlines, bullets, narrative, data, assumptions, citations.
```

#### Evidence Harvester (10_evidence_harvester.md):

```
Find 6-12 high-quality sources per topic: Statistics offices, regulators, OECD/WHO/EU reports.
Avoid blogs/PR unless supplemental. Mark access: free/paywalled.
```

### Assumptions & Warnings

- **Performance**: V2 sollte durch Caching schneller sein als V1
- **Reliability**: Timeout-Protection verhindert 502-Fehler
- **Scalability**: Parallele Verarbeitung reduziert Gesamtlaufzeit
- **Backward Compatibility**: V1 bleibt als Fallback verfügbar

### Next Actions

1. ✅ Claude API Key hinzufügen
2. ✅ JSON Response Cleaning (```json wrapper entfernen)
3. ✅ Prompt-Pfad-Fixes für Render Environment
4. 🔄 Frontend Integration für V2
5. 🔄 Resume-Funktionalität vervollständigen
