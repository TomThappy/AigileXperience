import { traceSystem } from "./trace-system.js";

export interface ModelCapabilities {
  name: string;
  maxTokens: number;
  inputCost: number;
  outputCost: number;
  speed: "fast" | "medium" | "slow";
  quality: "basic" | "good" | "excellent";
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  "gpt-3.5-turbo": {
    name: "gpt-3.5-turbo",
    maxTokens: 4096,
    inputCost: 0.0015,
    outputCost: 0.002,
    speed: "fast",
    quality: "basic",
  },
  "gpt-4o-mini": {
    name: "gpt-4o-mini",
    maxTokens: 128000,
    inputCost: 0.00015,
    outputCost: 0.0006,
    speed: "fast",
    quality: "good",
  },
  "gpt-4o": {
    name: "gpt-4o",
    maxTokens: 128000,
    inputCost: 0.0025,
    outputCost: 0.01,
    speed: "medium",
    quality: "excellent",
  },
  "gpt-4": {
    name: "gpt-4",
    maxTokens: 8192,
    inputCost: 0.03,
    outputCost: 0.06,
    speed: "slow",
    quality: "excellent",
  },
  "gpt-4-1106-preview": {
    name: "gpt-4-1106-preview",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "excellent",
  },
  "gpt-4-0125-preview": {
    name: "gpt-4-0125-preview",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "excellent",
  },
  "gpt-4-turbo": {
    name: "gpt-4-turbo",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "excellent",
  },
  "gpt-4-turbo-preview": {
    name: "gpt-4-turbo-preview",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "excellent",
  },
  "claude-3-5-sonnet": {
    name: "claude-3-5-sonnet",
    maxTokens: 200000,
    inputCost: 0.003,
    outputCost: 0.015,
    speed: "medium",
    quality: "excellent",
  },
  "claude-3-haiku": {
    name: "claude-3-haiku",
    maxTokens: 200000,
    inputCost: 0.00025,
    outputCost: 0.00125,
    speed: "fast",
    quality: "good",
  },
  "claude-3-sonnet": {
    name: "claude-3-sonnet",
    maxTokens: 200000,
    inputCost: 0.003,
    outputCost: 0.015,
    speed: "medium",
    quality: "excellent",
  },
  "claude-3-opus": {
    name: "claude-3-opus",
    maxTokens: 200000,
    inputCost: 0.015,
    outputCost: 0.075,
    speed: "slow",
    quality: "excellent",
  },
  "gpt-4.1": {
    name: "gpt-4.1",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "excellent",
  },
  "o3-mini": {
    name: "o3-mini",
    maxTokens: 128000,
    inputCost: 0.001,
    outputCost: 0.003,
    speed: "fast",
    quality: "good",
  },
  // Fallback für unbekannte Modelle
  default: {
    name: "default",
    maxTokens: 128000,
    inputCost: 0.01,
    outputCost: 0.03,
    speed: "medium",
    quality: "good",
  },
};

// Steps that require large context windows due to complex prompts and data
export const LARGE_CONTEXT_STEPS = [
  "evidence",
  "brief",
  "market",
  "business_model",
  "gtm",
  "financial_plan",
  "investor_score",
];

// Steps that must use high-quality models
export const HIGH_QUALITY_STEPS = [
  "evidence",
  "brief",
  "market",
  "business_model",
  "financial_plan",
  "investor_score",
];

// Minimum context requirements per step
export const STEP_CONTEXT_REQUIREMENTS: Record<string, number> = {
  evidence: 32000, // Large prompt + web scraping results
  brief: 24000, // Evidence data + analysis
  market: 40000, // Phase-split with market research
  business_model: 32000, // Complex business logic
  gtm: 36000, // Phase-split with marketing data
  financial_plan: 48000, // Phase-split with financial projections
  investor_score: 28000, // All sections summary + scoring

  // Smaller steps
  problem: 16000,
  solution: 16000,
  team: 12000,
  competition: 18000,
  status_quo: 14000,
};

export class ContextGuard {
  /**
   * Check if a model is suitable for a step
   */
  static isModelSuitableForStep(
    modelName: string,
    stepId: string,
    phase?: string,
  ): {
    suitable: boolean;
    reason?: string;
    suggestedModel?: string;
  } {
    const model = MODEL_CAPABILITIES[modelName];

    if (!model) {
      return {
        suitable: false,
        reason: `Unknown model: ${modelName}`,
        suggestedModel: "gpt-4o-mini",
      };
    }

    // Check for banned small context models on large steps
    if (model.maxTokens <= 8192 && LARGE_CONTEXT_STEPS.includes(stepId)) {
      return {
        suitable: false,
        reason: `Model ${modelName} (${model.maxTokens} tokens) insufficient for large step ${stepId}`,
        suggestedModel: HIGH_QUALITY_STEPS.includes(stepId)
          ? "gpt-4"
          : "gpt-4o-mini",
      };
    }

    // Check minimum context requirement
    const requiredContext = STEP_CONTEXT_REQUIREMENTS[stepId];
    if (requiredContext && model.maxTokens < requiredContext) {
      return {
        suitable: false,
        reason: `Model ${modelName} (${model.maxTokens} tokens) below required ${requiredContext} for ${stepId}`,
        suggestedModel: HIGH_QUALITY_STEPS.includes(stepId)
          ? "gpt-4"
          : "gpt-4o-mini",
      };
    }

    // Check quality requirements
    if (HIGH_QUALITY_STEPS.includes(stepId) && model.quality === "basic") {
      return {
        suitable: false,
        reason: `Model ${modelName} quality (${model.quality}) insufficient for critical step ${stepId}`,
        suggestedModel: "gpt-4",
      };
    }

    return { suitable: true };
  }

