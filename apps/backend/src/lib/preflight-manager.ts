import { MODEL_CAPABILITIES } from "./context-guards.js";
import { traceSystem } from "./trace-system.js";

export interface PreflightResult {
  shouldTruncate: boolean;
  sources_filtered: any[];
  sources_after_filter: number;
  brief_chars: number;
  truncate_applied: boolean;
  estimated_tokens: number;
  available_tokens: number;
  reserve_tokens: number;
}

export class PreflightManager {
  private readonly RESERVE_TOKENS = 1200; // Reserve for completion
  private readonly MAX_BRIEF_CHARS = 2000; // Hard limit for brief

  /**
   * Perform preflight check and truncation before LLM call
   */
  async performPreflight(
    stepId: string,
    model: string,
    prompt: string,
    sources: any[] = [],
    brief: string = "",
    jobId?: string,
  ): Promise<{
    adjustedPrompt: string;
    result: PreflightResult;
  }> {
    const modelCapabilities = MODEL_CAPABILITIES[model];
    if (!modelCapabilities) {
      throw new Error(`Unknown model for preflight: ${model}`);
    }

    const availableTokens = modelCapabilities.maxTokens - this.RESERVE_TOKENS;
    const promptTokens = this.estimateTokens(prompt);

    let adjustedSources = sources;
    let adjustedBrief = brief;
    let truncateApplied = false;

    // Initial token estimate
    let sourcesTokens = this.estimateTokens(JSON.stringify(sources));
    let briefTokens = this.estimateTokens(brief);
    let totalTokens = promptTokens + sourcesTokens + briefTokens;

    console.log(
      `🔍 [PREFLIGHT] ${stepId} (${model}): ${totalTokens}/${availableTokens} tokens`,
    );

    // Apply truncation if needed
    if (totalTokens > availableTokens) {
      console.log(
        `⚠️ [PREFLIGHT] Token limit exceeded for ${stepId}, applying truncation...`,
      );
      truncateApplied = true;

      // 1. First truncate sources
      if (sourcesTokens > 0) {
        adjustedSources = this.truncateSources(stepId, sources);
        sourcesTokens = this.estimateTokens(JSON.stringify(adjustedSources));
      }

      // 2. Then truncate brief if still over limit
      totalTokens = promptTokens + sourcesTokens + briefTokens;
      if (totalTokens > availableTokens && briefTokens > 0) {
        adjustedBrief = this.truncateBrief(brief);
        briefTokens = this.estimateTokens(adjustedBrief);
      }

      // Recalculate total
      totalTokens = promptTokens + sourcesTokens + briefTokens;
    }

    // Build adjusted prompt
    let adjustedPrompt = prompt;

    if (adjustedBrief.length > 0) {
      adjustedPrompt += `\n\n## BRIEF DATA\n${adjustedBrief}`;
    }

    if (adjustedSources.length > 0) {
      adjustedPrompt += `\n\n## SOURCES DATA (filtered for ${stepId})\n${JSON.stringify(adjustedSources, null, 2)}`;
    }

    const result: PreflightResult = {
      shouldTruncate: truncateApplied,
      sources_filtered: adjustedSources,
      sources_after_filter: adjustedSources.length,
      brief_chars: adjustedBrief.length,
      truncate_applied: truncateApplied,
      estimated_tokens: this.estimateTokens(adjustedPrompt),
      available_tokens: availableTokens,
      reserve_tokens: this.RESERVE_TOKENS,
    };

    // Log to trace if job ID provided
    if (jobId && truncateApplied) {
      console.log(
        `📊 [PREFLIGHT] Applied truncation: sources ${sources.length}→${adjustedSources.length}, brief ${brief.length}→${adjustedBrief.length} chars`,
      );
    }

    return {
      adjustedPrompt,
      result,
    };
  }

