import fs from "fs/promises";
import path from "path";
import { writeJsonFile } from "../v2/utils/hash.js";

export interface ArtifactEntry {
  name: string;
  type: "json" | "text" | "prompt";
  path: string;
  hash: string;
  timestamp: string;
  size: number;
  step: string;
  phase?: string;
}

export interface ArtifactIndex {
  job_id: string;
  created_at: string;
  last_updated: string;
  artifacts: Record<string, ArtifactEntry>;
}

export class ArtifactManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "artifacts");
  }

  /**
   * Get the job-specific artifact directory
   */
  private getJobDir(jobId: string): string {
    return path.join(this.baseDir, jobId);
  }

  /**
   * Get the step-specific directory within a job
   */
  private getStepDir(jobId: string, step: string): string {
    return path.join(this.getJobDir(jobId), step);
  }

  /**
   * Generate artifact file path based on step and phase
   */
  private getArtifactPath(
    jobId: string,
    step: string,
    phase?: string,
    extension: string = "json",
  ): string {
    const stepDir = this.getStepDir(jobId, step);

    if (phase) {
      return path.join(stepDir, `phase${phase}.${extension}`);
    } else {
      return path.join(stepDir, `result.${extension}`);
    }
  }

  /**
   * Initialize artifact directory structure for a job
   */
  async initializeJobArtifacts(jobId: string): Promise<void> {
    const jobDir = this.getJobDir(jobId);

    // Create base job directory
    await fs.mkdir(jobDir, { recursive: true });

    // Create index file
    const index: ArtifactIndex = {
      job_id: jobId,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      artifacts: {},
    };

    const indexPath = path.join(jobDir, "index.json");
    await writeJsonFile(indexPath, index);

    console.log(`📁 Initialized artifact directory: ${jobDir}`);
  }

  /**
   * Store an artifact for a specific step/phase
   */
  async storeArtifact(
    jobId: string,
    step: string,
    data: any,
    options: {
      phase?: string;
      type?: "json" | "text" | "prompt";
      metadata?: Record<string, any>;
    } = {},
  ): Promise<ArtifactEntry> {
    const { phase, type = "json", metadata = {} } = options;

    // Ensure step directory exists
    const stepDir = this.getStepDir(jobId, step);
    await fs.mkdir(stepDir, { recursive: true });

    // Determine file path and extension
    const extension = type === "json" ? "json" : "txt";
    const filePath = this.getArtifactPath(jobId, step, phase, extension);

    // Write the artifact
    if (type === "json") {
      await writeJsonFile(filePath, data);
    } else {
      await fs.writeFile(filePath, String(data), "utf-8");
    }

    // Get file stats
    const stats = await fs.stat(filePath);

    // Create artifact entry
    const artifactEntry: ArtifactEntry = {
      name: phase ? `${step}_phase${phase}` : step,
      type,
      path: filePath,
      hash: this.generateHash(JSON.stringify(data)),
      timestamp: new Date().toISOString(),
      size: stats.size,
      step,
      phase,
    };

    // Update index
    await this.updateIndex(jobId, artifactEntry);

    console.log(`💾 Stored artifact: ${artifactEntry.name} → ${filePath}`);

    return artifactEntry;
  }

  /**
   * Store prompt file for a step
   */
  async storePromptFile(
    jobId: string,
    step: string,
    promptContent: string,
    phase?: string,
  ): Promise<ArtifactEntry> {
    const stepDir = this.getStepDir(jobId, step);
    await fs.mkdir(stepDir, { recursive: true });

    const filename = phase ? `prompt_phase${phase}.txt` : "prompt.txt";
    const filePath = path.join(stepDir, filename);

    await fs.writeFile(filePath, promptContent, "utf-8");

    const stats = await fs.stat(filePath);

    const artifactEntry: ArtifactEntry = {
      name: phase ? `${step}_prompt_phase${phase}` : `${step}_prompt`,
      type: "prompt",
      path: filePath,
      hash: this.generateHash(promptContent),
      timestamp: new Date().toISOString(),
      size: stats.size,
      step,
      phase,
    };

    await this.updateIndex(jobId, artifactEntry);

    console.log(`📝 Stored prompt: ${artifactEntry.name} → ${filePath}`);

    return artifactEntry;
  }

  /**
   * Get artifact by name
   */
  async getArtifact(jobId: string, artifactName: string): Promise<any | null> {
    const index = await this.loadIndex(jobId);
    const artifact = index?.artifacts[artifactName];

    if (!artifact) {
      return null;
    }

    try {
      if (artifact.type === "json") {
        const content = await fs.readFile(artifact.path, "utf-8");
        return JSON.parse(content);
      } else {
        return await fs.readFile(artifact.path, "utf-8");
      }
    } catch (error) {
      console.error(`Failed to read artifact ${artifactName}:`, error);
      return null;
    }
  }

  /**
   * List all artifacts for a job
   */
  async listArtifacts(
    jobId: string,
  ): Promise<Record<string, ArtifactEntry> | null> {
    const index = await this.loadIndex(jobId);
    return index?.artifacts || null;
  }

  /**
   * Check if artifact exists and is written
   */
  async hasArtifact(
    jobId: string,
    step: string,
    phase?: string,
  ): Promise<boolean> {
    const artifactName = phase ? `${step}_phase${phase}` : step;
    const index = await this.loadIndex(jobId);

    if (!index?.artifacts[artifactName]) {
      return false;
    }

    // Verify file actually exists
    try {
      await fs.access(index.artifacts[artifactName].path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get artifact paths for frontend links (only if written)
   */
  async getArtifactLinks(jobId: string): Promise<Record<string, string>> {
    const links: Record<string, string> = {};
    const artifacts = await this.listArtifacts(jobId);

    if (!artifacts) {
      return links;
    }

    for (const [name, artifact] of Object.entries(artifacts)) {
      // Only include if file actually exists
      if (await this.hasArtifact(jobId, artifact.step, artifact.phase)) {
        links[name] = `/api/jobs/${jobId}/artifacts/${name}`;
      }
    }

    return links;
  }

  /**
   * Clean up artifacts older than specified days
   */
  async cleanupOldArtifacts(maxAgeInDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

    try {
      const jobDirs = await fs.readdir(this.baseDir);

      for (const jobDir of jobDirs) {
        const jobPath = path.join(this.baseDir, jobDir);
        const stats = await fs.stat(jobPath);

        if (stats.isDirectory() && stats.mtime < cutoffDate) {
          console.log(`🧹 Cleaning up old artifacts: ${jobDir}`);
          await fs.rm(jobPath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      console.warn("Failed to clean up old artifacts:", error);
    }
  }

  /**
   * Update the artifact index
   */
  private async updateIndex(
    jobId: string,
    artifactEntry: ArtifactEntry,
  ): Promise<void> {
    const indexPath = path.join(this.getJobDir(jobId), "index.json");

    let index: ArtifactIndex;
    try {
      const content = await fs.readFile(indexPath, "utf-8");
      index = JSON.parse(content);
    } catch {
      // Create new index if doesn't exist
      index = {
        job_id: jobId,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        artifacts: {},
      };
    }

    index.artifacts[artifactEntry.name] = artifactEntry;
    index.last_updated = new Date().toISOString();

    await writeJsonFile(indexPath, index);
  }

  /**
   * Load artifact index
   */
  private async loadIndex(jobId: string): Promise<ArtifactIndex | null> {
    const indexPath = path.join(this.getJobDir(jobId), "index.json");

    try {
      const content = await fs.readFile(indexPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Generate hash for artifact content
   */
  private generateHash(content: string): string {
    const crypto = require("crypto");
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 16);
  }
}

// Export singleton instance
export const artifactManager = new ArtifactManager();
