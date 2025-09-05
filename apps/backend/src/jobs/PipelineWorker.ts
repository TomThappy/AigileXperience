import { getJobQueue } from './JobQueue.js';
import { PipelineManager } from '../v2/pipeline/PipelineManager.js';
import type { JobData, JobArtifact } from './JobQueue.js';
import type { PipelineResult } from '../v2/types.js';

export class EnhancedPipelineWorker {
  private jobQueue = getJobQueue();
  private pipelineManager = new PipelineManager();

  async processJobWithDetailedProgress(jobId: string): Promise<void> {
    const job = await this.jobQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    console.log(`🎯 Processing job ${jobId}: ${job.input.project_title}`);

    try {
      const { input, options } = job;
      
      // Step 1: Starting
      await this.updateProgress(jobId, "starting", 5, 1);
      
      // Step 2: Evidence Harvesting (simulated progress)
      await this.updateProgress(jobId, "evidence_harvesting", 20, 2);
      
      // Step 3: Brief Extraction
      await this.updateProgress(jobId, "brief_extraction", 35, 3);
      
      // Step 4-7: Sections
      await this.updateProgress(jobId, "sections_processing", 65, 4);
      
      // Step 8: Validation
      await this.updateProgress(jobId, "validation", 80, 5);
      
      // Step 9: Scoring
      await this.updateProgress(jobId, "scoring", 90, 6);
      
      // Step 10: Assembly
      await this.updateProgress(jobId, "assembly", 95, 7);
      
      // Execute the actual pipeline
      const result = await this.pipelineManager.executePipeline(input, {
        skipCache: options.skipCache,
        parallelLimit: options.parallelLimit,
        timeoutMs: options.timeoutMs,
      });
      
      if (result.success && result.data) {
        await this.saveArtifact(jobId, "final_dossier", "final", result.data, "hash-" + Date.now());
        
        // Create a complete result with proper state
        const completeResult: PipelineResult = {
          ...result,
          state: {
            pipeline_id: `job-${jobId}`,
            status: "completed",
            ...result.state
          }
        };
        
        await this.jobQueue.setJobResult(jobId, completeResult);
      } else {
        throw new Error(result.error || "Pipeline execution failed");
      }
      
    } catch (error) {
      console.error(`❌ Job ${jobId} failed:`, error);
      await this.jobQueue.updateJobStatus(
        jobId,
        "failed",
        { step: "error", percentage: 100 },
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  private async updateProgress(
    jobId: string,
    step: string,
    percentage: number,
    currentStep: number
  ) {
    await this.jobQueue.updateJobStatus(jobId, "running", {
      step,
      percentage: Math.round(percentage),
      currentStep,
    });
    console.log(
      `📊 Job ${jobId}: ${step} (${Math.round(percentage)}%) - Step ${currentStep}/7`
    );
  }

  private async saveArtifact(
    jobId: string,
    name: string,
    type: JobArtifact["type"],
    data: any,
    hash: string
  ) {
    await this.jobQueue.addArtifact(jobId, { name, type, data, hash });
    console.log(`📄 Job ${jobId}: Saved artifact ${name} (${type})`);
  }
}

// Export singleton
let enhancedWorker: EnhancedPipelineWorker | null = null;

export function getEnhancedWorker(): EnhancedPipelineWorker {
  if (!enhancedWorker) {
    enhancedWorker = new EnhancedPipelineWorker();
  }
  return enhancedWorker;
}
