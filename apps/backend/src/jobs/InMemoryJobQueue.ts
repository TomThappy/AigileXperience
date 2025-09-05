import crypto from "crypto";
import type { PitchInput, PipelineResult } from "../v2/types.js";
import { traceSystem } from "../lib/trace-system.js";
import type { JobData, JobArtifact } from "./JobQueue.js";

export class InMemoryJobQueue {
  private store = new Map<string, JobData>();
  private artifacts = new Map<string, Record<string, any>>();

  async createJob(input: PitchInput, options: JobData["options"] = {}): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const job: JobData = {
      id,
      input,
      options: { skipCache: false, parallelLimit: 2, timeoutMs: 300000, ...options },
      status: "queued",
      progress: { step: "queued", percentage: 0, totalSteps: 7, currentStep: 0 },
      createdAt: now,
    };
    this.store.set(id, job);
    
    console.log(`✅ [DEV] Created in-memory job ${id} for project: ${input.project_title}`);
    
    // DEV-Bypass: sofort ausführen
    queueMicrotask(() => this.processNow(id).catch(err => {
      console.error(`❌ [DEV] processNow error for job ${id}:`, err);
    }));
    return id;
  }

  private async processNow(jobId: string) {
    const job = this.store.get(jobId);
    if (!job) return;

    // Status -> running
    job.status = "running";
    job.startedAt = Date.now();
    job.progress = { ...job.progress, step: "evidence", currentStep: 1, percentage: 5 };

    // Trace-Start
    traceSystem.startTrace(jobId);

    try {
      // Import hier, um Zyklen zu vermeiden
      const { PipelineManager } = await import("../v2/pipeline/PipelineManager.js");
      const pipelineManager = new PipelineManager();

      // Pipeline ausführen
      const result: PipelineResult = await pipelineManager.executePipeline(job.input, {
        onProgress: (step: string, percentage: number) => {
          job.progress = { ...job.progress, step, percentage, currentStep: Math.ceil((percentage / 100) * 7) };
          console.log(`🔄 [DEV] Job ${jobId}: ${step} (${percentage}%)`);
        },
        onArtifact: (key: string, artifact: any) => {
          this.addArtifact(jobId, {
            name: key,
            type: artifact.type || "section",
            data: artifact.data || artifact,
            hash: crypto.createHash("md5").update(JSON.stringify(artifact)).digest("hex")
          });
        },
        jobId,
      });

      // Abschluss
      job.result = result;
      job.status = "completed";
      job.completedAt = Date.now();
      job.progress = { ...job.progress, percentage: 100, step: "done", currentStep: job.progress.totalSteps };

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
        error_message: err?.message || String(err)
      });
      
      console.error(`❌ [DEV] Job ${jobId} failed:`, err);
    }
  }

  async getJob(id: string) { return this.store.get(id) || null; }

  async updateJobStatus(id: string, status: JobData["status"], progress?: Partial<JobData["progress"]>, error?: string) {
    const job = this.store.get(id);
    if (!job) return;
    job.status = status;
    if (progress) job.progress = { ...job.progress, ...progress };
    if (error) job.error = error;
    if (status === "running" && !job.startedAt) job.startedAt = Date.now();
    if ((status === "completed" || status === "failed") && !job.completedAt) job.completedAt = Date.now();
  }

  async setJobResult(id: string, result: PipelineResult) {
    const job = this.store.get(id);
    if (!job) return;
    job.result = result;
    job.status = "completed";
    job.completedAt = Date.now();
    job.progress.percentage = 100;
  }

  async addArtifact(jobId: string, artifact: { name: string; type: any; data: any; hash: string }) {
    const all = this.artifacts.get(jobId) || {};
    all[artifact.name] = { ...artifact, timestamp: Date.now() };
    this.artifacts.set(jobId, all);
    console.log(`📄 [DEV] Added artifact ${artifact.name} for job ${jobId}`);
  }

  async getArtifacts(jobId: string) { return this.artifacts.get(jobId) || {}; }

  async getQueueStats() {
    const all = [...this.store.values()];
    return {
      pending: all.filter(j => j.status === "queued").length,
      processing: all.filter(j => j.status === "running").length,
      completed: all.filter(j => j.status === "completed").length,
      failed: all.filter(j => j.status === "failed").length,
      queued: all.filter(j => j.status === "queued").length,
      running: all.filter(j => j.status === "running").length,
    };
  }
}
