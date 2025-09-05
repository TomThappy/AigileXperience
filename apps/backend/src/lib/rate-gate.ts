/**
 * Rate Gate System - Token-Per-Minute Budgetierung für LLM APIs
 * 
 * Verhindert 429 Rate Limit Errors durch:
 * - Token-Schätzung vor API-Calls
 * - Budget-Tracking pro Modell
 * - Waiting/Backoff wenn Budget erschöpft
 */

interface TokenBudget {
  used: number;
  resetAt: number;
  limit: number;
}

class RateGate {
  private budgets = new Map<string, TokenBudget>();
  private readonly windowMs: number;

  constructor(windowMs = 60000) { // 1 minute default
    this.windowMs = windowMs;
  }

  /**
   * Schätzt Token-Anzahl für einen Prompt (sehr grob: 4 chars ≈ 1 token)
   */
  tokenEstimate(prompt: string, maxTokens = 1200): { inTok: number; outTok: number; total: number } {
    const inTok = Math.ceil((prompt?.length || 0) / 4);
    const outTok = maxTokens;
    return { inTok, outTok, total: inTok + outTok };
  }

  /**
   * Reserviert Token für einen API-Call
   * Wartet falls nötig bis Budget verfügbar
   */
  async reserveTokens(model: string, needed: number, limit: number): Promise<{ waitedMs: number }> {
    const startTime = Date.now();
    const now = Date.now();
    
    let budget = this.budgets.get(model);
    if (!budget || now >= budget.resetAt) {
      budget = {
        used: 0,
        resetAt: now + this.windowMs,
        limit
      };
      this.budgets.set(model, budget);
    }

    // Budget verfügbar?
    if (budget.used + needed <= budget.limit) {
      budget.used += needed;
      return { waitedMs: 0 };
    }

    // Warten bis neues Fenster
    const waitMs = budget.resetAt - now + 100; // +100ms Buffer
    console.log(`⏳ Rate limit reached for ${model}. Waiting ${waitMs}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, waitMs));
    
    // Rekursiv versuchen mit neuem Fenster
    const result = await this.reserveTokens(model, needed, limit);
    return { waitedMs: waitMs + result.waitedMs };
  }

  /**
   * Gibt aktuelle Budget-Stats zurück
   */
  getStats(): Record<string, { used: number; limit: number; resetIn: number }> {
    const now = Date.now();
    const stats: Record<string, { used: number; limit: number; resetIn: number }> = {};
    
    for (const [model, budget] of this.budgets.entries()) {
      stats[model] = {
        used: budget.used,
        limit: budget.limit,
        resetIn: Math.max(0, budget.resetAt - now)
      };
    }
    
    return stats;
  }

  /**
   * Reset aller Budgets (für Testing)
   */
  reset(): void {
    this.budgets.clear();
  }
}

// Singleton Instance
export const rateGate = new RateGate();

/**
 * Helper: Model-spezifische Rate Limits aus ENV laden
 */
export function getModelLimit(model: string): number {
  // Default Limits basierend auf üblichen OpenAI/Anthropic Plänen
  const defaults: Record<string, number> = {
    'gpt-4': 30000,
    'gpt-4-turbo': 40000,
    'gpt-4o': 50000,
    'gpt-4o-mini': 200000,
    'claude-3-5-sonnet': 80000,
    'claude-3-haiku': 150000
  };

  // ENV-basierte Konfiguration
  if (model.includes('gpt-4o-mini')) {
    return parseInt(process.env.OPENAI_TPM_GPT4O_MINI || '200000');
  }
  if (model.includes('gpt-4o')) {
    return parseInt(process.env.OPENAI_TPM_GPT4O || '50000');
  }
  if (model.includes('gpt-4')) {
    return parseInt(process.env.OPENAI_TPM_GPT4 || '30000');
  }
  if (model.includes('claude-3-5-sonnet')) {
    return parseInt(process.env.ANTHROPIC_TPM_SONNET || '80000');
  }
  if (model.includes('claude')) {
    return parseInt(process.env.ANTHROPIC_TPM_HAIKU || '150000');
  }

  // Fallback
  return defaults[model] || 30000;
}
