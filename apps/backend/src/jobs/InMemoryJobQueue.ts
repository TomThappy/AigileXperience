import crypto from "crypto";
import type { PitchInput, PipelineResult } from "../v2/types.js";
import { traceSystem } from "../lib/trace-system.js";
import type { JobData, JobArtifact } from "./JobQueue.js";

export class InMemoryJobQueue {
  private store = new Map<string, JobData>();
  private artifacts = new Map<string, Record<string, any>>();
  private readonly maxStoredJobs = 1000; // Prevent memory bloat
  private readonly jobRetentionMs = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupTimer: NodeJS.Timeout | null = null;

  async createJob(
    input: PitchInput,
    options: JobData["options"] = {},
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const job: JobData = {
      id,
      input,
      options: {
        skipCache: false,
        parallelLimit: 2,
        timeoutMs: 300000,
        ...options,
      },
      status: "queued",
      progress: {
        step: "queued",
        percentage: 0,
        totalSteps: 7,
        currentStep: 0,
      },
      createdAt: now,
    };
    this.store.set(id, job);

    console.log(
      `✅ [DEV] Created in-memory job ${id} for project: ${input.project_title}`,
    );

    // DEV-Bypass: sofort ausführen
    queueMicrotask(() =>
      this.processNow(id).catch((err) => {
        console.error(`❌ [DEV] processNow error for job ${id}:`, err);
      }),
    );
    return id;
  }

  private async processNow(jobId: string) {
    const job = this.store.get(jobId);
    if (!job) return;

    // Status -> running
    job.status = "running";
    job.startedAt = Date.now();
    job.progress = {
      ...job.progress,
      step: "evidence",
      currentStep: 1,
      percentage: 5,
    };

    // Trace-Start
    traceSystem.startTrace(jobId);

    try {
      // Import hier, um Zyklen zu vermeiden
      const { PipelineManager } = await import(
        "../v2/pipeline/PipelineManager.js"
      );
      const pipelineManager = new PipelineManager();

      // Pipeline ausführen
      const result: PipelineResult = await pipelineManager.executePipeline(
        job.input,
        {
          onProgress: (step: string, percentage: number) => {
            job.progress = {
              ...job.progress,
              step,
              percentage,
              currentStep: Math.ceil((percentage / 100) * 7),
            };
            console.log(`🔄 [DEV] Job ${jobId}: ${step} (${percentage}%)`);
          },
          onArtifact: (key: string, artifact: any) => {
            this.addArtifact(jobId, {
              name: key,
              type: artifact.type || "section",
              data: artifact.data || artifact,
              hash: crypto
                .createHash("md5")
                .update(JSON.stringify(artifact))
                .digest("hex"),
            });
          },
          jobId,
        },
      );

      // Abschluss
      job.result = result;
      job.status = "completed";
      job.completedAt = Date.now();
      job.progress = {
        ...job.progress,
        percentage: 100,
        step: "done",
        currentStep: job.progress.totalSteps,
      };

      traceSystem.completeTrace(jobId, "completed");
      console.log(`🎉 [DEV] Job ${jobId} completed successfully`);
    } catch (err: any) {
      job.status = "failed";
      job.completedAt = Date.now();
      job.error = err?.message || String(err);
      traceSystem.completeTrace(jobId, "failed");

      traceSystem.addEntry(jobId, {
        step: "error",
        model: "system",
        ctx_max: 0,
        prompt_tokens_est: 0,
        truncate_applied: false,
        sources_after_filter: 0,
        rategate_wait_ms: 0,
        attempts: 1,
        status: "error",
        error_code: "PIPELINE_EXECUTION_ERROR",
        error_message: err?.message || String(err),
      });

      console.error(`❌ [DEV] Job ${jobId} failed:`, err);
    }
  }

  async getJob(id: string) {
    return this.store.get(id) || null;
  }

  async updateJobStatus(
    id: string,
    status: JobData["status"],
    progress?: Partial<JobData["progress"]>,
    error?: string,
  ) {
    const job = this.store.get(id);
    if (!job) return;
    job.status = status;
    if (progress) job.progress = { ...job.progress, ...progress };
    if (error) job.error = error;
    if (status === "running" && !job.startedAt) job.startedAt = Date.now();
    if ((status === "completed" || status === "failed") && !job.completedAt)
      job.completedAt = Date.now();
  }

  async setJobResult(id: string, result: PipelineResult) {
    const job = this.store.get(id);
    if (!job) return;
    job.result = result;
    job.status = "completed";
    job.completedAt = Date.now();
    job.progress.percentage = 100;
  }

  async addArtifact(
    jobId: string,
    artifact: { name: string; type: any; data: any; hash: string },
  ) {
    const all = this.artifacts.get(jobId) || {};
    all[artifact.name] = { ...artifact, timestamp: Date.now() };
    this.artifacts.set(jobId, all);
    console.log(`📄 [DEV] Added artifact ${artifact.name} for job ${jobId}`);
  }

  async getArtifacts(jobId: string) {
    return this.artifacts.get(jobId) || {};
  }

  async getQueueStats() {
    const all = [...this.store.values()];
    return {
      queued: all.filter((j) => j.status === "queued").length,
      running: all.filter((j) => j.status === "running").length,
      completed: all.filter((j) => j.status === "completed").length,
      failed: all.filter((j) => j.status === "failed").length,
      total: all.length,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }

  /**
   * Clean up old jobs to prevent memory leaks in production
   */
  async cleanup(): Promise<{ removed: number }> {
    const now = Date.now();
    let removedCount = 0;
    const jobsToRemove: string[] = [];

    // Find jobs older than retention period
    for (const [jobId, job] of this.store) {
      const referenceTime = job.completedAt ?? job.createdAt;
      const jobAge = now - referenceTime;
      const isCompleted = job.status === "completed" || job.status === "failed";

      if (isCompleted && jobAge > this.jobRetentionMs) {
        jobsToRemove.push(jobId);
      }
    }

    // If still over limit, remove oldest completed jobs
    if (this.store.size > this.maxStoredJobs) {
      const completedJobs = [...this.store.entries()]
        .filter(
          ([_, job]) => job.status === "completed" || job.status === "failed",
        )
        .sort(([_, a], [__, b]) => a.createdAt - b.createdAt);

      const excess = this.store.size - this.maxStoredJobs;
      for (let i = 0; i < Math.min(excess, completedJobs.length); i++) {
        const [jobId] = completedJobs[i];
        if (!jobsToRemove.includes(jobId)) {
          jobsToRemove.push(jobId);
        }
      }
    }

    // Remove jobs and their artifacts
    for (const jobId of jobsToRemove) {
      this.store.delete(jobId);
      this.artifacts.delete(jobId);
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`🧹 [CLEANUP] Removed ${removedCount} old jobs from memory`);
    }

    return { removed: removedCount };
  }

  /**
   * Start periodic cleanup (call this once during initialization)
   */
  startPeriodicCleanup(): void {
    if (this.cleanupTimer) return; // already started
    
    // Run cleanup every hour
    this.cleanupTimer = setInterval(
      () => {
        this.cleanup().catch((err) => {
          console.error("🚨 [CLEANUP] Error during periodic cleanup:", err);
        });
      },
      60 * 60 * 1000,
    );

    // Don't keep process alive just for cleanup
    this.cleanupTimer.unref?.();
    
    console.log("🔧 [INIT] Periodic job cleanup started (every 60 minutes)");
  }
}