  /**
   * Truncate sources based on step-specific filters
   */
  private truncateSources(stepId: string, sources: any[]): any[] {
    const stepFilters: Record<
      string,
      { maxSources: number; maxCharsPerSource: number; keywords?: string[] }
    > = {
      evidence: { maxSources: 20, maxCharsPerSource: 1000 },
      brief: {
        maxSources: 8,
        maxCharsPerSource: 800,
        keywords: ["evidence", "analysis"],
      },
      problem: {
        maxSources: 6,
        maxCharsPerSource: 600,
        keywords: ["problem", "issue", "challenge", "pain"],
      },
      solution: {
        maxSources: 6,
        maxCharsPerSource: 600,
        keywords: ["solution", "product", "technology", "approach"],
      },
      team: {
        maxSources: 4,
        maxCharsPerSource: 600,
        keywords: ["team", "founder", "experience", "background"],
      },
      market: {
        maxSources: 8,
        maxCharsPerSource: 800,
        keywords: ["market", "industry", "sector", "size", "growth"],
      },
      business_model: {
        maxSources: 6,
        maxCharsPerSource: 600,
        keywords: ["revenue", "pricing", "model", "monetization"],
      },
      competition: {
        maxSources: 6,
        maxCharsPerSource: 600,
        keywords: ["competitor", "alternative", "comparison"],
      },
      status_quo: {
        maxSources: 4,
        maxCharsPerSource: 600,
        keywords: ["current", "existing", "traditional"],
      },
      gtm: {
        maxSources: 6,
        maxCharsPerSource: 600,
        keywords: ["marketing", "sales", "customer", "channel"],
      },
      financial_plan: {
        maxSources: 8,
        maxCharsPerSource: 800,
        keywords: ["financial", "funding", "revenue", "cost"],
      },
      investor_score: { maxSources: 8, maxCharsPerSource: 600 },
    };

    const filter = stepFilters[stepId] || {
      maxSources: 6,
      maxCharsPerSource: 600,
    };
    let filteredSources = sources.slice(0, filter.maxSources);

    // Apply keyword filtering if specified
    if (filter.keywords) {
      filteredSources = this.filterSourcesByKeywords(
        sources,
        filter.keywords,
        filter.maxSources,
      );
    }

    // Truncate individual sources
    return filteredSources.map((source) => {
      if (typeof source === "string") {
        return source.length > filter.maxCharsPerSource
          ? source.substring(0, filter.maxCharsPerSource) + "..."
          : source;
      }

      if (source && typeof source === "object") {
        const truncated = { ...source };

        // Truncate common text fields
        ["content", "text", "description", "summary"].forEach((field) => {
          if (truncated[field] && typeof truncated[field] === "string") {
            if (truncated[field].length > filter.maxCharsPerSource) {
              truncated[field] =
                truncated[field].substring(0, filter.maxCharsPerSource) + "...";
            }
          }
        });

        return truncated;
      }

      return source;
    });
  }

  /**
   * Filter sources by keywords relevance
   */
  private filterSourcesByKeywords(
    sources: any[],
    keywords: string[],
    maxSources: number,
  ): any[] {
    const scoredSources = sources.map((source) => {
      const text = this.extractTextFromSource(source).toLowerCase();
      const score = keywords.reduce((acc, keyword) => {
        return acc + (text.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);

      return { source, score };
    });

    return scoredSources
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSources)
      .map((item) => item.source);
  }

  /**
   * Extract text content from various source formats
   */
  private extractTextFromSource(source: any): string {
    if (typeof source === "string") {
      return source;
    }

    if (source && typeof source === "object") {
      // Try common text fields
      const textFields = ["content", "text", "description", "summary", "title"];
      for (const field of textFields) {
        if (source[field] && typeof source[field] === "string") {
          return source[field];
        }
      }

      // Fallback to JSON string
      return JSON.stringify(source);
    }

    return String(source);
  }

  /**
   * Truncate brief to maximum character limit
   */
  private truncateBrief(brief: string): string {
    if (brief.length <= this.MAX_BRIEF_CHARS) {
      return brief;
    }

    // Try to truncate at sentence boundaries
    const truncated = brief.substring(0, this.MAX_BRIEF_CHARS);
    const lastSentence = truncated.lastIndexOf(".");

    if (lastSentence > this.MAX_BRIEF_CHARS * 0.8) {
      // If we can find a sentence ending in the last 20%, use it
      return brief.substring(0, lastSentence + 1);
    } else {
      // Otherwise, hard truncate with ellipsis
      return truncated + "...";
    }
  }

  /**
   * Estimate token count from text (rough estimation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if step requires phase splitting based on token estimate
   */
  shouldForcePhaseSplitting(
    stepId: string,
    estimatedTokens: number,
    modelCapabilities: any,
  ): boolean {
    // Always split these critical steps
    const forceSplitSteps = ["market", "gtm", "financial_plan"];

    if (forceSplitSteps.includes(stepId)) {
      return true;
    }

    // Split if estimated tokens exceed 70% of model capacity
    const threshold = modelCapabilities.maxTokens * 0.7;
    return estimatedTokens > threshold;
  }
}

// Export singleton
export const preflightManager = new PreflightManager();
