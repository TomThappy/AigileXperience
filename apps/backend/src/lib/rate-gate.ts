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

  constructor(windowMs = 60000) {
    // 1 minute default
    this.windowMs = windowMs;
  }

  /**
   * Schätzt Token-Anzahl für einen Prompt (sehr grob: 4 chars ≈ 1 token)
   */
  tokenEstimate(
    prompt: string,
    maxTokens = 1200,
  ): { inTok: number; outTok: number; total: number } {
    const inTok = Math.ceil((prompt?.length || 0) / 4);
    const outTok = maxTokens;
    return { inTok, outTok, total: inTok + outTok };
  }

  /**
   * Reserviert Token für einen API-Call
   * Wartet falls nötig bis Budget verfügbar
   */
  async reserveTokens(
    model: string,
    needed: number,
    limit: number,
  ): Promise<{ waitedMs: number }> {
    const startTime = Date.now();
    const now = Date.now();

    let budget = this.budgets.get(model);
    if (!budget || now >= budget.resetAt) {
      budget = {
        used: 0,
        resetAt: now + this.windowMs,
        limit,
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

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Rekursiv versuchen mit neuem Fenster
    const result = await this.reserveTokens(model, needed, limit);
    return { waitedMs: waitMs + result.waitedMs };
  }

  /**
   * Gibt aktuelle Budget-Stats zurück
   */
  getStats(): Record<string, { used: number; limit: number; resetIn: number }> {
    const now = Date.now();
    const stats: Record<
      string,
      { used: number; limit: number; resetIn: number }
    > = {};

    for (const [model, budget] of this.budgets.entries()) {
      stats[model] = {
        used: budget.used,
        limit: budget.limit,
        resetIn: Math.max(0, budget.resetAt - now),
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
    "gpt-4": 30000,
    "gpt-4-turbo": 40000,
    "gpt-4o": 50000,
    "gpt-4o-mini": 200000,
    "claude-3-5-sonnet": 80000,
    "claude-3-haiku": 150000,
  };

  // ENV-basierte Konfiguration
  if (model.includes("gpt-4o-mini")) {
    return parseInt(process.env.OPENAI_TPM_GPT4O_MINI || "200000");
  }
  if (model.includes("gpt-4o")) {
    return parseInt(process.env.OPENAI_TPM_GPT4O || "50000");
  }
  if (model.includes("gpt-4")) {
    return parseInt(process.env.OPENAI_TPM_GPT4 || "30000");
  }
  if (model.includes("claude-3-5-sonnet")) {
    return parseInt(process.env.ANTHROPIC_TPM_SONNET || "80000");
  }
  if (model.includes("claude")) {
    return parseInt(process.env.ANTHROPIC_TPM_HAIKU || "150000");
  }

  // Fallback
  return defaults[model] || 30000;
}

/**
 * Execute LLM call with retries and rate limiting
 */
export async function executeWithRetries<T>(
  llmCall: () => Promise<T>,
  model: string,
  estimatedTokens: number,
  stepId: string,
  jobId?: string,
  phase?: string,
): Promise<{ result: T; attempts: number; rateGateWaitMs: number }> {
  const maxRetries = parseInt(process.env.LLM_RETRIES || "3");
  const baseDelayMs = parseInt(process.env.LLM_RETRY_BASE_DELAY || "2000");

  let lastError: Error | null = null;
  let totalRateGateWait = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Rate gate check and wait
      const limit = getModelLimit(model);
      const { waitedMs } = await rateGate.reserveTokens(
        model,
        estimatedTokens,
        limit,
      );
      totalRateGateWait += waitedMs;

      if (waitedMs > 0) {
        console.log(
          `⏳ [RATE-GATE] Waited ${waitedMs}ms for ${model} on attempt ${attempt}`,
        );
      }

      // Execute the LLM call
      const result = await llmCall();

      console.log(
        `✅ [RATE-GATE] LLM call succeeded on attempt ${attempt} for ${stepId}`,
      );

      return {
        result,
        attempts: attempt,
        rateGateWaitMs: totalRateGateWait,
      };
    } catch (error) {
      lastError = error as Error;

      console.error(
        `❌ [RATE-GATE] LLM call failed on attempt ${attempt} for ${stepId}:`,
        (error as Error).message,
      );

      // Don't retry on certain errors
      if (isNonRetryableError(error as Error)) {
        console.log(`🚫 [RATE-GATE] Non-retryable error, stopping retries`);
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(
          `⏱️ [RATE-GATE] Waiting ${delay}ms before retry ${attempt + 1}`,
        );
        await sleep(delay);
      }
    }
  }

  throw (
    lastError ||
    new Error(`All ${maxRetries} retry attempts failed for ${stepId}`)
  );
}

/**
 * Check if error should not trigger retries
 */
function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const nonRetryablePatterns = [
    "invalid api key",
    "insufficient quota",
    "model not found",
    "invalid request",
    "context length exceeded",
    "content policy violation",
  ];

  return nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialisiert das RateGate System mit Environment Variables
 */
export function initializeRateGate(): void {
  const tokensPerMinute = parseInt(
    process.env.RATEGATE_TOKENS_PER_MINUTE || "40000",
  );
  const tokensPerHour = parseInt(
    process.env.RATEGATE_TOKENS_PER_HOUR || "240000",
  );
  const tokensPerDay = parseInt(
    process.env.RATEGATE_TOKENS_PER_DAY || "1000000",
  );
  const reservePercentage = parseFloat(
    process.env.RATEGATE_RESERVE_PERCENTAGE || "0.20",
  );
  const minTokensForRequest = parseInt(
    process.env.RATEGATE_MIN_TOKENS_FOR_REQUEST || "1000",
  );
  const maxRetries = parseInt(process.env.LLM_RETRIES || "3");
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || "2");

  console.log("🛡️ RateGate Configuration:", {
    tokensPerMinute,
    tokensPerHour,
    tokensPerDay,
    reservePercentage: `${(reservePercentage * 100).toFixed(0)}%`,
    minTokensForRequest,
    maxRetries,
    concurrency,
  });

  // DEBUG: Check all LLM model environment variables
  console.log("🔍 [DEBUG] Environment Variables Check:");
  console.log("🔍 Global Models:", {
    MODEL_NAME: process.env.MODEL_NAME || "NOT SET",
    MODEL_ANALYZE: process.env.MODEL_ANALYZE || "NOT SET",
    MODEL_REFINE: process.env.MODEL_REFINE || "NOT SET",
    LLM_DEFAULT_MODEL: process.env.LLM_DEFAULT_MODEL || "NOT SET",
  });

  console.log("🔍 Step-specific Models:", {
    LLM_MODEL_EVIDENCE: process.env.LLM_MODEL_EVIDENCE || "NOT SET",
    LLM_MODEL_BRIEF: process.env.LLM_MODEL_BRIEF || "NOT SET",
    LLM_MODEL_PROBLEM: process.env.LLM_MODEL_PROBLEM || "NOT SET",
    LLM_MODEL_GTM: process.env.LLM_MODEL_GTM || "NOT SET",
    LLM_MODEL_FINANCIAL_PLAN: process.env.LLM_MODEL_FINANCIAL_PLAN || "NOT SET",
  });

  // Reset any existing budgets
  rateGate.reset();

  console.log("✅ RateGate system initialized successfully");
}
