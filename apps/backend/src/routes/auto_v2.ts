import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { PipelineManager } from "../v2/pipeline/PipelineManager.js";
import type { PitchInput } from "../v2/types.js";

export default async function autoV2(app: FastifyInstance) {
  const pipelineManager = new PipelineManager();

  // Main pipeline execution endpoint
  app.post(
    "/api/v2/dossier/generate",
    {
      config: {
        timeout: 300000, // 5 minutes for this specific route
      },
    },
    async (req, reply) => {
      const startTime = Date.now();
      const traceId = crypto.randomUUID().substring(0, 8);

      app.log.info(`[${traceId}] V2/DOSSIER/GENERATE Request received`);

      try {
        const body = req.body as any;

        // Validate required fields
        if (!body.project_title || !body.elevator_pitch) {
          app.log.warn(`[${traceId}] Missing required fields`);
          return reply.code(400).send({
            error: "Missing required fields: project_title and elevator_pitch",
          });
        }

        const input: PitchInput = {
          project_title: body.project_title,
          elevator_pitch: body.elevator_pitch,
          language: body.language || "de",
          target: body.target || "Pre-Seed/Seed VCs",
          geo: body.geo || "EU/DACH",
        };

        app.log.info(
          `[${traceId}] Starting pipeline for: ${input.project_title}`,
        );

        const options = {
          skipCache: body.skip_cache === true,
          parallelLimit: body.parallel_limit || 2,
          timeoutMs: body.timeout_ms || 120000, // 2 minutes default for better UX
          pipelineId: body.pipeline_id, // Allow external pipeline ID for resume
        };

        const result = await pipelineManager.executePipeline(input, options);

        if (result.success && result.data) {
          app.log.info(
            `[${traceId}] Pipeline completed successfully in ${result.state.total_duration_ms}ms (${result.state.cache_hits} cache hits)`,
          );

          return reply.send({
            success: true,
            data: result.data,
            meta: {
              trace_id: traceId,
              duration_ms: result.state.total_duration_ms,
              cache_hits: result.state.cache_hits,
              steps_completed: Object.keys(result.state.steps).length,
            },
          });
        } else {
          app.log.error(`[${traceId}] Pipeline failed: ${result.error}`);
          return reply.code(500).send({
            error: "Pipeline execution failed",
            trace_id: traceId,
            message: result.error,
            state: result.state,
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        app.log.error(
          `[${traceId}] Pipeline failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
        );

        return reply.code(500).send({
          error: "Internal server error",
          trace_id: traceId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Pipeline status endpoint
  app.get("/api/v2/dossier/status/:pipeline_id", async (req, reply) => {
    const { pipeline_id } = req.params as { pipeline_id: string };

    try {
      const state = await pipelineManager.getState(pipeline_id);

      if (!state) {
        return reply.code(404).send({ error: "Pipeline not found" });
      }

      return reply.send({
        pipeline_id,
        state,
        progress: {
          completed_steps: Object.values(state.steps).filter(
            (s) => s.status === "completed",
          ).length,
          total_steps: Object.keys(state.steps).length,
          running_steps: Object.values(state.steps)
            .filter((s) => s.status === "running")
            .map((s) => s),
        },
      });
    } catch (error) {
      return reply.code(500).send({
        error: "Failed to get pipeline status",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Resume pipeline endpoint
  app.post("/api/v2/dossier/resume/:pipeline_id", async (req, reply) => {
    const { pipeline_id } = req.params as { pipeline_id: string };

    try {
      const result = await pipelineManager.resume(pipeline_id);

      if (result.success) {
        return reply.send({
          success: true,
          data: result.data,
        });
      } else {
        return reply.code(500).send({
          error: "Failed to resume pipeline",
          message: result.error,
        });
      }
    } catch (error) {
      return reply.code(500).send({
        error: "Failed to resume pipeline",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Convenience alias for the main pipeline endpoint (matches v1 naming)
  app.post("/api/v2/auto", async (req, reply) => {
    // Forward to the main dossier/generate endpoint
    const injectedResponse = await app.inject({
      method: "POST",
      url: "/api/v2/dossier/generate",
      payload: req.body as Record<string, any>,
      headers: req.headers as Record<string, string>,
    });

    reply
      .code(injectedResponse.statusCode)
      .type(injectedResponse.headers["content-type"] || "application/json");
    return injectedResponse.payload;
  });

  // Health check endpoint for V2
  app.get("/api/v2/health", async (req, reply) => {
    return reply.send({
      status: "ok",
      version: "v2.0.0",
      timestamp: new Date().toISOString(),
      features: [
        "evidence_harvester",
        "structured_sections",
        "intelligent_caching",
        "parallel_processing",
        "resume_capability",
      ],
    });
  });
}
