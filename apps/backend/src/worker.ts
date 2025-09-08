#!/usr/bin/env node
import "dotenv/config";
import { getJobQueue } from "./jobs/JobQueue.js";
import { getEnhancedWorker } from "./jobs/PipelineWorker.js";
import { envFlag } from "./utils/envFlag.js";
import type { JobData, JobArtifact } from "./jobs/JobQueue.js";

class PipelineWorker {
  private jobQueue: Awaited<ReturnType<typeof getJobQueue>> | null = null;
  private enhancedWorker: ReturnType<typeof getEnhancedWorker> | null = null;
  private isShuttingDown = false;
  private currentJobId: string | null = null;

  constructor() {
    // Handle graceful shutdown
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
    process.on("SIGINT", () => this.shutdown("SIGINT"));
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      this.shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      this.shutdown("unhandledRejection");
    });
  }

  private validateEnvironment(): void {
    const required = ["REDIS_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `❌ Missing required environment variables: ${missing.join(", ")}`,
      );
    }

    console.log("✅ Environment validation passed");
    console.log(
      `📍 Redis URL: ${process.env.REDIS_URL?.replace(/redis:\/\/[^@]*@/, "redis://***@") || "Not set"}`,
    );
    console.log(
      `🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"}`,
    );
    console.log(
      `🔑 Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? "✅ Set" : "❌ Missing"}`,
    );
  }

  private async initializeServices(): Promise<void> {
    try {
      console.log("🔧 Initializing services...");

      this.jobQueue = await getJobQueue(); // Fix: await the async function
      this.enhancedWorker = getEnhancedWorker();

      // Test Redis connection
      console.log("🔌 Testing Redis connection...");
      await this.jobQueue.getQueueStats();
      console.log("✅ Redis connection successful");
    } catch (error) {
      console.error("❌ Service initialization failed:", error);
      throw error;
    }
  }

  private async shutdown(signal: string) {
    console.log(`🔄 Received ${signal}, initiating graceful shutdown...`);
    this.isShuttingDown = true;

    if (this.currentJobId) {
      console.log(
        `⏳ Waiting for current job ${this.currentJobId} to complete...`,
      );
      // Give current job up to 30 seconds to complete
      let waitTime = 0;
      while (this.currentJobId && waitTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        waitTime += 1000;
      }

      if (this.currentJobId && this.jobQueue) {
        console.log(
          `⚠️ Force terminating job ${this.currentJobId} due to shutdown timeout`,
        );
        await this.jobQueue.updateJobStatus(
          this.currentJobId,
          "failed",
          { step: "shutdown", percentage: 0 },
          "Worker shutdown during processing",
        );
      }
    }

    if (this.jobQueue) {
      await this.jobQueue.disconnect();
    }
    console.log("✅ Worker shutdown complete");
    process.exit(0);
  }

  async start() {
    try {
      console.log("🚀 Pipeline Worker starting...");
      console.log(`🔎 Flags @boot -> LLM_DRY_RUN=${envFlag("LLM_DRY_RUN", false)} DEV_BYPASS_QUEUE=${envFlag("DEV_BYPASS_QUEUE", false)} USE_ASSUMPTIONS_LLM=${envFlag("USE_ASSUMPTIONS_LLM", false)}`);

      // Validate environment
      this.validateEnvironment();

      // Initialize services
      await this.initializeServices();

      console.log("🎯 Worker ready, waiting for jobs...");

      // Clean up old jobs on startup
      await this.jobQueue!.cleanup();

      while (!this.isShuttingDown) {
        try {
          // Get next job from queue (blocking with timeout)
          const jobId = await this.jobQueue!.getNextJob();

          if (!jobId) {
            // No job available, continue loop
            continue;
          }

          this.currentJobId = jobId;
          await this.processJob(jobId);
          this.currentJobId = null;
        } catch (error) {
          console.error("Error in worker main loop:", error);
          if (this.currentJobId) {
            await this.jobQueue!.updateJobStatus(
              this.currentJobId,
              "failed",
              undefined,
              error instanceof Error ? error.message : "Unknown error",
            );
            this.currentJobId = null;
          }
          // Brief pause before retrying
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("💥 Worker startup failed:", error);
      process.exit(1);
    }
  }

  private async processJob(jobId: string) {
    if (!this.enhancedWorker) {
      throw new Error("Enhanced worker not initialized");
    }

    try {
      // Use enhanced worker for detailed progress tracking
      await this.enhancedWorker.processJobWithDetailedProgress(jobId);
      console.log(`✅ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`❌ Job ${jobId} failed with error:`, error);
      // Enhanced worker handles its own error reporting
    }
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new PipelineWorker();
  worker.start().catch((error) => {
    console.error("Fatal error in worker:", error);
    process.exit(1);
  });
}

export { PipelineWorker };
