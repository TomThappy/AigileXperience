import { traceSystem, createHash } from "./trace-system.js";
import { MODEL_CAPABILITIES } from "./context-guards.js";

export interface PreflightConfig {
  step: string;
  phase?: string;
  model: string;
  maxTokens: number;
  reserveTokens?: number; // Tokens to reserve for response
}

export interface PreflightSource {
  id: string;
  content: string;
  tokens: number;
  priority: number; // Higher priority = more important
  type?: "url" | "document" | "text";
}

export interface PreflightResult {
  ok: boolean;
  model: string;
  ctx_max: number;
  prompt_tokens_est: number;
  truncate_applied: boolean;
  sources_before: number;
  sources_after: number;

  // Truncation details
  sources_kept: PreflightSource[];
  sources_dropped: PreflightSource[];
  brief_truncated?: boolean;
  brief_length_before?: number;
  brief_length_after?: number;

  // Error info
  error?: string;
  error_code?: string;

  // Hashes for reproducibility
  sources_hash: string;
  brief_hash?: string;
}

export interface PreflightContext {
  jobId: string;
  sources: PreflightSource[];
  brief?: string;
  systemPrompt: string;
  userPrompt: string;
}

class PreflightSystem {
  private readonly MAX_BRIEF_LENGTH = 8000; // Characters
  private readonly TOKEN_MULTIPLIER = 0.25; // Approximation: 4 chars = 1 token

  /**
   * Perform preflight check and truncation
   */
  async check(
    config: PreflightConfig,
    context: PreflightContext,
  ): Promise<PreflightResult> {
    const startTime = Date.now();

    // Validate model capabilities
    const modelCaps = MODEL_CAPABILITIES[config.model];
    if (!modelCaps) {
      return {
        ok: false,
        model: config.model,
        ctx_max: 0,
        prompt_tokens_est: 0,
        truncate_applied: false,
        sources_before: context.sources.length,
        sources_after: 0,
        sources_kept: [],
        sources_dropped: context.sources,
        sources_hash: "error",
        error: `Unknown model: ${config.model}`,
        error_code: "UNKNOWN_MODEL",
      };
    }

    const ctx_max = modelCaps.maxTokens;
    const reserveTokens = config.reserveTokens || 1500;
    const availableTokens = ctx_max - reserveTokens;

    // Calculate base prompt tokens
    const basePrompt = context.systemPrompt + context.userPrompt;
    const baseTokens = this.estimateTokens(basePrompt);

    if (baseTokens > availableTokens) {
      return {
        ok: false,
        model: config.model,
        ctx_max,
        prompt_tokens_est: baseTokens,
        truncate_applied: false,
        sources_before: context.sources.length,
        sources_after: 0,
        sources_kept: [],
        sources_dropped: context.sources,
        sources_hash: "error",
        error: "Base prompt exceeds available context length",
        error_code: "PROMPT_TOO_LARGE",
      };
    }

    let availableForContent = availableTokens - baseTokens;
    let brief = context.brief || "";
    let briefTruncated = false;
    let briefLengthBefore = brief.length;
    let briefLengthAfter = briefLengthBefore;

    // Truncate brief if necessary
    if (brief.length > this.MAX_BRIEF_LENGTH) {
      brief = this.truncateBrief(brief, this.MAX_BRIEF_LENGTH);
      briefTruncated = true;
      briefLengthAfter = brief.length;
    }

    const briefTokens = this.estimateTokens(brief);
    availableForContent -= briefTokens;

    // Sort sources by priority (descending) and filter/truncate
    const sortedSources = [...context.sources].sort(
      (a, b) => b.priority - a.priority,
    );
    const sourcesKept: PreflightSource[] = [];
    const sourcesDropped: PreflightSource[] = [];

    let usedTokens = 0;

    for (const source of sortedSources) {
      if (usedTokens + source.tokens <= availableForContent) {
        sourcesKept.push(source);
        usedTokens += source.tokens;
      } else {
        // Check if we can fit a truncated version
        const remainingTokens = availableForContent - usedTokens;
        if (remainingTokens >= 100) {
          // Minimum useful content
          const truncatedContent = this.truncateByTokens(
            source.content,
            remainingTokens,
          );
          const truncatedSource: PreflightSource = {
            ...source,
            content: truncatedContent,
            tokens: remainingTokens,
          };
          sourcesKept.push(truncatedSource);
          usedTokens += remainingTokens;
        } else {
          sourcesDropped.push(source);
        }
      }
    }

    // Calculate final estimates
    const totalTokens = baseTokens + briefTokens + usedTokens;
    const truncateApplied =
      briefTruncated ||
      sourcesDropped.length > 0 ||
      sourcesKept.some((s, i) => s.content !== sortedSources[i]?.content);

    // Create hashes for reproducibility
    const sourcesHash = createHash(
      sourcesKept.map((s) => s.id + s.content).join(""),
    );
    const briefHash = context.brief ? createHash(brief) : undefined;

    const result: PreflightResult = {
      ok: true,
      model: config.model,
      ctx_max,
      prompt_tokens_est: totalTokens,
      truncate_applied: truncateApplied,
      sources_before: context.sources.length,
      sources_after: sourcesKept.length,
      sources_kept: sourcesKept,
      sources_dropped: sourcesDropped,
      brief_truncated: briefTruncated,
      brief_length_before: briefLengthBefore,
      brief_length_after: briefLengthAfter,
      sources_hash: sourcesHash,
      brief_hash: briefHash,
    };

    // Record to trace
    traceSystem.addEntry(context.jobId, {
      step: config.step,
      phase: config.phase,
      model: config.model,
      ctx_max,
      prompt_tokens_est: totalTokens,
      truncate_applied: truncateApplied,
      sources_after_filter: sourcesKept.length,
      rategate_wait_ms: 0,
      attempts: 1,
      status: "ok",
      sources_hash: sourcesHash,
      brief_hash: briefHash,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });

    console.log(
      `🚀 [PREFLIGHT] ${config.step}${config.phase ? `(${config.phase})` : ""}: ` +
        `${totalTokens}/${ctx_max} tokens, ${sourcesKept.length}/${context.sources.length} sources` +
        `${truncateApplied ? " (TRUNCATED)" : ""}`,
    );

    return result;
  }

