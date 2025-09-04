import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ventureRoutes } from "./routes/venture.js";
import "dotenv/config";

const app = Fastify({ logger: true });

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

// --- health endpoint for Render ---
app.get("/health", async (req, reply) => {
  try {
    return reply.send({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: "2025-09-04-o3-mini-temperature-fix",
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
