import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

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
  const model = opts.model || process.env.MODEL_NAME || "gpt-4o-mini";
  const temp = opts.temperature ?? 0.2;
  const provider = pickProvider(model);

  console.log("🤖 ChatComplete called:", {
    model,
    temperature: temp,
    provider,
    promptLength: prompt.length,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
  });

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      temperature: temp,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = res.content?.[0]?.type === "text" ? res.content[0].text : "";
    return txt.trim();
  } else {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    // Some models don't support temperature parameter
    const chatParams: any = {
      model,
      messages: [{ role: "user", content: prompt }],
    };
    // Only add temperature if model supports it (exclude o1-*, o3-*, gpt-4o-mini)
    const supportsTemp = !model.startsWith("o1-") && !model.startsWith("o3-") && model !== "gpt-4o-mini";
    if (supportsTemp && temp !== undefined) {
      chatParams.temperature = temp;
    }

    console.log("🔥 Making OpenAI API call:", {
      model,
      supportsTemp,
      finalTemp: chatParams.temperature,
      apiKeyPresent: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      params: { ...chatParams, messages: "[TRUNCATED]" },
    });

    try {
      const res = await client.chat.completions.create(chatParams);
      console.log("✅ OpenAI API call successful:", {
        model,
        usage: res.usage,
        choices: res.choices?.length,
        responseLength: res.choices?.[0]?.message?.content?.length || 0,
      });
      return (res.choices?.[0]?.message?.content || "").trim();
    } catch (apiError) {
      console.error("❌ OpenAI API call failed:", {
        model,
        error:
          apiError instanceof Error
            ? {
                name: apiError.name,
                message: apiError.message,
                stack: apiError.stack?.split("\n").slice(0, 3),
              }
            : String(apiError),
        params: { ...chatParams, messages: "[TRUNCATED]" },
      });
      throw apiError;
    }
  }
}

// Legacy function for backward compatibility
export async function completePrompt(prompt: string): Promise<string> {
  return chatComplete(prompt);
}
