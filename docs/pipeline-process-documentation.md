# Pipeline Process Documentation

## Pipeline Sequence Diagram

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Worker  
    participant PipelineManager
    participant StepProcessor
    participant LLM

    Frontend->>Backend: POST /api/jobs
    Backend->>Backend: Create Job ID
    Backend-->>Frontend: { job_id, status: "queued" }
    
    Frontend->>Backend: GET /api/jobs/:id/stream (SSE)
    
    Worker->>Backend: getNextJob()
    Backend-->>Worker: job_id
    
    Worker->>PipelineManager: executePipeline(input)
    PipelineManager->>StepProcessor: executeStep(input, step_config)
    
    Note over StepProcessor: S1: Analysis Phase
    StepProcessor->>StepProcessor: processInput() [script]
    StepProcessor->>StepProcessor: executeStep(evidence)
    StepProcessor->>LLM: chatComplete(evidence_prompt, gpt-4)
    LLM-->>StepProcessor: sources_data
    
    StepProcessor->>StepProcessor: executeStep(brief)  
    StepProcessor->>LLM: chatComplete(brief_prompt, gpt-4)
    LLM-->>StepProcessor: brief_data
    
    Note over StepProcessor: S2: Sections Phase (Parallel)
    par Problem
        StepProcessor->>LLM: chatComplete(problem_prompt, gpt-4o-mini)
    and Solution  
        StepProcessor->>LLM: chatComplete(solution_prompt, gpt-4o-mini)
    and Team
        StepProcessor->>LLM: chatComplete(team_prompt, gpt-4o-mini)
    end
    
    Note over StepProcessor: S2: Complex Sections (Phase-Split)
    StepProcessor->>StepProcessor: executePhaseSplitStep(market)
    StepProcessor->>LLM: chatComplete(market_phase1, gpt-4o-mini) [DATA]
    StepProcessor->>LLM: chatComplete(market_phase2, gpt-4) [NARRATIVE]
    
    StepProcessor->>StepProcessor: executePhaseSplitStep(gtm)
    StepProcessor->>LLM: chatComplete(gtm_phase1, gpt-4o-mini) [DATA]  
    StepProcessor->>LLM: chatComplete(gtm_phase2, gpt-4) [NARRATIVE]
    
    StepProcessor->>StepProcessor: executePhaseSplitStep(financial_plan)
    StepProcessor->>LLM: chatComplete(financial_phase1, gpt-4o-mini) [DATA]
    StepProcessor->>LLM: chatComplete(financial_phase2, gpt-4) [NARRATIVE]
    
    par Business Model
        StepProcessor->>LLM: chatComplete(business_model_prompt, gpt-4)
    and Competition
        StepProcessor->>LLM: chatComplete(competition_prompt, gpt-4o-mini) 
    and Status Quo
        StepProcessor->>LLM: chatComplete(status_quo_prompt, gpt-4o-mini)
    end
    
    Note over StepProcessor: S3: Validation Phase
    StepProcessor->>StepProcessor: validateNumbers() [script]
    
    Note over StepProcessor: S4: Scoring Phase
    StepProcessor->>LLM: chatComplete(investor_score_prompt, gpt-4)
    
    StepProcessor->>StepProcessor: assembleResults() [script]
    StepProcessor-->>PipelineManager: final_dossier
    PipelineManager-->>Worker: result
    Worker->>Backend: setJobResult(job_id, result)
    Backend-->>Frontend: SSE: job_completed
