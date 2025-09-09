import path from "path";
import fs from "fs/promises";
import { writeJsonFile, readJsonFile, createHash } from "../utils/hash.js";
import crypto from "crypto";

export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir = "cache") {
    this.cacheDir = path.resolve(cacheDir);
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      return await readJsonFile<T>(this.getCacheFilePath(key));
    } catch (error) {
      console.warn(`Cache miss for key: ${key}`, error);
      return null;
    }
  }

  async set(key: string, data: any, metadata?: any): Promise<void> {
    const cacheEntry = {
      data,
      metadata: {
        cached_at: new Date().toISOString(),
        ...metadata,
      },
    };

    try {
      await writeJsonFile(this.getCacheFilePath(key), cacheEntry);
    } catch (error) {
      console.error(`Failed to cache key: ${key}`, error);
    }
  }

  async has(key: string): Promise<boolean> {
    const cached = await this.get(key);
    return cached !== null;
  }

  async createStepCacheKey(
    stepId: string,
    inputs: Record<string, any>,
    promptVersion?: string,
  ): Promise<string> {
    // Include environment flags in cache key to separate dry-run from real results
    const hashInput = {
      stepId,
      inputs,
      promptVersion: promptVersion || "1.0",
      envFlags: {
        LLM_DRY_RUN: process.env.LLM_DRY_RUN || "false",
        USE_ASSUMPTIONS_LLM: process.env.USE_ASSUMPTIONS_LLM || "false",
      },
    };
    return `step_${stepId}_${createHash(hashInput)}`;
  }

  async clearAllStepCaches(): Promise<void> {
    try {
      const cacheFiles = await fs.readdir(this.cacheDir);
      const stepCacheFiles = cacheFiles.filter(file => file.startsWith('step_') && file.endsWith('.json'));
      
      for (const file of stepCacheFiles) {
        await fs.unlink(path.join(this.cacheDir, file));
      }
      
      console.log(`🗑️  Cleared ${stepCacheFiles.length} step cache files`);
    } catch (error) {
      console.warn('Failed to clear step caches:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // For now, simple implementation - in production, you'd scan cache directory
    console.log(`TODO: Invalidate cache pattern: ${pattern}`);
  }

  // Hash generation methods per specification
  createPitchHash(pitchText: string): string {
    return crypto.createHash("sha256").update(pitchText.trim()).digest("hex");
  }

  generatePitchHash(input: {
    project_title: string;
    elevator_pitch: string;
    [key: string]: any;
  }): string {
    const hashInput = `${input.project_title}::${input.elevator_pitch}`;
    return this.createPitchHash(hashInput);
  }

  createSourcesHash(sources: any[]): string {
    // Canonicalize sources for consistent hashing
    const sortedSources = sources
      .map((source) => ({
        title: source.title,
        publisher: source.publisher,
        year: source.year,
      }))
      .sort((a, b) =>
        `${a.title}_${a.publisher}`.localeCompare(`${b.title}_${b.publisher}`),
      );
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(sortedSources))
      .digest("hex");
  }

  createBriefHash(brief: any): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(brief))
      .digest("hex")
      .substring(0, 16);
  }

  createSectionKey(
    sectionName: string,
    briefHash: string,
    sourcesHash: string,
    promptVersion = "1.0",
  ): string {
    const keyData = `${sectionName}_${briefHash}_${sourcesHash}_${promptVersion}`;
    return `sec_${crypto.createHash("sha256").update(keyData).digest("hex").substring(0, 12)}`;
  }

  createValidatedHash(
    allSectionHashes: Record<string, string>,
    validatorVersion = "1.0",
  ): string {
    const sortedHashes = Object.keys(allSectionHashes)
      .sort()
      .map((key) => `${key}:${allSectionHashes[key]}`)
      .join("|");
    const hashInput = `${sortedHashes}_validator_${validatorVersion}`;
    return `validated_${crypto.createHash("sha256").update(hashInput).digest("hex").substring(0, 12)}`;
  }

  createScoreKey(
    validatedSectionHashes: Record<string, string>,
    scoringPromptVersion = "1.0",
  ): string {
    const sortedHashes = Object.keys(validatedSectionHashes)
      .sort()
      .map((key) => `${key}:${validatedSectionHashes[key]}`)
      .join("|");
    const keyInput = `${sortedHashes}_scoring_${scoringPromptVersion}`;
    return `score_${crypto.createHash("sha256").update(keyInput).digest("hex").substring(0, 12)}`;
  }

  // Browser storage integration points (for future frontend implementation)
  createBrowserStorageKeys(pitchHash: string, sourcesHash?: string) {
    return {
      input: `vd.input.v1.${pitchHash.substring(0, 8)}`,
      brief: `vd.brief.v1.${pitchHash.substring(0, 8)}${sourcesHash ? `.${sourcesHash.substring(0, 8)}` : ""}`,
      sections: `vd.sections.v1.${pitchHash.substring(0, 8)}`,
      dossier: `vd.dossier.v1.${pitchHash.substring(0, 8)}`,
    };
  }

  // Checkpointing support for resume functionality
  async saveCheckpoint(pipelineId: string, checkpointData: any): Promise<void> {
    const checkpointKey = `checkpoint_${pipelineId}`;
    await this.set(checkpointKey, {
      pipeline_id: pipelineId,
      ...checkpointData,
      saved_at: new Date().toISOString(),
      resumable: true,
    });
    console.log(`💾 Checkpoint saved for pipeline ${pipelineId}`);
  }

  async loadCheckpoint(pipelineId: string): Promise<any> {
    try {
      const checkpointKey = `checkpoint_${pipelineId}`;
      const checkpoint = await this.get(checkpointKey);
      return checkpoint;
    } catch (error) {
      console.warn(
        `Failed to load checkpoint for pipeline ${pipelineId}:`,
        error,
      );
      return null;
    }
  }

  async deleteCheckpoint(pipelineId: string): Promise<void> {
    try {
      const checkpointKey = `checkpoint_${pipelineId}`;
      const checkpointPath = this.getCacheFilePath(checkpointKey);
      await fs.unlink(checkpointPath);
      console.log(`🗑️  Deleted checkpoint for pipeline ${pipelineId}`);
    } catch (error) {
      // It's okay if checkpoint doesn't exist
      console.log(`No checkpoint to delete for pipeline ${pipelineId}`);
    }
  }

  async clearPipelineCheckpoints(pipelineId: string): Promise<void> {
    await this.deleteCheckpoint(pipelineId);
  }
}
