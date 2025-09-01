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

export async function chatComplete(prompt: string, opts: ChatOptions = {}): Promise<string> {
  const model = opts.model || process.env.MODEL_NAME || "gpt-4o-mini";
  const temp = opts.temperature ?? 0.2;
  const provider = pickProvider(model);

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      temperature: temp,
      messages: [{ role: "user", content: prompt }]
    });
    const txt = res.content?.[0]?.type === "text" ? res.content[0].text : "";
    return txt.trim();
  } else {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const res = await client.chat.completions.create({
      model,
      temperature: temp,
      messages: [{ role: "user", content: prompt }]
    });
    return (res.choices?.[0]?.message?.content || "").trim();
  }
}

// Legacy function for backward compatibility
export async function completePrompt(prompt: string): Promise<string> {
  return chatComplete(prompt);
}
