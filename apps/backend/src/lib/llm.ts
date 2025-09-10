import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { rateGate, getModelLimit } from "./rate-gate.js";
import { envFlag } from "../utils/envFlag.js";

export type Provider = "openai" | "anthropic";
type ChatOptions = { model?: string; temperature?: number };

function pickProvider(model?: string): Provider {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (model?.startsWith("claude") && hasAnthropic) return "anthropic";
  if (hasOpenAI) return "openai";
  if (hasAnthropic) return "anthropic";
  throw new Error("No LLM provider configured");
}

export async function chatComplete(
  prompt: string,
  opts: ChatOptions = {},
): Promise<string> {
  const model = opts.model || process.env.MODEL_NAME || "gpt-4o";
  const temp = opts.temperature ?? 0.2;
  const provider = pickProvider(model);
  const maxRetries = parseInt(process.env.LLM_RETRIES || "3");

  // 🔧 DRY-RUN MODE - Return synthetic response without API calls
  if (envFlag("LLM_DRY_RUN", false)) {
    console.log(
      `🏃 [DRY-RUN] Returning synthetic response for model: ${model}`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 400),
    ); // Simulate API latency

    return JSON.stringify(
      {
        title: "Sample Output",
        description: "This is a synthetic response for DRY-RUN mode.",
        market_size: "$1.2B",
        competition: ["Competitor A", "Competitor B"],
        status: "completed",
        confidence: 85,
        generated_by: "DRY-RUN mode",
        model_used: model,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  console.log("🤖 [LLM] ChatComplete called:", {
    model,
    temperature: temp,
    provider,
    promptLength: prompt.length,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    fallbackUsed: !opts.model
      ? `from ${process.env.MODEL_NAME ? "MODEL_NAME" : "hardcoded default"}`
      : false,
  });

  // Rate limiting - schätze Token und reserviere Budget
  const maxTokens = 1200; // Conservative estimate for output
  const { total: estimatedTokens } = rateGate.tokenEstimate(prompt, maxTokens);
  const tokenLimit = getModelLimit(model);

  const { waitedMs } = await rateGate.reserveTokens(
    model,
    estimatedTokens,
    tokenLimit,
  );
  if (waitedMs > 0) {
    console.log(`⏳ Waited ${waitedMs}ms for rate limit on ${model}`);
  }

  // Retry logic for 429 errors
  const startTime = Date.now();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (provider === "anthropic") {
        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY!,
        });
        const res = await client.messages.create({
          model,
          max_tokens: 4000,
          temperature: temp,
          messages: [{ role: "user", content: prompt }],
        });
        const txt =
          res.content?.[0]?.type === "text" ? res.content[0].text : "";
        return txt.trim();
      } else {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        // Some models don't support temperature parameter
        const chatParams: any = {
          model,
          messages: [{ role: "user", content: prompt }],
        };

        // Only add temperature if model supports it (exclude o1-*, o3-*, gpt-4o-mini)
        const supportsTemp =
          !model.startsWith("o1-") &&
          !model.startsWith("o3-") &&
          model !== "gpt-4o-mini";
        if (supportsTemp && temp !== undefined) {
          chatParams.temperature = temp;
        }

        console.log(
          `🔥 [LLM] Making OpenAI API call (attempt ${attempt}/${maxRetries}):`,
          {
            model,
            supportsTemp,
            finalTemp: chatParams.temperature,
            apiKeyPresent: !!process.env.OPENAI_API_KEY,
            apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
            estimatedTokens,
            waitedMs,
            params: { ...chatParams, messages: "[TRUNCATED]" },
          },
        );

        const res = await client.chat.completions.create(chatParams);
        console.log("✅ [LLM] OpenAI call successful:", {
          model,
          attempt,
          duration: `${Date.now() - startTime}ms`,
          usage: {
            total_tokens: res.usage?.total_tokens ?? 0,
            completion_tokens: res.usage?.completion_tokens ?? 0,
            prompt_tokens: res.usage?.prompt_tokens ?? 0,
          },
          responseLength: res.choices?.[0]?.message?.content?.length || 0,
          choices: res.choices?.length,
          efficiency: res.usage?.total_tokens
            ? `${Math.round((res.usage.total_tokens / estimatedTokens) * 100)}%`
            : "unknown",
        });
        return (res.choices?.[0]?.message?.content || "").trim();
      }
    } catch (apiError: any) {
      const isRateLimit =
        apiError?.status === 429 || apiError?.code === "rate_limit_exceeded";

      console.error(
        `❌ LLM API call failed (attempt ${attempt}/${maxRetries}):`,
        {
          model,
          attempt,
          isRateLimit,
          error:
            apiError instanceof Error
              ? {
                  name: apiError.name,
                  message: apiError.message,
                  status: apiError?.status,
                  code: apiError?.code,
                }
              : String(apiError),
        },
      );

      // Retry logic für 429 Errors
      if (isRateLimit && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
        console.log(`🔄 Rate limit hit, retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Final attempt failed or non-retryable error
      throw apiError;
    }
  }

  throw new Error(`All ${maxRetries} attempts failed`);
}

// Legacy function for backward compatibility
export async function completePrompt(prompt: string): Promise<string> {
  return chatComplete(prompt);
}
