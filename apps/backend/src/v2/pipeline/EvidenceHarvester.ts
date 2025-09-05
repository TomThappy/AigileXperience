import { chatComplete } from "../../lib/llm.js";
import { writeJsonFile, readJsonFile } from "../utils/hash.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface SourceData {
  title: string;
  publisher: string;
  year: number;
  region: string;
  url: string;
  method: string;
  key_findings: string[];
  usage_note: string;
  access: "free" | "paywalled";
  reliability_score: number;
  last_accessed: string;
}

export interface EvidenceResult {
  region: string;
  topics: string[];
  sources: SourceData[];
  topic_coverage: Record<
    string,
    {
      sources_found: number;
      reliability_avg: number;
      assumptions_needed: string[];
    }
  >;
  meta: {
    total_sources: number;
    coverage_percentage: number;
    generated_at: string;
  };
}

export class EvidenceHarvester {
  private cacheDir: string;
  private maxRetries = 3;
  private maxConcurrentRequests = 2; // Per specification

  constructor(cacheDir = "cache/sources") {
    this.cacheDir = path.resolve(process.cwd(), cacheDir);
  }

  async harvestEvidence(
    pitch: any,
    region = "EU/DE",
    customTopics?: string[],
  ): Promise<EvidenceResult> {
    const standardTopics = [
      "TAM",
      "ARPU",
      "CAC",
      "Churn",
      "Competitors",
      "Digital mediation efficacy",
      "Data privacy/regulatory",
    ];

    const topics = customTopics || standardTopics;
    console.log(
      `🔍 Starting evidence harvesting for ${topics.length} topics in ${region}`,
    );

    // Process topics in batches with limited concurrency
    const results: Array<{
      topic: string;
      sources: SourceData[];
      assumptions: string[];
    }> = [];

    for (let i = 0; i < topics.length; i += this.maxConcurrentRequests) {
      const batch = topics.slice(i, i + this.maxConcurrentRequests);
      console.log(`📋 Processing topic batch: ${batch.join(", ")}`);

      const batchPromises = batch.map((topic) =>
        this.processTopicWithRetry(topic, pitch, region),
      );
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);
    }

    // Combine all sources and build coverage stats
    const allSources: SourceData[] = [];
    const topicCoverage: Record<string, any> = {};

    for (const result of results) {
      allSources.push(...result.sources);
      topicCoverage[result.topic] = {
        sources_found: result.sources.length,
        reliability_avg:
          result.sources.length > 0
            ? result.sources.reduce((sum, s) => sum + s.reliability_score, 0) /
              result.sources.length
            : 0,
        assumptions_needed: result.assumptions,
      };
    }

    // Deduplicate sources by title+publisher
    const uniqueSources = this.deduplicateSources(allSources);

    const evidenceResult: EvidenceResult = {
      region,
      topics,
      sources: uniqueSources,
      topic_coverage: topicCoverage,
      meta: {
        total_sources: uniqueSources.length,
        coverage_percentage: Math.round(
          (uniqueSources.length / (topics.length * 2)) * 100,
        ), // Target ~2 sources per topic
        generated_at: new Date().toISOString(),
      },
    };

    // Cache the complete result
    await this.cacheEvidenceResult(evidenceResult);

