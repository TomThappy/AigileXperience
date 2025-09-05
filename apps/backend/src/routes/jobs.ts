import { FastifyInstance } from "fastify";
import { getJobQueue } from "../jobs/JobQueue.js";
import { traceSystem } from "../lib/trace-system.js";
import type { PitchInput } from "../v2/types.js";

export default async function jobRoutes(app: FastifyInstance) {
  const jobQueue = await getJobQueue();

  // ---------------------------------------------------------------------------
  // Create Job
  // ---------------------------------------------------------------------------
  app.post("/api/jobs", async (req, reply) => {
    try {
      const body = req.body as any;

      // Akzeptiere sowohl elevator_pitch als auch pitch (Rückwärtskompatibilität)
      const pitch: string | undefined = body.elevator_pitch ?? body.pitch;

      if (!body.project_title || !pitch) {
        return reply.code(400).send({
          error:
            "Missing required fields: project_title and pitch (or elevator_pitch)",
        });
      }

      const input: PitchInput = {
        project_title: body.project_title,
        elevator_pitch: pitch,
        language: body.language || "de",
        target: body.target || "Pre-Seed/Seed VCs",
        geo: body.geo || "EU/DACH",
      };

      const options = {
        skipCache: body.skip_cache === true,
        parallelLimit:
          typeof body.parallel_limit === "number" ? body.parallel_limit : 2,
        timeoutMs:
          typeof body.timeout_ms === "number" ? body.timeout_ms : 300000, // 5m
      };

      const jobId = await jobQueue.createJob(input, options);

      return reply.code(202).send({
        jobId,
        status: "queued",
        message:
          "Job created successfully. Use /api/jobs/:id or /api/jobs/:id/stream.",
      });
    } catch (error) {
      console.error("Error creating job:", error);
      return reply.code(500).send({
        error: "Failed to create job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Get Job Status
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/:jobId", async (req, reply) => {
    try {
      const { jobId } = req.params as { jobId: string };

      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: "Job not found" });
      }

      const artifacts = await jobQueue.getArtifacts(jobId);

      const artifactsSlim = Object.fromEntries(
        Object.entries(artifacts).map(([key, a]) => [
          key,
          {
            name: a.name,
            type: a.type,
            hash: a.hash,
            timestamp: a.timestamp,
          },
        ]),
      );

      return reply.send({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        artifacts: artifactsSlim,
        result: job.result,
      });
    } catch (error) {
      console.error("Error getting job status:", error);
      return reply.code(500).send({
        error: "Failed to get job status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Get Artifact Data
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/:jobId/artifacts/:artifactName", async (req, reply) => {
    try {
      const { jobId, artifactName } = req.params as {
        jobId: string;
        artifactName: string;
      };

      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: "Job not found" });
      }

      const artifacts = await jobQueue.getArtifacts(jobId);
      const artifact = artifacts[artifactName];

      if (!artifact) {
        return reply.code(404).send({ error: "Artifact not found" });
      }

      return reply.send({
        name: artifact.name,
        type: artifact.type,
        data: artifact.data,
        hash: artifact.hash,
        timestamp: artifact.timestamp,
      });
    } catch (error) {
      console.error("Error getting job artifact:", error);
      return reply.code(500).send({
        error: "Failed to get job artifact",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // SSE Stream (progress + trace + artifact_written)
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/:jobId/stream", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };

    try {
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: "Job not found" });
      }

      // SSE-Header
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const sendEvent = (event: string, data: any) => {
        try {
          reply.raw.write(`event: ${event}\n`);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
          // client likely disconnected
        }
      };

      // Initialstatus
      sendEvent("status", {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
      });

      // Polling (2s)
      let lastSeenTraceCount = 0;
      const pollInterval = setInterval(async () => {
        try {
          const currentJob = await jobQueue.getJob(jobId);
          if (!currentJob) {
            clearInterval(pollInterval);
            sendEvent("error", { message: "Job not found" });
            reply.raw.end();
            return;
          }

          // Fortschritt
          sendEvent("progress", {
            jobId: currentJob.id,
            status: currentJob.status,
            progress: currentJob.progress,
            // Ergänzende Felder, falls Frontend sie erwartet:
            step: currentJob.progress?.step ?? null,
            phase: null, // Phase wird über Trace-Events geliefert
            model: null,
            ctx_max: null,
            est_tokens: null,
            sources_used: null,
          });

          // Trace-Events
          const trace = traceSystem.getTrace(jobId);
          if (trace && trace.entries.length > lastSeenTraceCount) {
            const newEntries = trace.entries.slice(lastSeenTraceCount);
            for (const entry of newEntries) {
              sendEvent("trace", {
                step: entry.step,
                phase: entry.phase,
                model: entry.model,
                ctx_max: entry.ctx_max,
                est_tokens: entry.input_tokens_est,
                sources_used: entry.source_count_after_filter,
                rategate_wait_ms: entry.rategate_wait_ms,
                attempts: entry.attempts,
                status: entry.status,
                error_code: entry.error_code,
                error_message: entry.error_message,
                duration_ms: entry.duration_ms,
                started_at: entry.started_at,
                completed_at: entry.completed_at,
                prompt_hash: entry.prompt_hash,
                sources_hash: entry.sources_hash,
              });
            }
            lastSeenTraceCount = trace.entries.length;
          }

          // Artefakte (einfaches Re-Emit; deduplizieren kann später erfolgen)
          const artifacts = await jobQueue.getArtifacts(jobId);
          for (const [artifactName, artifact] of Object.entries(artifacts)) {
            sendEvent("artifact_written", {
              key: artifactName,
              url: `/api/jobs/${jobId}/artifacts/${artifactName}`,
              name: artifact.name,
              type: artifact.type,
              size: artifact.data ? JSON.stringify(artifact.data).length : 0,
              timestamp: artifact.timestamp,
            });
          }

          // Abschluss
          if (
            currentJob.status === "completed" ||
            currentJob.status === "failed"
          ) {
            if (currentJob.result) {
              sendEvent("result", currentJob.result);
            }
            if (currentJob.error) {
              sendEvent("error", { message: currentJob.error });
            }

            const finalTrace = traceSystem.getTrace(jobId);
            if (finalTrace) {
              let durationMs: number | null = null;
              try {
                if (finalTrace.completed_at && finalTrace.started_at) {
                  durationMs =
                    new Date(finalTrace.completed_at).getTime() -
                    new Date(finalTrace.started_at).getTime();
                }
              } catch {}

              sendEvent("trace-summary", {
                total_entries: finalTrace.entries.length,
                duration_ms: durationMs,
                status: finalTrace.status,
                errors: finalTrace.entries.filter((e) => e.status === "error")
                  .length,
                retries: finalTrace.entries.reduce(
                  (sum, e) => sum + Math.max(0, (e.attempts || 1) - 1),
                  0,
                ),
              });
            }

            sendEvent("done", { status: currentJob.status });
            clearInterval(pollInterval);
            reply.raw.end();
          }
        } catch (err) {
          console.error("Error in SSE polling:", err);
          clearInterval(pollInterval);
          sendEvent("error", { message: "Internal server error" });
          reply.raw.end();
        }
      }, 2000);

      // Client trennt
      req.raw.on("close", () => clearInterval(pollInterval));
      req.raw.on("error", () => clearInterval(pollInterval));
    } catch (error) {
      console.error("Error setting up SSE stream:", error);
      return reply.code(500).send({
        error: "Failed to set up stream",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Queue Stats
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/stats", async (_req, reply) => {
    try {
      const stats = await jobQueue.getQueueStats();
      return reply.send(stats);
    } catch (error) {
      console.error("Error getting queue stats:", error);
      return reply.code(500).send({
        error: "Failed to get queue stats",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/health", async (_req, reply) => {
    try {
      const stats = await jobQueue.getQueueStats();
      return reply.send({
        status: "ok",
        timestamp: new Date().toISOString(),
        queue: stats,
      });
    } catch (error) {
      console.error("Job system health check failed:", error);
      return reply.code(503).send({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Trace (immer 200 mit leerem Trace, wenn nichts vorhanden)
  // ---------------------------------------------------------------------------
  app.get("/api/jobs/:jobId/trace", async (req, reply) => {
    try {
      const { jobId } = req.params as { jobId: string };
      let trace = traceSystem.getTrace(jobId);

      if (!trace) {
        const job = await jobQueue.getJob(jobId);
        trace = {
          job_id: jobId,
          created_at: job?.createdAt
            ? new Date(job.createdAt).toISOString()
            : new Date().toISOString(),
          status:
            job?.status === "completed"
              ? "completed"
              : job?.status === "failed"
                ? "failed"
                : "running",
          total_duration_ms:
            job?.completedAt && job?.createdAt
              ? job.completedAt - job.createdAt
              : 0,
          entries: [],
          summary: {
            total_steps: 0,
            total_phases: 0,
            total_llm_calls: 0,
            total_tokens_estimated: 0,
            total_rategate_wait_ms: 0,
            models_used: {},
            errors: 0,
          },
        };
      }

      return reply.send(trace);
    } catch (error) {
      console.error("Failed to get trace:", error);
      return reply.send({
        job_id: (req.params as any)?.jobId,
        created_at: new Date().toISOString(),
        status: "error",
        total_duration_ms: 0,
        entries: [],
        summary: {
          total_steps: 0,
          total_phases: 0,
          total_llm_calls: 0,
          total_tokens_estimated: 0,
          total_rategate_wait_ms: 0,
          models_used: {},
          errors: 1,
        },
        error: "Failed to retrieve trace",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Effective Config (Debug)
  // ---------------------------------------------------------------------------
  app.get("/api/config", async (_req, reply) => {
    const { MODEL_CAPABILITIES } = await import("../lib/context-guards.js");

    const getEffectiveModel = (
      stepName: string,
      defaultValue: string,
    ): string => {
      const envVar = `LLM_MODEL_${stepName}`;
      return (
        process.env[envVar] ||
        process.env.LLM_DEFAULT_MODEL ||
        process.env.MODEL_NAME ||
        defaultValue
      );
    };

    const getModelWithContext = (
      stepName: string,
      defaultValue: string,
      phaseName?: "phase1" | "phase2",
    ): { model: string; ctx_max: number } => {
      let model: string;

      if (phaseName) {
        const phaseEnvVar = `LLM_MODEL_${stepName}_${phaseName.toUpperCase()}`;
        model =
          (process.env as any)[phaseEnvVar] ||
          getEffectiveModel(stepName, defaultValue);
      } else {
        model = getEffectiveModel(stepName, defaultValue);
      }

      const caps =
        (MODEL_CAPABILITIES as any)[model] ??
        (MODEL_CAPABILITIES as any)[defaultValue] ??
        (MODEL_CAPABILITIES as any)["default"];

      // Versuche mehrere mögliche Properties, dann sicherer Fallback
      const ctx =
        caps?.maxTokens ?? caps?.contextWindow ?? caps?.ctx_max ?? 128000;

      return { model, ctx_max: Number(ctx) || 128000 };
    };

    const config = {
      timestamp: new Date().toISOString(),
      node_env: process.env.NODE_ENV,

      global_models: {
        MODEL_NAME: process.env.MODEL_NAME || null,
        MODEL_ANALYZE: process.env.MODEL_ANALYZE || null,
        MODEL_REFINE: process.env.MODEL_REFINE || null,
        LLM_DEFAULT_MODEL: process.env.LLM_DEFAULT_MODEL || null,
      },

      step_models: {
        LLM_MODEL_EVIDENCE: process.env.LLM_MODEL_EVIDENCE || null,
        LLM_MODEL_BRIEF: process.env.LLM_MODEL_BRIEF || null,
        LLM_MODEL_PROBLEM: process.env.LLM_MODEL_PROBLEM || null,
        LLM_MODEL_SOLUTION: process.env.LLM_MODEL_SOLUTION || null,
        LLM_MODEL_TEAM: process.env.LLM_MODEL_TEAM || null,
        LLM_MODEL_MARKET: process.env.LLM_MODEL_MARKET || null,
        LLM_MODEL_BUSINESS_MODEL: process.env.LLM_MODEL_BUSINESS_MODEL || null,
        LLM_MODEL_COMPETITION: process.env.LLM_MODEL_COMPETITION || null,
        LLM_MODEL_STATUS_QUO: process.env.LLM_MODEL_STATUS_QUO || null,
        LLM_MODEL_GTM: process.env.LLM_MODEL_GTM || null,
        LLM_MODEL_FINANCIAL_PLAN: process.env.LLM_MODEL_FINANCIAL_PLAN || null,
        LLM_MODEL_INVESTOR_SCORE: process.env.LLM_MODEL_INVESTOR_SCORE || null,
      },

      phase_models: {
        LLM_MODEL_MARKET_PHASE1: process.env.LLM_MODEL_MARKET_PHASE1 || null,
        LLM_MODEL_MARKET_PHASE2: process.env.LLM_MODEL_MARKET_PHASE2 || null,
        LLM_MODEL_GTM_PHASE1: process.env.LLM_MODEL_GTM_PHASE1 || null,
        LLM_MODEL_GTM_PHASE2: process.env.LLM_MODEL_GTM_PHASE2 || null,
        LLM_MODEL_FINANCIAL_PLAN_PHASE1:
          process.env.LLM_MODEL_FINANCIAL_PLAN_PHASE1 || null,
        LLM_MODEL_FINANCIAL_PLAN_PHASE2:
          process.env.LLM_MODEL_FINANCIAL_PLAN_PHASE2 || null,
      },

      rate_gate: {
        RATEGATE_TOKENS_PER_MINUTE: parseInt(
          process.env.RATEGATE_TOKENS_PER_MINUTE || "40000",
        ),
        RATEGATE_TOKENS_PER_HOUR: parseInt(
          process.env.RATEGATE_TOKENS_PER_HOUR || "240000",
        ),
        RATEGATE_TOKENS_PER_DAY: parseInt(
          process.env.RATEGATE_TOKENS_PER_DAY || "1000000",
        ),
        RATEGATE_RESERVE_PERCENTAGE: parseFloat(
          process.env.RATEGATE_RESERVE_PERCENTAGE || "0.20",
        ),
        RATEGATE_MIN_TOKENS_FOR_REQUEST: parseInt(
          process.env.RATEGATE_MIN_TOKENS_FOR_REQUEST || "1000",
        ),
        RATEGATE_STATS_INTERVAL_MS: parseInt(
          process.env.RATEGATE_STATS_INTERVAL_MS || "30000",
        ),
      },

      api_config: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
          ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...`
          : null,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
          ? `${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`
          : null,
        REDIS_URL: process.env.REDIS_URL
          ? process.env.REDIS_URL.replace(/\/\/[^@]+@/, "//***@")
          : null,
      },

      effective_routing: {
        evidence: getModelWithContext("EVIDENCE", "gpt-4o"),
        brief: getModelWithContext("BRIEF", "gpt-4o"),
        problem: getModelWithContext("PROBLEM", "gpt-4o-mini"),
        solution: getModelWithContext("SOLUTION", "gpt-4o-mini"),
        team: getModelWithContext("TEAM", "gpt-4o-mini"),

        market: getModelWithContext("MARKET", "gpt-4o"),
        market_phase1: getModelWithContext("MARKET", "gpt-4o-mini", "phase1"),
        market_phase2: getModelWithContext("MARKET", "gpt-4o", "phase2"),

        business_model: getModelWithContext("BUSINESS_MODEL", "gpt-4o"),
        competition: getModelWithContext("COMPETITION", "gpt-4o-mini"),
        status_quo: getModelWithContext("STATUS_QUO", "gpt-4o-mini"),

        gtm: getModelWithContext("GTM", "gpt-4o-mini"),
        gtm_phase1: getModelWithContext("GTM", "gpt-4o-mini", "phase1"),
        gtm_phase2: getModelWithContext("GTM", "gpt-4o", "phase2"),

        financial_plan: getModelWithContext("FINANCIAL_PLAN", "gpt-4o"),
        financial_plan_phase1: getModelWithContext(
          "FINANCIAL_PLAN",
          "gpt-4o-mini",
          "phase1",
        ),
        financial_plan_phase2: getModelWithContext(
          "FINANCIAL_PLAN",
          "gpt-4o",
          "phase2",
        ),

        investor_score: getModelWithContext("INVESTOR_SCORE", "gpt-4o"),
      },
    };

    return reply.send(config);
  });
}