  /**
   * Enforce model selection with guards
   */
  static enforceModelSelection(
    originalModel: string,
    stepId: string,
    phase?: string,
    jobId?: string,
  ): {
    finalModel: string;
    wasOverridden: boolean;
    reason?: string;
  } {
    const check = this.isModelSuitableForStep(originalModel, stepId, phase);

    if (check.suitable) {
      return {
        finalModel: originalModel,
        wasOverridden: false,
      };
    }

    const finalModel = check.suggestedModel || "gpt-4o-mini";

    // Log the override
    console.error(`🚫 CONTEXT GUARD: ${check.reason}`);
    console.log(
      `🔄 Overriding ${originalModel} → ${finalModel} for ${stepId}${phase ? ` (${phase})` : ""}`,
    );

    // Record in trace if available
    if (jobId) {
      traceSystem.addEntry(jobId, {
        step: stepId,
        phase,
        model: finalModel,
        context_window: MODEL_CAPABILITIES[finalModel]?.maxTokens || 0,
        prompt_size: 0,
        estimated_tokens: 0,
        rate_gate_wait_ms: 0,
        attempts: 1,
        status: "guard_override",
        error_code: `MODEL_OVERRIDE_${originalModel.toUpperCase().replace(/-/g, "_")}`,
        timestamp: new Date().toISOString(),
        sources: [
          `Context guard overrode ${originalModel} due to: ${check.reason}`,
        ],
        hash: "",
      });
    }

    return {
      finalModel,
      wasOverridden: true,
      reason: check.reason,
    };
  }

  /**
   * Perform preflight check for a batch of steps
   */
  static preflightCheck(
    modelMapping: Record<string, string>,
    jobId?: string,
  ): {
    passed: boolean;
    violations: Array<{
      step: string;
      model: string;
      issue: string;
      suggestion: string;
    }>;
    correctedMapping: Record<string, string>;
  } {
    const violations: Array<{
      step: string;
      model: string;
      issue: string;
      suggestion: string;
    }> = [];

    const correctedMapping: Record<string, string> = {};

    for (const [step, model] of Object.entries(modelMapping)) {
      const enforcement = this.enforceModelSelection(
        model,
        step,
        undefined,
        jobId,
      );

      correctedMapping[step] = enforcement.finalModel;

      if (enforcement.wasOverridden) {
        violations.push({
          step,
          model,
          issue: enforcement.reason || "Model not suitable",
          suggestion: enforcement.finalModel,
        });
      }
    }

    const passed = violations.length === 0;

    if (!passed) {
      console.warn(
        `⚠️  Preflight check found ${violations.length} model violations:`,
      );
      violations.forEach((v) => {
        console.warn(`   ${v.step}: ${v.model} → ${v.suggestion} (${v.issue})`);
      });
    }

    return {
      passed,
      violations,
      correctedMapping,
    };
  }

  /**
   * Force phase-splitting for steps that require it
   */
  static requiresPhaseSplitting(
    stepId: string,
    modelName: string,
    estimatedTokens: number,
  ): boolean {
    const model = MODEL_CAPABILITIES[modelName];

    if (!model) {
      return false;
    }

    // Always split these steps regardless of model
    const forceSplitSteps = ["market", "gtm", "financial_plan"];

    if (forceSplitSteps.includes(stepId)) {
      return true;
    }

    // Split if estimated tokens exceed 70% of model capacity
    const threshold = model.maxTokens * 0.7;

    return estimatedTokens > threshold;
  }

  /**
   * Get recommended model for a step
   */
  static getRecommendedModel(stepId: string): string {
    if (HIGH_QUALITY_STEPS.includes(stepId)) {
      return "gpt-4";
    }

    if (LARGE_CONTEXT_STEPS.includes(stepId)) {
      return "gpt-4o-mini";
    }

    return "gpt-4o-mini";
  }

  /**
   * Get model capabilities
   */
  static getModelCapabilities(modelName: string): ModelCapabilities | null {
    return MODEL_CAPABILITIES[modelName] || null;
  }

  /**
   * Estimate cost for a model/token combination
   */
  static estimateCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const model = MODEL_CAPABILITIES[modelName];

    if (!model) {
      return 0;
    }

    return (
      (inputTokens / 1000) * model.inputCost +
      (outputTokens / 1000) * model.outputCost
    );
  }
}

export default ContextGuard;
