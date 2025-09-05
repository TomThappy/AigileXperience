import { Router } from "express";

const router = Router();

/**
 * GET /api/config
 * Returns effective environment variable resolution for debugging
 */
router.get("/", (req, res) => {
  const config = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    
    // Global Model Configuration
    global_models: {
      MODEL_NAME: process.env.MODEL_NAME || null,
      MODEL_ANALYZE: process.env.MODEL_ANALYZE || null,
      MODEL_REFINE: process.env.MODEL_REFINE || null,
      LLM_DEFAULT_MODEL: process.env.LLM_DEFAULT_MODEL || null,
    },
    
    // Step-specific Model Configuration  
    step_models: {
      LLM_MODEL_EVIDENCE: process.env.LLM_MODEL_EVIDENCE || null,
      LLM_MODEL_BRIEF: process.env.LLM_MODEL_BRIEF || null,
      LLM_MODEL_PROBLEM: process.env.LLM_MODEL_PROBLEM || null,
      LLM_MODEL_SOLUTION: process.env.LLM_MODEL_SOLUTION || null,
      LLM_MODEL_TEAM: process.env.LLM_MODEL_TEAM || null,
      LLM_MODEL_MARKET: process.env.LLM_MODEL_MARKET || null,
      LLM_MODEL_BUSINESS_MODEL: process.env.LLM_MODEL_BUSINESS_MODEL || null,
      LLM_MODEL_COMPETITION: process.env.LLM_MODEL_COMPETITION || null,
      LLM_MODEL_STATUS_QUO: process.env.LLM_MODEL_STATUS_QUO || null,
      LLM_MODEL_GTM: process.env.LLM_MODEL_GTM || null,
      LLM_MODEL_FINANCIAL_PLAN: process.env.LLM_MODEL_FINANCIAL_PLAN || null,
      LLM_MODEL_INVESTOR_SCORE: process.env.LLM_MODEL_INVESTOR_SCORE || null,
    },
    
    // Phase-specific Model Configuration
    phase_models: {
      LLM_MODEL_MARKET_PHASE1: process.env.LLM_MODEL_MARKET_PHASE1 || null,
      LLM_MODEL_MARKET_PHASE2: process.env.LLM_MODEL_MARKET_PHASE2 || null,
      LLM_MODEL_GTM_PHASE1: process.env.LLM_MODEL_GTM_PHASE1 || null,
      LLM_MODEL_GTM_PHASE2: process.env.LLM_MODEL_GTM_PHASE2 || null,
      LLM_MODEL_FINANCIAL_PLAN_PHASE1: process.env.LLM_MODEL_FINANCIAL_PLAN_PHASE1 || null,
      LLM_MODEL_FINANCIAL_PLAN_PHASE2: process.env.LLM_MODEL_FINANCIAL_PLAN_PHASE2 || null,
    },
    
    // RateGate Configuration
    rate_gate: {
      RATEGATE_TOKENS_PER_MINUTE: parseInt(process.env.RATEGATE_TOKENS_PER_MINUTE || "40000"),
      RATEGATE_TOKENS_PER_HOUR: parseInt(process.env.RATEGATE_TOKENS_PER_HOUR || "240000"),
      RATEGATE_TOKENS_PER_DAY: parseInt(process.env.RATEGATE_TOKENS_PER_DAY || "1000000"),
      RATEGATE_RESERVE_PERCENTAGE: parseFloat(process.env.RATEGATE_RESERVE_PERCENTAGE || "0.20"),
      RATEGATE_MIN_TOKENS_FOR_REQUEST: parseInt(process.env.RATEGATE_MIN_TOKENS_FOR_REQUEST || "1000"),
      RATEGATE_STATS_INTERVAL_MS: parseInt(process.env.RATEGATE_STATS_INTERVAL_MS || "30000"),
    },
    
    // Model-specific Rate Limits
    model_limits: {
      OPENAI_TPM_GPT4: parseInt(process.env.OPENAI_TPM_GPT4 || "30000"),
      OPENAI_TPM_GPT4O: parseInt(process.env.OPENAI_TPM_GPT4O || "50000"), 
      OPENAI_TPM_GPT4O_MINI: parseInt(process.env.OPENAI_TPM_GPT4O_MINI || "200000"),
      ANTHROPIC_TPM_SONNET: parseInt(process.env.ANTHROPIC_TPM_SONNET || "80000"),
      ANTHROPIC_TPM_HAIKU: parseInt(process.env.ANTHROPIC_TPM_HAIKU || "150000"),
    },
    
    // API Configuration
    api_config: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : null,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...` : null,
      REDIS_URL: process.env.REDIS_URL ? process.env.REDIS_URL.replace(/\/\/[^@]+@/, '//***@') : null,
    },
    
    // Model Routing Resolution (Effective Configuration)
    effective_routing: {
      evidence: getEffectiveModel('EVIDENCE', 'gpt-4'),
      brief: getEffectiveModel('BRIEF', 'gpt-4'),
      problem: getEffectiveModel('PROBLEM', 'gpt-4o-mini'),
      solution: getEffectiveModel('SOLUTION', 'gpt-4o-mini'),
      team: getEffectiveModel('TEAM', 'gpt-4o-mini'),
      market: getEffectiveModel('MARKET', 'gpt-4'),
      market_phase1: getEffectiveModel('MARKET_PHASE1', getEffectiveModel('MARKET', 'gpt-4o-mini')),
      market_phase2: getEffectiveModel('MARKET_PHASE2', getEffectiveModel('MARKET', 'gpt-4')),
      business_model: getEffectiveModel('BUSINESS_MODEL', 'gpt-4'),
      competition: getEffectiveModel('COMPETITION', 'gpt-4o-mini'),
      status_quo: getEffectiveModel('STATUS_QUO', 'gpt-4o-mini'),
      gtm: getEffectiveModel('GTM', 'gpt-4o-mini'),
      gtm_phase1: getEffectiveModel('GTM_PHASE1', getEffectiveModel('GTM', 'gpt-4o-mini')),
      gtm_phase2: getEffectiveModel('GTM_PHASE2', getEffectiveModel('GTM', 'gpt-4')),
      financial_plan: getEffectiveModel('FINANCIAL_PLAN', 'gpt-4'),
      financial_plan_phase1: getEffectiveModel('FINANCIAL_PLAN_PHASE1', getEffectiveModel('FINANCIAL_PLAN', 'gpt-4o-mini')),
      financial_plan_phase2: getEffectiveModel('FINANCIAL_PLAN_PHASE2', getEffectiveModel('FINANCIAL_PLAN', 'gpt-4')),
      investor_score: getEffectiveModel('INVESTOR_SCORE', 'gpt-4'),
    },
  };

  res.json(config);
});

/**
 * Helper function to resolve effective model configuration
 */
function getEffectiveModel(stepKey: string, fallback: string): string {
  const envVar = `LLM_MODEL_${stepKey}`;
  return process.env[envVar] || process.env.LLM_DEFAULT_MODEL || fallback;
}

export default router;