  /**
   * Estimate tokens from text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Simple heuristic: ~4 characters per token for most languages
    // Add some padding for special tokens and formatting
    return Math.ceil(text.length * this.TOKEN_MULTIPLIER * 1.2);
  }

  /**
   * Truncate text to fit within token limit
   */
  private truncateByTokens(text: string, maxTokens: number): string {
    const maxChars = Math.floor(maxTokens / this.TOKEN_MULTIPLIER);
    if (text.length <= maxChars) return text;

    // Try to truncate at word boundaries
    const truncated = text.substring(0, maxChars);
    const lastSpaceIndex = truncated.lastIndexOf(" ");

    if (lastSpaceIndex > maxChars * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + "...";
    }

    return truncated + "...";
  }

  /**
   * Intelligently truncate brief content
   */
  private truncateBrief(brief: string, maxLength: number): string {
    if (brief.length <= maxLength) return brief;

    // Try to keep the most important parts
    const sections = brief.split("\n\n");
    let result = "";
    let remainingLength = maxLength - 20; // Reserve space for truncation marker

    for (const section of sections) {
      if (result.length + section.length + 2 <= remainingLength) {
        result += (result ? "\n\n" : "") + section;
      } else {
        // Add partial section if there's room
        const spaceLeft = remainingLength - result.length;
        if (spaceLeft > 100) {
          const partialSection = section.substring(0, spaceLeft - 10);
          const lastSentence = partialSection.lastIndexOf(".");
          if (lastSentence > spaceLeft * 0.7) {
            result += "\n\n" + partialSection.substring(0, lastSentence + 1);
          }
        }
        break;
      }
    }

    return result + "\n\n[BRIEF TRUNCATED]";
  }

  /**
   * Create sources from various input types with automatic prioritization
   */
  createSources(
    urls: string[] = [],
    documents: Array<{ content: string; type?: string }> = [],
    additionalText: string[] = [],
  ): PreflightSource[] {
    const sources: PreflightSource[] = [];
    let id = 1;

    // URLs get medium priority
    for (const url of urls) {
      sources.push({
        id: `url_${id++}`,
        content: `URL: ${url}`,
        tokens: this.estimateTokens(`URL: ${url}`),
        priority: 50,
        type: "url",
      });
    }

    // Documents get high priority
    for (const doc of documents) {
      sources.push({
        id: `doc_${id++}`,
        content: doc.content,
        tokens: this.estimateTokens(doc.content),
        priority: 80,
        type: "document",
      });
    }

    // Additional text gets lower priority
    for (const text of additionalText) {
      sources.push({
        id: `text_${id++}`,
        content: text,
        tokens: this.estimateTokens(text),
        priority: 30,
        type: "text",
      });
    }

    return sources;
  }
}

// Singleton instance
export const preflightSystem = new PreflightSystem();

/**
 * Convenience function for common preflight operations
 */
export async function performPreflight(
  jobId: string,
  step: string,
  phase: string | undefined,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  sources: PreflightSource[],
  brief?: string,
): Promise<PreflightResult> {
  return preflightSystem.check(
    {
      step,
      phase,
      model,
      maxTokens: MODEL_CAPABILITIES[model]?.maxTokens || 128000,
    },
    { jobId, sources, brief, systemPrompt, userPrompt },
  );
}