    console.log(
      `✅ Evidence harvesting completed: ${uniqueSources.length} sources, ${evidenceResult.meta.coverage_percentage}% coverage`,
    );
    return evidenceResult;
  }

  private async processTopicWithRetry(
    topic: string,
    pitch: any,
    region: string,
  ): Promise<{ topic: string; sources: SourceData[]; assumptions: string[] }> {
    // Check cache first
    const cachedResult = await this.getCachedTopicResult(topic, region);
    if (cachedResult) {
      console.log(`🎯 Cache hit for topic: ${topic}`);
      return cachedResult;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Processing topic "${topic}" (attempt ${attempt}/${this.maxRetries})`,
        );

        const result = await this.processSingleTopic(topic, pitch, region);

        // Cache successful result
        await this.cacheTopicResult(topic, region, result);

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(
            `⚠️  Topic "${topic}" failed (attempt ${attempt}), retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - create assumption-based fallback
    console.log(
      `❌ Topic "${topic}" failed after ${this.maxRetries} attempts, creating assumption`,
    );

    const fallbackResult = {
      topic,
      sources: [],
      assumptions: [
        `No reliable sources found for "${topic}" in ${region} after ${this.maxRetries} attempts`,
        `TODO: Manual research needed for ${topic} baseline data`,
        `Error: ${lastError?.message || "Unknown error"}`,
      ],
    };

    // Cache the fallback too
    await this.cacheTopicResult(topic, region, fallbackResult);
    return fallbackResult;
  }

  private async processSingleTopic(
    topic: string,
    pitch: any,
    region: string,
  ): Promise<{ topic: string; sources: SourceData[]; assumptions: string[] }> {
    const prompt = `# Evidence Search for Topic: ${topic}

## PITCH CONTEXT
${JSON.stringify(pitch, null, 2)}

## TARGET REGION
${region}

## TASK
Find 1-3 high-quality sources specifically for "${topic}" related to this business idea.
Focus on: Statistikämter, OECD/WHO/EU, peer-reviewed studies, serious market reports.

## OUTPUT FORMAT (JSON)
{
  "topic": "${topic}",
  "sources": [
    {
      "title": "specific study/report title",
      "publisher": "Eurostat / Destatis / OECD / etc.",
      "year": 2024,
      "region": "${region}",
      "url": "https://...",
      "method": "official statistics / survey / meta-analysis",
      "key_findings": ["relevant finding 1", "relevant finding 2"],
      "usage_note": "How this applies to ${topic} for this business",
      "access": "free",
      "reliability_score": 0.9,
      "last_accessed": "${new Date().toISOString().split("T")[0]}"
    }
  ],
  "assumptions": ["Any assumptions if no sources found"]
}

Return ONLY valid JSON.`;

    const response = await chatComplete(prompt, {
      model: "gpt-4",
      temperature: 0.1,
    });

    // Clean and parse JSON response
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, "");
    }
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.replace(/^```\s*/, "");
    }
    if (cleanResponse.endsWith("```")) {
      cleanResponse = cleanResponse.replace(/\s*```$/, "");
    }

    const parsedResult = JSON.parse(cleanResponse.trim());

    if (!parsedResult.topic || !Array.isArray(parsedResult.sources)) {
      throw new Error(`Invalid response format for topic: ${topic}`);
    }

    return {
      topic: parsedResult.topic,
      sources: parsedResult.sources || [],
      assumptions: parsedResult.assumptions || [],
    };
  }

  private deduplicateSources(sources: SourceData[]): SourceData[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = `${source.title}_${source.publisher}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async getCachedTopicResult(
    topic: string,
    region: string,
  ): Promise<any> {
    try {
      const cacheFile = path.join(
        this.cacheDir,
        topic,
        `${region.replace("/", "-")}.json`,
      );
      const cached = await readJsonFile(cacheFile);

      // Check if cache is still valid (less than 7 days old)
      if (cached?.cached_at) {
        const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (cacheAge < sevenDays) {
          return cached.data;
        }
      }
    } catch (error) {
      // Cache miss or invalid cache
    }
    return null;
  }

  private async cacheTopicResult(
    topic: string,
    region: string,
    result: any,
  ): Promise<void> {
    try {
      const topicDir = path.join(this.cacheDir, topic);
      await fs.mkdir(topicDir, { recursive: true });

      const cacheFile = path.join(topicDir, `${region.replace("/", "-")}.json`);
      await writeJsonFile(cacheFile, {
        data: result,
        cached_at: new Date().toISOString(),
        region,
        topic,
      });

      console.log(`💾 Cached topic result: ${topic} -> ${cacheFile}`);
    } catch (error) {
      console.warn(`⚠️  Failed to cache topic result for ${topic}:`, error);
    }
  }

  private async cacheEvidenceResult(result: EvidenceResult): Promise<void> {
    try {
      // Create sources hash for incremental rebuilds
      const sourcesContent = JSON.stringify(
        result.sources.sort((a, b) => a.title.localeCompare(b.title)),
      );
      const sourcesHash = crypto
        .createHash("sha256")
        .update(sourcesContent)
        .digest("hex");

      const cacheFile = path.join(
        this.cacheDir,
        `evidence_${result.region.replace("/", "-")}_${sourcesHash.substring(0, 8)}.json`,
      );
      await writeJsonFile(cacheFile, {
        ...result,
        sources_hash: sourcesHash,
      });

      console.log(
        `💾 Cached complete evidence result with hash: ${sourcesHash.substring(0, 8)}`,
      );
    } catch (error) {
      console.warn(`⚠️  Failed to cache evidence result:`, error);
    }
  }
}
