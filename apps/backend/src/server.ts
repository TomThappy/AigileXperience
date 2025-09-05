import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ventureRoutes } from "./routes/venture.js";
import "dotenv/config";

// 🚨 API Key Detection and Warnings
console.log("🔍 [STARTUP] Checking API Keys...");
if (!process.env.OPENAI_API_KEY) {
  console.error("🚨 [CRITICAL] OPENAI_API_KEY not found in environment!");
  console.error("   Pipeline will fail without valid OpenAI API key.");
  console.error("   Please set OPENAI_API_KEY in your .env file.");
} else {
  const keyStart = process.env.OPENAI_API_KEY.substring(0, 12);
  console.log(`✅ [STARTUP] OpenAI API Key detected: ${keyStart}...`);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  [WARNING] ANTHROPIC_API_KEY not found in environment.");
  console.warn("   Claude models will not be available.");
} else {
  const keyStart = process.env.ANTHROPIC_API_KEY.substring(0, 12);
  console.log(`✅ [STARTUP] Anthropic API Key detected: ${keyStart}...`);
}

// DEV Bypass detection
if (process.env.DEV_BYPASS_QUEUE === "true") {
  console.log(
    "🔧 [DEV] DEV_BYPASS_QUEUE enabled - Jobs will run synchronously without Redis",
  );
}

// LLM DRY_RUN detection
if (process.env.LLM_DRY_RUN === "true") {
  console.log(
    "🏃 [DEV] LLM_DRY_RUN enabled - No actual API calls, synthetic responses only",
  );
  console.log("   This saves costs during development and testing.");
} else {
  console.log("💰 [PROD] LLM_DRY_RUN disabled - Real API calls will be made");
}

const app = Fastify({
  logger: true,
  requestTimeout: 300000, // 5 minutes for long-running operations
  keepAliveTimeout: 65000, // Slightly higher than default
  connectionTimeout: 10000,
});

await app.register(cors, {
  origin: [/\.vercel\.app$/, "https://aigilexperience.vercel.app"],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false,
});
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

await ventureRoutes(app);
const { recalcRoutes } = await import("./routes/recalc.js");
await recalcRoutes(app);
const { default: autoV1 } = await import("./routes/auto_v1.js");
await autoV1(app);
const { default: autoRecalc } = await import("./routes/auto_recalc.js");
await autoRecalc(app);
const { default: autoV2 } = await import("./routes/auto_v2.js");
await autoV2(app);
const { default: jobRoutes } = await import("./routes/jobs.js");
await jobRoutes(app);

// --- health endpoint for Render ---
app.get("/health", async (req, reply) => {
  try {
    return reply.send({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: "2025-09-05-v2-job-queue-system",
      env: {
        node: process.version,
        platform: process.platform,
      },
    });
  } catch (e) {
    reply.code(500).send({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

const port = Number(process.env.PORT) || 3001;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
