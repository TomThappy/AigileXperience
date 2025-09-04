# V2 Pipeline System - Strukturiertes Dossier-System

## Überblick

Das V2-System transformiert einen Elevator Pitch schrittweise in ein strukturiertes Venture Dossier mit folgenden Verbesserungen gegenüber V1:

- ✅ **Evidence-First Approach**: Quellen-Recherche vor Dossier-Erstellung
- ✅ **Strukturierte Sections**: Jede Sektion folgt einem einheitlichen JSON-Schema
- ✅ **Intelligentes Caching**: Hash-basierte Wiederverwendung von Zwischenergebnissen
- ✅ **Parallele Verarbeitung**: Begrenzte Parallelität für bessere Performance
- ✅ **Inkrementelle Updates**: Nur betroffene Schritte werden neu berechnet
- ✅ **Modell-Optimierung**: Verschiedene LLMs je nach Aufgabe
- ✅ **Resume-Fähigkeit**: Fortsetzung abgebrochener Pipelines

## Pipeline-Schritte

### Schritt 0: Input Processing
- Input: `project_title`, `elevator_pitch`
- Output: `pitch.json` mit Hash
- Kein LLM erforderlich

### Schritt 1: Evidence Harvester
- Input: `pitch.json`
- Output: `sources.json`
- LLM: GPT-4o (für Recherche)
- Prompt: `10_evidence_harvester.md`

### Schritt 2: Brief Extraction
- Input: `pitch.json`, `sources.json`
- Output: `brief.json`
- LLM: Claude 3.5 Sonnet (für Struktur)
- Prompt: `20_extract_brief.md`

### Schritt 3: Dossier Sections (Parallel)
- **Problem**: `30_problem.md` (Claude 3.5 Sonnet)
- **Solution**: `31_solution.md` (Claude 3.5 Sonnet)
- **Team**: `32_team.md` (Claude 3.5 Sonnet)
- **Market**: `33_market.md` (GPT-4o für Zahlen)
- **Business Model**: `34_business_model.md` (GPT-4o für Zahlen)

### Schritt 4: Validation
- Input: Alle Sections
- Output: `validation.json`
- Script-basiert (deterministisch)

### Schritt 5: Investor Scoring
- Input: Alle Sections + Brief
- Output: `investor_score.json`
- LLM: GPT-4o
- Prompt: `90_investor_scoring.md`

### Schritt 6: Assembly
- Input: Alle Artifacts
- Output: `dossier.json`
- Script-basiert

## API Endpoints

### POST `/api/v2/dossier/generate`
Hauptendpoint für die Dossier-Generierung.

**Request:**
```json
{
  "project_title": "HappyNest",
  "elevator_pitch": "Das digitale Zuhause für moderne Familien...",
  "language": "de",
  "target": "Pre-Seed/Seed VCs", 
  "geo": "EU/DACH",
  "skip_cache": false,
  "parallel_limit": 2,
  "timeout_ms": 180000
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* DossierData */ },
  "meta": {
    "trace_id": "abc123",
    "duration_ms": 45000,
    "cache_hits": 3,
    "steps_completed": 10
  }
}
```

### GET `/api/v2/dossier/status/:pipeline_id`
Status-Abfrage für laufende Pipelines.

### POST `/api/v2/dossier/resume/:pipeline_id`
Resume einer abgebrochenen Pipeline.

### GET `/api/v2/health`
Health-Check für V2-System.

## Architektur

```
PipelineManager
├── StepProcessor
├── CacheManager
└── prompts/
    ├── 00_master_system_prompt.md
    ├── 10_evidence_harvester.md
    ├── 20_extract_brief.md
    ├── 30_problem.md
    ├── 31_solution.md
    ├── 32_team.md
    ├── 33_market.md
    ├── 34_business_model.md
    └── 90_investor_scoring.md
```

## Cache-Strategie

- **Cache-Keys**: `step_{stepId}_{hash(inputs+promptVersion)}`
- **Invalidierung**: Hash-basiert - Änderungen lösen nur betroffene Schritte aus
- **Storage**: JSON-Files in `cache/` Verzeichnis
- **Persistence**: Browser IndexedDB + Server Files

## Fehlerbehandlung

- **Timeout Protection**: Standard 3 Minuten, konfigurierbar
- **Retry Logic**: Exponential Backoff für LLM-Calls
- **Graceful Degradation**: Partial Results bei Fehlern
- **Resume Capability**: Fortsetzung von letztem erfolgreichen Schritt

## Usage

```typescript
import { PipelineManager } from './v2/pipeline/PipelineManager.js';

const manager = new PipelineManager();

const result = await manager.executePipeline({
  project_title: "TestApp",
  elevator_pitch: "Revolutionary mobile app...",
  language: "en",
  target: "Seed VCs",
  geo: "US"
}, {
  skipCache: false,
  parallelLimit: 2,
  timeoutMs: 180000
});

if (result.success) {
  console.log("Dossier generated:", result.data);
} else {
  console.error("Pipeline failed:", result.error);
}
```
