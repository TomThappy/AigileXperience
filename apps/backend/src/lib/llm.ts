import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

type Provider = "openai" | "anthropic";

const provider: Provider = process.env.ANTHROPIC_API_KEY
  ? "anthropic"
  : "openai";

export async function completePrompt(prompt: string): Promise<string> {
  if (
    process.env.MODEL_NAME?.startsWith("claude") &&
    provider === "anthropic"
  ) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const res = await client.messages.create({
      model: process.env.MODEL_NAME || "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = res.content?.[0]?.type === "text" ? res.content[0].text : "";
    return txt.trim();
  } else {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const res = await client.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
    return (res.choices?.[0]?.message?.content || "").trim();
  }
}
