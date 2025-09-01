import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ventureRoutes } from "./routes/venture.js";
import "dotenv/config";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

await ventureRoutes(app);
const { recalcRoutes } = await import("./routes/recalc.js");
await recalcRoutes(app);

const port = Number(process.env.PORT) || 3001;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
