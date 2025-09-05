# Korrigierte Render Environment Variables

## 🚨 Problem mit deinen aktuellen Variables:

1. **Model Name**: `gpt-4.1` existiert nicht → verwende `gpt-4`
2. **Step IDs**: Einige deiner Variable Namen matchen nicht die tatsächlichen Step IDs

## ✅ Korrekte Environment Variables für Render:

```bash
# ========================================
# Global Defaults
# ========================================
MODEL_ANALYZE=gpt-4
MODEL_REFINE=gpt-4
LLM_DEFAULT_MODEL=gpt-4

# ========================================
# Step-spezifische Models (V2 Pipeline)
# ========================================
LLM_MODEL_EVIDENCE=gpt-4
LLM_MODEL_BRIEF=gpt-4
LLM_MODEL_PROBLEM=gpt-4
LLM_MODEL_SOLUTION=gpt-4
LLM_MODEL_TEAM=gpt-4
LLM_MODEL_MARKET=gpt-4
LLM_MODEL_BUSINESS_MODEL=gpt-4
LLM_MODEL_COMPETITION=gpt-4
LLM_MODEL_STATUS_QUO=gpt-4
LLM_MODEL_GTM=gpt-4
LLM_MODEL_FINANCIAL_PLAN=gpt-4
LLM_MODEL_INVESTOR_SCORE=gpt-4

# ========================================
# Phase-Splitting Models (für große Steps)
# ========================================
LLM_MODEL_MARKET_PHASE1=gpt-4
LLM_MODEL_MARKET_PHASE2=gpt-4
LLM_MODEL_GTM_PHASE1=gpt-4
LLM_MODEL_GTM_PHASE2=gpt-4
LLM_MODEL_FINANCIAL_PLAN_PHASE1=gpt-4
LLM_MODEL_FINANCIAL_PLAN_PHASE2=gpt-4

# ========================================
# RateGate Configuration
# ========================================
RATEGATE_TOKENS_PER_MINUTE=40000
RATEGATE_TOKENS_PER_DAY=1000000
RATEGATE_TOKENS_PER_HOUR=240000
RATEGATE_RESERVE_PERCENTAGE=0.20
RATEGATE_MIN_TOKENS_FOR_REQUEST=1000
RATEGATE_STATS_INTERVAL_MS=30000
```

## 🔄 Was du in Render ändern musst:

1. **Entfernen/Korrigieren**:
   - `LLM_MODEL_EXECUTIVE` → `LLM_MODEL_BRIEF` 
   - `LLM_MODEL_RISKS` → `LLM_MODEL_STATUS_QUO`

2. **Hinzufügen**:
   - `LLM_MODEL_EVIDENCE=gpt-4`
   - `LLM_MODEL_INVESTOR_SCORE=gpt-4`

3. **Alle Models ändern**: `gpt-4.1` → `gpt-4`

## 📋 Pipeline Steps Mapping:

| Deine Variable | Korrekte Variable | Pipeline Step |
|----------------|-------------------|---------------|
| ❌ `LLM_MODEL_EXECUTIVE` | ✅ `LLM_MODEL_BRIEF` | brief |
| ❌ `LLM_MODEL_RISKS` | ✅ `LLM_MODEL_STATUS_QUO` | status_quo |
| ❌ Fehlt | ✅ `LLM_MODEL_EVIDENCE` | evidence |
| ❌ Fehlt | ✅ `LLM_MODEL_INVESTOR_SCORE` | investor_score |

## 🎯 Validierung:

Nach der Korrektur solltest du in den Logs sehen:
```
🤖 [STEP] evidence: Using model gpt-4 (from LLM_MODEL_EVIDENCE env var)
🤖 [STEP] brief: Using model gpt-4 (from LLM_MODEL_BRIEF env var)
🤖 [STEP] market: Using model gpt-4 (from LLM_MODEL_MARKET env var)
```
