import { getJobQueue } from './JobQueue.js';
import { PipelineManager } from '../v2/pipeline/PipelineManager.js';
import { StepProcessor } from '../v2/pipeline/StepProcessor.js';
import { EvidenceHarvester } from '../v2/pipeline/EvidenceHarvester.js';
import { IncrementalBuilder } from '../v2/pipeline/IncrementalBuilder.js';
import type { JobData, JobArtifact } from './JobQueue.js';
import type { PipelineResult, PipelineState } from '../v2/types.js';

export class EnhancedPipelineWorker {
  private jobQueue = getJobQueue();
  private pipelineManager = new PipelineManager();
  private stepProcessor = new StepProcessor();
  private evidenceHarvester = new EvidenceHarvester();
  private incrementalBuilder = new IncrementalBuilder();
  
  async processJobWithDetailedProgress(jobId: string): Promise<void> {
    const job = await this.jobQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    console.log(`🎯 Processing job ${jobId}: ${job.input.project_title}`);
    
    try {
      // Mark job as running
      await this.updateProgress(jobId, 'starting', 0, 1);
      
      const { input, options } = job;
      const pipelineId = `job-${jobId}`;
      
      // Step 1: Input Processing (5%)
      await this.updateProgress(jobId, 'input_processing', 5, 1);
      const pitchData = await this.stepProcessor.processInput(input);
      await this.saveArtifact(jobId, 'pitch', 'evidence', pitchData, pitchData.pitch_hash);
      
      // Step 2: Evidence Harvesting (5-30%)
      await this.updateProgress(jobId, 'evidence_harvesting', 10, 2);
      const sources = await this.harvestEvidenceWithProgress(jobId, pitchData);
      await this.saveArtifact(jobId, 'sources', 'evidence', sources, sources.sources_hash);
      
      // Step 3: Brief Extraction (30-40%)
      await this.updateProgress(jobId, 'brief_extraction', 35, 3);
      const brief = await this.stepProcessor.extractBrief(pitchData, sources);
      await this.saveArtifact(jobId, 'brief', 'brief', brief, brief.brief_hash);
      
      // Step 4-12: Sections Processing (40-85%)
      const sections = await this.processSectionsWithProgress(jobId, brief, sources);
      
      // Step 13: Validation (85-90%)
      await this.updateProgress(jobId, 'validation', 87, 13);
      const validatedSections = await this.stepProcessor.validateSections(sections);
      
      // Step 14: Investor Scoring (90-95%)
      await this.updateProgress(jobId, 'scoring', 92, 14);
      const score = await this.stepProcessor.calculateScore(brief, validatedSections);
      await this.saveArtifact(jobId, 'score', 'score', score, score.score_hash);
      
      // Step 15: Final Assembly (95-100%)
      await this.updateProgress(jobId, 'assembly', 97, 15);
      const finalDossier = await this.stepProcessor.assembleFinalDossier(
        pitchData, sources, brief, validatedSections, score
      );
      
      const result: PipelineResult = {
        success: true,
        data: finalDossier,
        state: {
          pipeline_id: pipelineId,
          status: 'completed',
          total_duration_ms: Date.now() - job.createdAt,
          cache_hits: 0, // TODO: Track actual cache hits
          steps: {}, // TODO: Add detailed step information
        }
      };
      
      await this.saveArtifact(jobId, 'final_dossier', 'final', finalDossier, finalDossier.hash);
      await this.jobQueue.setJobResult(jobId, result);
      
    } catch (error) {
      console.error(`❌ Job ${jobId} failed:`, error);
      await this.jobQueue.updateJobStatus(
        jobId,
        'failed',
        { step: 'error', percentage: 100 },
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }
  
  private async updateProgress(jobId: string, step: string, percentage: number, currentStep: number) {
    await this.jobQueue.updateJobStatus(jobId, 'running', {
      step,
      percentage: Math.round(percentage),
      currentStep,
    });
    console.log(`📊 Job ${jobId}: ${step} (${Math.round(percentage)}%) - Step ${currentStep}/15`);
  }
  
  private async saveArtifact(
    jobId: string, 
    name: string, 
    type: JobArtifact['type'], 
    data: any, 
    hash: string
  ) {
    await this.jobQueue.addArtifact(jobId, { name, type, data, hash });
    console.log(`📄 Job ${jobId}: Saved artifact ${name} (${type})`);
  }
  
  private async harvestEvidenceWithProgress(jobId: string, pitchData: any) {
    const topics = [
      'market_size', 'customer_pain', 'solution_validation', 
      'competition', 'business_model', 'team_background',
      'funding_landscape', 'regulatory_environment'
    ];
    
    let completed = 0;
    const results: any = { topics: {}, sources_hash: '' };
    
    for (const topic of topics) {
      const topicData = await this.evidenceHarvester.searchTopic(topic, pitchData);
      results.topics[topic] = topicData;
      completed++;
      
      const percentage = 10 + (completed / topics.length) * 20; // 10-30%
      await this.updateProgress(jobId, `evidence_${topic}`, percentage, 2);
    }
    
    // Generate sources hash
    results.sources_hash = this.stepProcessor.generateHash(JSON.stringify(results.topics));
    return results;
  }
  
  private async processSectionsWithProgress(jobId: string, brief: any, sources: any) {
    const sectionConfigs = [
      { name: 'problem', step: 4, basePercentage: 40 },
      { name: 'solution', step: 5, basePercentage: 45 },
      { name: 'team', step: 6, basePercentage: 50 },
      { name: 'market', step: 7, basePercentage: 55 },
      { name: 'business_model', step: 8, basePercentage: 60 },
      { name: 'competition', step: 9, basePercentage: 65 },
      { name: 'gtm', step: 10, basePercentage: 70 },
      { name: 'status_quo', step: 11, basePercentage: 75 },
      { name: 'financial_plan', step: 12, basePercentage: 80 },
    ];
    
    const sections: Record<string, any> = {};
    
    // Process sections with controlled concurrency
    const concurrencyLimit = 2;
    const inProgress: Promise<void>[] = [];
    
    for (const config of sectionConfigs) {
      const sectionPromise = this.processSingleSection(
        jobId, config, brief, sources, sections
      );
      
      inProgress.push(sectionPromise);
      
      // Limit concurrency
      if (inProgress.length >= concurrencyLimit) {
        await Promise.race(inProgress);
        // Remove completed promises
        const completedIndex = inProgress.findIndex(p => 
          p === sectionPromise || Promise.resolve(p) === Promise.resolve(p)
        );
        if (completedIndex !== -1) {
          inProgress.splice(completedIndex, 1);
        }
      }
    }
    
    // Wait for all remaining sections
    await Promise.all(inProgress);
    
    return sections;
  }
  
  private async processSingleSection(
    jobId: string,
    config: { name: string; step: number; basePercentage: number },
    brief: any,
    sources: any,
    sections: Record<string, any>
  ) {
    try {
      await this.updateProgress(jobId, `section_${config.name}`, config.basePercentage, config.step);
      
      const sectionData = await this.stepProcessor.processSection(
        config.name,
        brief,
        sources,
        {}
      );
      
      sections[config.name] = sectionData;
      
      await this.saveArtifact(
        jobId,
        `section_${config.name}`,
        'section',
        sectionData,
        sectionData.section_hash || this.stepProcessor.generateHash(JSON.stringify(sectionData))
      );
      
      await this.updateProgress(jobId, `section_${config.name}_complete`, config.basePercentage + 5, config.step);
      
    } catch (error) {
      console.error(`❌ Failed to process section ${config.name}:`, error);
      // Create assumption-based fallback
      sections[config.name] = {
        error: true,
        assumptions: true,
        message: `Section generated with assumptions due to processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content: await this.generateAssumptionBasedSection(config.name, brief)
      };
    }
  }
  
  private async generateAssumptionBasedSection(sectionName: string, brief: any) {
    // Fallback content generation based on assumptions
    return {
      title: `${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} (Assumptions)`,
      content: `This section was generated based on assumptions from the brief due to processing limitations.`,
      assumptions: [`Content for ${sectionName} section needs manual review`],
      generated_at: new Date().toISOString(),
    };
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
