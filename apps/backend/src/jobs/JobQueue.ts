import Redis from "ioredis";
import crypto from "node:crypto";
import type { PitchInput, PipelineResult } from "../v2/types.js";

export interface JobData {
  id: string;
  input: PitchInput;
  options: {
    skipCache?: boolean;
    parallelLimit?: number;
    timeoutMs?: number;
  };
  status: "queued" | "running" | "completed" | "failed";
  progress: {
    step: string;
    percentage: number;
    totalSteps: number;
    currentStep: number;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: PipelineResult;
}

export interface JobArtifact {
  name: string;
  type: "evidence" | "brief" | "section" | "score" | "final";
  data: any;
  hash: string;
  timestamp: number;
}

export class JobQueue {
  private redis: Redis;
  private readonly QUEUE_KEY = "pipeline:jobs:queue";
  private readonly JOB_PREFIX = "pipeline:job";
  private readonly ARTIFACT_PREFIX = "pipeline:artifact";

  constructor() {
    // Use Redis URL from environment or default to localhost
    const redisUrl =
      process.env.REDIS_URL ||
      process.env.REDISCLOUD_URL ||
      "redis://localhost:6379";
    this.redis = new Redis(redisUrl, {
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }

  async createJob(
    input: PitchInput,
    options: JobData["options"] = {},
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const job: JobData = {
      id: jobId,
      input,
      options: {
        skipCache: options.skipCache || false,
        parallelLimit: options.parallelLimit || 2,
        timeoutMs: options.timeoutMs || 300000, // 5 minutes
        ...options,
      },
      status: "queued",
      progress: {
        step: "queued",
        percentage: 0,
        totalSteps: 7, // Evidence, Brief, 4 Sections, Validation, Score
        currentStep: 0,
      },
      createdAt: Date.now(),
    };

    // Store job data
    await this.redis.setex(
      `${this.JOB_PREFIX}:${jobId}`,
      3600, // 1 hour TTL
      JSON.stringify(job),
    );

    // Add to queue
    await this.redis.lpush(this.QUEUE_KEY, jobId);

    console.log(`✅ Created job ${jobId} for project: ${input.project_title}`);
    return jobId;
  }

  async getJob(jobId: string): Promise<JobData | null> {
    const jobData = await this.redis.get(`${this.JOB_PREFIX}:${jobId}`);
    return jobData ? JSON.parse(jobData) : null;
  }

  async updateJobStatus(
    jobId: string,
    status: JobData["status"],
    progress?: Partial<JobData["progress"]>,
    error?: string,
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    job.status = status;
    if (progress) {
      job.progress = { ...job.progress, ...progress };
    }
    if (error) {
      job.error = error;
    }
    if (status === "running" && !job.startedAt) {
      job.startedAt = Date.now();
    }
    if (status === "completed" || status === "failed") {
      job.completedAt = Date.now();
    }

    await this.redis.setex(
      `${this.JOB_PREFIX}:${jobId}`,
      3600,
      JSON.stringify(job),
    );

    console.log(
      `🔄 Job ${jobId}: ${status} - ${progress?.step || "N/A"} (${progress?.percentage || 0}%)`,
    );
  }

  async setJobResult(jobId: string, result: PipelineResult): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    job.result = result;
    job.status = "completed";
    job.completedAt = Date.now();
    job.progress.percentage = 100;

    await this.redis.setex(
      `${this.JOB_PREFIX}:${jobId}`,
      3600,
      JSON.stringify(job),
    );

    console.log(`✅ Job ${jobId} completed successfully`);
  }

  async addArtifact(
    jobId: string,
    artifact: Omit<JobArtifact, "timestamp">,
  ): Promise<void> {
    const artifactWithTimestamp: JobArtifact = {
      ...artifact,
      timestamp: Date.now(),
    };

    await this.redis.setex(
      `${this.ARTIFACT_PREFIX}:${jobId}:${artifact.name}`,
      3600,
      JSON.stringify(artifactWithTimestamp),
    );

    console.log(`📄 Added artifact ${artifact.name} for job ${jobId}`);
  }

  async getArtifacts(jobId: string): Promise<Record<string, JobArtifact>> {
    const keys = await this.redis.keys(`${this.ARTIFACT_PREFIX}:${jobId}:*`);
    const artifacts: Record<string, JobArtifact> = {};

    for (const key of keys) {
      const artifactData = await this.redis.get(key);
      if (artifactData) {
        const artifact = JSON.parse(artifactData);
        const name = key.split(":").pop()!;
        artifacts[name] = artifact;
      }
    }

    return artifacts;
  }

  async getNextJob(): Promise<string | null> {
    const jobId = await this.redis.brpop(this.QUEUE_KEY, 5); // 5 second timeout
    return jobId ? jobId[1] : null;
  }

  async getQueueStats(): Promise<{ pending: number; processing: number }> {
    const pending = await this.redis.llen(this.QUEUE_KEY);

    // Count jobs with 'running' status
    const runningJobs = await this.redis.keys(`${this.JOB_PREFIX}:*`);
    let processing = 0;

    for (const key of runningJobs) {
      const jobData = await this.redis.get(key);
      if (jobData) {
        const job = JSON.parse(jobData);
        if (job.status === "running") {
          processing++;
        }
      }
    }

    return { pending, processing };
  }

  async cleanup(): Promise<void> {
    // Clean up jobs older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const jobKeys = await this.redis.keys(`${this.JOB_PREFIX}:*`);

    for (const key of jobKeys) {
      const jobData = await this.redis.get(key);
      if (jobData) {
        const job = JSON.parse(jobData);
        if (job.createdAt < cutoff) {
          const jobId = job.id;
          await this.redis.del(key);

          // Clean up artifacts
          const artifactKeys = await this.redis.keys(
            `${this.ARTIFACT_PREFIX}:${jobId}:*`,
          );
          if (artifactKeys.length > 0) {
            await this.redis.del(...artifactKeys);
          }
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
let jobQueue: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!jobQueue) {
    jobQueue = new JobQueue();
  }
  return jobQueue;
}
