import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { chatComplete } from "./llm.js";
import { traceSystem } from "./trace-system.js";
import { artifactManager } from "./artifact-manager.js";

export interface LLMJsonOptions {
  model: string;
  system: string;
  user: string;
  schema: any;
  max_tokens?: number;
  retries?: number;
  stepId?: string;
  phase?: string;
  jobId?: string;
}

export interface LLMJsonResult<T> {
  data: T;
  attempts: number;
  rawTextPath?: string;
  truncateApplied: boolean;
  sourcesAfterFilter: number;
  rateGateWaitMs: number;
}

/**
 * Robust LLM JSON call with structured output, repair, and comprehensive error handling
 */
export async function llmJson<T>(
  options: LLMJsonOptions,
): Promise<LLMJsonResult<T>> {
  const {
    model,
    system,
    user,
    schema,
    max_tokens = 1200,
    retries = 2,
    stepId = "unknown",
    phase,
    jobId,
  } = options;

  let attempts = 0;
  let lastError: Error | null = null;
  let rawTextPath: string | undefined;
  let rawResponse = "";

  const traceEntry = {
    step: stepId,
    phase,
    model,
    ctx_max: getModelContextSize(model),
    prompt_tokens_est: estimateTokens(system + user),
    truncate_applied: false, // Will be updated by preflight
    sources_after_filter: 0,
    rategate_wait_ms: 0,
    attempts: 0,
    status: "pending" as const,
    error_code: undefined,
    error_message: undefined,
    started_at: new Date().toISOString(),
    raw_text_path: undefined,
  };

  try {
    // Store raw text path for debugging
    if (jobId) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      rawTextPath = `/artifacts/${jobId}/${stepId}/${phase ? `phase${phase}_` : ""}raw_${timestamp}.txt`;
      traceEntry.raw_text_path = rawTextPath;
    }

    for (attempts = 1; attempts <= retries + 1; attempts++) {
      try {
        console.log(
          `🔄 [LLM-JSON] ${stepId}${phase ? `(${phase})` : ""} attempt ${attempts}/${retries + 1} with ${model}`,
        );

        // Update trace for this attempt
        traceEntry.attempts = attempts;
        if (jobId) {
          traceSystem.addEntry(jobId, { ...traceEntry, status: "running" });
        }

        // 1) Structured Output call with OpenAI
        rawResponse = await callLLMWithStructuredOutput({
          model,
          system,
          user,
          schema,
          max_tokens,
        });

        // Store raw response for debugging
        if (jobId && rawTextPath) {
          await artifactManager.storeArtifact(jobId, stepId, rawResponse, {
            type: "text",
            phase: phase ? `${phase}_raw` : "raw",
          });
        }

        // 2) Parse JSON
        let jsonData: any;
        try {
          jsonData = JSON.parse(rawResponse);
          console.log(
            `✅ [LLM-JSON] ${stepId}${phase ? `(${phase})` : ""} successful JSON parse on attempt ${attempts}`,
          );

          // Success - update trace
          if (jobId) {
            traceSystem.addEntry(jobId, {
              ...traceEntry,
              status: "ok",
              completed_at: new Date().toISOString(),
              duration_ms:
                Date.now() - new Date(traceEntry.started_at).getTime(),
            });
          }

          return {
            data: jsonData as T,
            attempts,
            rawTextPath,
            truncateApplied: traceEntry.truncate_applied,
            sourcesAfterFilter: traceEntry.sources_after_filter,
            rateGateWaitMs: traceEntry.rategate_wait_ms,
          };
        } catch (parseError) {
          console.warn(
            `⚠️ [LLM-JSON] JSON parse failed on attempt ${attempts}: ${parseError}`,
          );

          // 3) Try jsonrepair
          try {
            const repaired = jsonrepair(rawResponse);
            jsonData = JSON.parse(repaired);
            console.log(
              `🔧 [LLM-JSON] Successfully repaired JSON on attempt ${attempts}`,
            );

            if (jobId) {
              traceSystem.addEntry(jobId, {
                ...traceEntry,
                status: "ok",
                error_code: "JSON_REPAIRED",
                completed_at: new Date().toISOString(),
                duration_ms:
                  Date.now() - new Date(traceEntry.started_at).getTime(),
              });
            }

            return {
              data: jsonData as T,
              attempts,
              rawTextPath,
              truncateApplied: traceEntry.truncate_applied,
              sourcesAfterFilter: traceEntry.sources_after_filter,
              rateGateWaitMs: traceEntry.rategate_wait_ms,
            };
          } catch (repairError) {
            console.warn(
              `⚠️ [LLM-JSON] JSON repair also failed: ${repairError}`,
            );

            // 4) If not the last attempt, try fixer-pass
            if (attempts <= retries) {
              console.log(
                `🔄 [LLM-JSON] Trying fixer-pass for attempt ${attempts + 1}`,
              );

              rawResponse = await callLLMWithStructuredOutput({
                model,
                system:
                  "You are a JSON fixer. Output ONLY valid minified JSON matching the schema. No prose, no explanations, no markdown.",
                user: `SCHEMA:\n${JSON.stringify(schema, null, 2)}\n\nBROKEN_JSON:\n${rawResponse}`,
                schema,
                max_tokens,
              });

              // Continue to next iteration to try parsing the fixed response
              continue;
            }

            // Final attempt failed
            lastError = new Error(
              `JSON parsing failed after ${attempts} attempts: ${parseError}`,
            );
          }
        }
      } catch (llmError) {
        console.error(
          `❌ [LLM-JSON] LLM call failed on attempt ${attempts}:`,
          llmError,
        );
        lastError = llmError as Error;

        // Check if this is a non-retryable error
        if (isNonRetryableError(llmError as Error)) {
          break;
        }

        // Wait before retry
        if (attempts <= retries) {
          const delay = Math.min(2000 * Math.pow(2, attempts - 1), 10000);
          console.log(`⏱️ [LLM-JSON] Waiting ${delay}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    const errorCode = getErrorCode(lastError);
    const errorMessage = lastError?.message || "Unknown error";

    console.error(
      `❌ [LLM-JSON] Final failure after ${attempts - 1} attempts: ${errorMessage}`,
    );

    // Record failure in trace
    if (jobId) {
      traceSystem.addEntry(jobId, {
        ...traceEntry,
        attempts: attempts - 1,
        status: "error",
        error_code: errorCode,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(traceEntry.started_at).getTime(),
      });
    }

    throw new Error(
      `LLM JSON failed after ${attempts - 1} attempts: ${errorMessage}`,
    );
  } catch (error) {
    // Record unexpected error in trace
    if (jobId) {
      traceSystem.addEntry(jobId, {
        ...traceEntry,
        attempts: attempts || 1,
        status: "error",
        error_code: "UNEXPECTED_ERROR",
        error_message: (error as Error).message,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(traceEntry.started_at).getTime(),
      });
    }

    throw error;
  }
}

/**
 * Call LLM with structured output (OpenAI format)
 */
async function callLLMWithStructuredOutput(options: {
  model: string;
  system: string;
  user: string;
  schema: any;
  max_tokens: number;
}): Promise<string> {
  const { model, system, user, schema, max_tokens } = options;

  // For OpenAI models, use structured output
  if (model.includes("gpt")) {
    return await chatComplete(user, {
      model,
      temperature: 0.1,
      max_tokens,
      system_message: system,
      // Note: The actual structured output implementation depends on your LLM client
      // This is a placeholder - you'll need to update your chatComplete function
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "payload",
          schema,
          strict: true,
        },
      },
    });
  }

  // For other models, add schema to prompt
  const enhancedUser = `${user}\n\nOutput ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;

  return await chatComplete(enhancedUser, {
    model,
    temperature: 0.1,
    max_tokens,
    system_message: system,
  });
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
    "content policy violation",
    "context length exceeded",
  ];

  return nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Get error code from error
 */
function getErrorCode(error: Error | null): string {
  if (!error) return "UNKNOWN";

  const message = error.message.toLowerCase();

  if (message.includes("json")) return "JSON_PARSE_ERROR";
  if (message.includes("429")) return "RATE_LIMIT";
  if (message.includes("500")) return "SERVER_ERROR";
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("context length")) return "CONTEXT_EXCEEDED";

  return "LLM_CALL_ERROR";
}

/**
 * Get model context size
 */
function getModelContextSize(model: string): number {
  const contextSizes: Record<string, number> = {
    "gpt-3.5-turbo": 4096,
    "gpt-4": 8192,
    "gpt-4-turbo": 128000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-1106-preview": 128000,
    "gpt-4-0125-preview": 128000,
  };

  return contextSizes[model] || 128000;
}

/**
 * Estimate token count from text (rough estimation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
