import path from "node:path";
import { writeJsonFile, readJsonFile, createHash } from "../utils/hash.js";

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
    const hashInput = {
      stepId,
      inputs,
      promptVersion: promptVersion || "1.0",
    };
    return `step_${stepId}_${createHash(hashInput)}`;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // For now, simple implementation - in production, you'd scan cache directory
    console.log(`TODO: Invalidate cache pattern: ${pattern}`);
  }
}
