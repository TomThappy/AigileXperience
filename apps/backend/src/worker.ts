#!/usr/bin/env node
import 'dotenv/config';
import { getJobQueue } from './jobs/JobQueue.js';
import { getEnhancedWorker } from './jobs/PipelineWorker.js';
import type { JobData, JobArtifact } from './jobs/JobQueue.js';

class PipelineWorker {
  private jobQueue = getJobQueue();
  private enhancedWorker = getEnhancedWorker();
  private isShuttingDown = false;
  private currentJobId: string | null = null;
  
  constructor() {
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('unhandledRejection');
    });
  }

  private async shutdown(signal: string) {
    console.log(`🔄 Received ${signal}, initiating graceful shutdown...`);
    this.isShuttingDown = true;
    
    if (this.currentJobId) {
      console.log(`⏳ Waiting for current job ${this.currentJobId} to complete...`);
      // Give current job up to 30 seconds to complete
      let waitTime = 0;
      while (this.currentJobId && waitTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
      
      if (this.currentJobId) {
        console.log(`⚠️ Force terminating job ${this.currentJobId} due to shutdown timeout`);
        await this.jobQueue.updateJobStatus(
          this.currentJobId,
          'failed',
          { step: 'shutdown', percentage: 0 },
          'Worker shutdown during processing'
        );
      }
    }
    
    await this.jobQueue.disconnect();
    console.log('✅ Worker shutdown complete');
    process.exit(0);
  }

  async start() {
    console.log('🚀 Pipeline Worker started, waiting for jobs...');
    
    // Clean up old jobs on startup
    await this.jobQueue.cleanup();
    
    while (!this.isShuttingDown) {
      try {
        // Get next job from queue (blocking with timeout)
        const jobId = await this.jobQueue.getNextJob();
        
        if (!jobId) {
          // No job available, continue loop
          continue;
        }
        
        this.currentJobId = jobId;
        await this.processJob(jobId);
        this.currentJobId = null;
        
      } catch (error) {
        console.error('Error in worker main loop:', error);
        if (this.currentJobId) {
          await this.jobQueue.updateJobStatus(
            this.currentJobId,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error'
          );
          this.currentJobId = null;
        }
        // Brief pause before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processJob(jobId: string) {
    try {
      // Use enhanced worker for detailed progress tracking
      await this.enhancedWorker.processJobWithDetailedProgress(jobId);
      console.log(`✅ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`❌ Job ${jobId} failed with error:`, error);
      // Enhanced worker handles its own error reporting
    }
  }

  private async executePipelineWithProgress(
    job: JobData,
    progressCallback: (step: string, percentage: number, currentStep: number) => Promise<void>,
    artifactCallback: (name: string, type: JobArtifact['type'], data: any, hash: string) => Promise<void>
  ) {
    const { input, options } = job;
    
    // Step 1: Evidence Harvesting
    await progressCallback('evidence_harvesting', 10, 1);
    // Here we would normally call the evidence harvester
    // For now, use the existing pipeline but add progress tracking
    
    // Step 2: Brief Extraction
    await progressCallback('brief_extraction', 25, 2);
    
    // Step 3-6: Sections (Problem, Solution, Team, Market, Business Model, Competition, GTM, Status Quo, Financial Plan)
    const sections = [
      'problem', 'solution', 'team', 'market', 
      'business_model', 'competition', 'gtm', 
      'status_quo', 'financial_plan'
    ];
    
    for (let i = 0; i < sections.length; i++) {
      const percentage = 30 + (i / sections.length) * 50; // 30-80%
      await progressCallback(`section_${sections[i]}`, Math.round(percentage), 3 + i);
    }
    
    // Step 7: Validation & Scoring
    await progressCallback('validation_scoring', 90, 6);
    
    // Final assembly
    await progressCallback('final_assembly', 95, 7);
    
    // Execute the actual pipeline
    const result = await this.pipelineManager.executePipeline(input, {
      skipCache: options.skipCache,
      parallelLimit: options.parallelLimit,
      timeoutMs: options.timeoutMs,
    });
    
    return result;
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new PipelineWorker();
  worker.start().catch((error) => {
    console.error('Fatal error in worker:', error);
    process.exit(1);
  });
}

export { PipelineWorker };