```

## Step → Prompt → Model → Phase → Filter Table

| Step | Prompt File | Model | Context | Phase | Source Filter | RateGate Limit |
|------|-------------|-------|---------|-------|---------------|----------------|
| input | - | - | - | - | - | - |
| evidence | 10_evidence_harvester.md | LLM_MODEL_EVIDENCE \|\| gpt-4 | 128k | single | none | 30k TPM |
| brief | 20_extract_brief.md | LLM_MODEL_BRIEF \|\| gpt-4 | 128k | single | evidence-based | 30k TPM |
| problem | 30_problem.md | LLM_MODEL_PROBLEM \|\| gpt-4o-mini | 128k | single | problem-focused | 200k TPM |
| solution | 31_solution.md | LLM_MODEL_SOLUTION \|\| gpt-4o-mini | 128k | single | solution-focused | 200k TPM |
| team | 32_team.md | LLM_MODEL_TEAM \|\| gpt-4o-mini | 128k | single | team-focused | 200k TPM |
| market | 33_market.md | LLM_MODEL_MARKET \|\| gpt-4 | 128k | **SPLIT** | market-keywords | 30k TPM |
| ├─ phase1 | 33_market.md_phase1.txt | LLM_MODEL_MARKET_PHASE1 \|\| gpt-4o-mini | 128k | data | market-data | 200k TPM |
| └─ phase2 | 33_market.md_phase2.txt | LLM_MODEL_MARKET_PHASE2 \|\| gpt-4 | 128k | narrative | none | 30k TPM |
| business_model | 34_business_model.md | LLM_MODEL_BUSINESS_MODEL \|\| gpt-4 | 128k | single | business-focused | 30k TPM |
| competition | 35_competition.md | LLM_MODEL_COMPETITION \|\| gpt-4o-mini | 128k | single | competition | 200k TPM |
| status_quo | 37_status_quo.md | LLM_MODEL_STATUS_QUO \|\| gpt-4o-mini | 128k | single | status-focused | 200k TPM |
| gtm | 36_go-to-market.md | LLM_MODEL_GTM \|\| gpt-4o-mini | 128k | **SPLIT** | marketing-keywords | 200k TPM |
| ├─ phase1 | 36_go-to-market.md_phase1.txt | LLM_MODEL_GTM_PHASE1 \|\| gpt-4o-mini | 128k | data | marketing-data | 200k TPM |
| └─ phase2 | 36_go-to-market.md_phase2.txt | LLM_MODEL_GTM_PHASE2 \|\| gpt-4 | 128k | narrative | none | 30k TPM |
| financial_plan | 38_financial_plan.md | LLM_MODEL_FINANCIAL_PLAN \|\| gpt-4 | 128k | **SPLIT** | financial-keywords | 30k TPM |
| ├─ phase1 | 38_financial_plan.txt_phase1.txt | LLM_MODEL_FINANCIAL_PLAN_PHASE1 \|\| gpt-4o-mini | 128k | data | financial-data | 200k TPM |
| └─ phase2 | 38_financial_plan.txt_phase2.txt | LLM_MODEL_FINANCIAL_PLAN_PHASE2 \|\| gpt-4 | 128k | narrative | none | 30k TPM |
| validate | - | - | - | - | - | - |
| investor_score | 90_investor_scoring.md | LLM_MODEL_INVESTOR_SCORE \|\| gpt-4 | 128k | single | scoring-focused | 30k TPM |
| assemble | - | - | - | - | - | - |

## DAG Dependencies & Rebuild Triggers

```mermaid
graph TD
    A[input] --> B[evidence]
    A --> C[brief]
    B --> C
    
    C --> D[problem]
    C --> E[solution] 
    C --> F[team]
    C --> G[market]
    C --> H[status_quo]
    
    B --> D
    B --> E
    B --> F
    B --> G
    B --> H
    
    G --> I[business_model]
    G --> J[competition]
    G --> K[gtm]
    
    I --> K
    I --> L[financial_plan]
    
    D --> M[validate]
    E --> M
    F --> M
    G --> M
    I --> M
    J --> M
    H --> M
    K --> M
    L --> M
    
    M --> N[investor_score]
    I --> N
    
    M --> O[assemble]
    N --> O
    
    classDef phaseSplit fill:#ff6b6b,stroke:#333,stroke-width:2px
    classDef script fill:#51cf66,stroke:#333,stroke-width:2px
    classDef llm fill:#74c0fc,stroke:#333,stroke-width:2px
    
    class G,K,L phaseSplit
    class A,M,O script
    class B,C,D,E,F,I,J,H,N llm
```

### Rebuild Triggers

| Change | Affected Steps | Reason |
|--------|---------------|---------|
| pitch text | ALL | Hash change triggers full rebuild |
| sources | brief → all sections | Evidence dependencies cascade |
| brief | all sections | Brief is input to all sections |
| market | business_model, competition, gtm, financial_plan | Market data drives business logic |
| business_model | gtm, financial_plan, investor_score | Business model shapes strategy |

## Source Filter Rules by Step

| Step | Keywords | Max Sources | Max Chars/Source |
|------|----------|-------------|------------------|
| evidence | (all) | 15-20 | unlimited |
| brief | (evidence-based) | 8 | 800 |
| problem | problem, issue, challenge, pain | 6 | 600 |
| solution | solution, product, technology, approach | 6 | 600 |
| team | team, founder, experience, background | 4 | 600 |
| market | market, industry, sector, size, growth | 8 | 800 |
| business_model | revenue, pricing, model, monetization | 6 | 600 |
| competition | competitor, alternative, comparison | 6 | 600 |
| status_quo | current, existing, traditional | 4 | 600 |
| gtm | marketing, sales, customer, channel | 6 | 600 |
| financial_plan | financial, funding, revenue, cost | 8 | 800 |
| investor_score | (all sections) | 8 | 600 |

## Context Length Guards

| Model | Max Context | Used For | Fallback |
|-------|-------------|----------|----------|
| gpt-3.5-turbo | ❌ 4k | NEVER | gpt-4o-mini |
| gpt-4o-mini | ✅ 128k | Simple sections | - |
| gpt-4o | ✅ 128k | Complex sections | - |
| gpt-4 | ✅ 128k | Critical sections | - |
| gpt-4-turbo | ✅ 128k | Heavy workloads | gpt-4 |

**HARD RULE**: No model with ≤ 8192 context for market, gtm, financial_plan steps.
