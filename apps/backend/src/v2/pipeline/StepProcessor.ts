import { chatComplete } from "../../lib/llm.js";
import { CacheManager } from "../cache/CacheManager.js";
import { writeJsonFile, readJsonFile } from "../utils/hash.js";
import type { StepResult, PipelineStep } from "../types.js";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class StepProcessor {
  private cache: CacheManager;
  private promptsDir: string;

  constructor(cache: CacheManager, promptsDir?: string) {
    this.cache = cache;
    // Use absolute path resolution for better compatibility
    this.promptsDir =
      promptsDir || path.resolve(process.cwd(), "apps/backend/src/v2/prompts");
  }

  async executeStep(
    step: PipelineStep,
    inputs: Record<string, any>,
    skipCache = false,
  ): Promise<StepResult> {
    const startTime = Date.now();

    console.log(`📋 Executing step: ${step.name}`);

    // Check cache first
    if (!skipCache) {
      const cacheKey = await this.cache.createStepCacheKey(step.id, inputs);
      const cached = await this.cache.get(cacheKey);

      if (cached?.data) {
        console.log(`🎯 Cache hit for step: ${step.name}`);
        return {
          success: true,
          data: cached.data,
          duration_ms: Date.now() - startTime,
          cache_hit: true,
          hash: cacheKey,
        };
      }
    }

    try {
      let result: any;

      if (step.prompt_file) {
        // LLM-based step
        result = await this.executeLLMStep(step, inputs);
      } else {
        // Script-based step (like input processing)
        result = await this.executeScriptStep(step, inputs);
      }

      const duration = Date.now() - startTime;
      const cacheKey = await this.cache.createStepCacheKey(step.id, inputs);

      // Cache the result
      await this.cache.set(cacheKey, result, {
        step_id: step.id,
        duration_ms: duration,
      });

      // Persist to files as per specification
      await this.persistStepResult(step, result);

      console.log(`✅ Step completed: ${step.name} (${duration}ms)`);

      return {
        success: true,
        data: result,
        duration_ms: duration,
        cache_hit: false,
        hash: cacheKey,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Step failed: ${step.name}`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration,
        cache_hit: false,
        hash: "",
      };
    }
  }

  private async executeLLMStep(
    step: PipelineStep,
    inputs: Record<string, any>,
  ): Promise<any> {
    if (!step.prompt_file) {
      throw new Error(`No prompt file specified for step: ${step.id}`);
    }

    const promptPath = path.join(this.promptsDir, step.prompt_file);
    console.log(`🔍 Looking for prompt file: ${promptPath}`);
    let promptTemplate: string;

    try {
      promptTemplate = await fs.readFile(promptPath, "utf-8");
      console.log(
        `✅ Prompt file loaded: ${step.prompt_file} (${promptTemplate.length} chars)`,
      );
    } catch (error) {
      console.error(`❌ Failed to read prompt file: ${promptPath}`, error);
      throw new Error(`Failed to read prompt file: ${promptPath} - ${error}`);
    }

    // Replace placeholders in prompt
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `<<${key.toUpperCase()}>>`;
      const replacementValue =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      prompt = prompt.replace(new RegExp(placeholder, "g"), replacementValue);
    }

    // Add context data and special processing per step
    if (step.id === "evidence") {
      // Evidence Harvester: Add standard topics from specification
      const standardTopics = ["TAM", "ARPU", "CAC", "Churn", "Competitors", "Digital mediation efficacy", "Data privacy/regulatory"];
      const region = inputs.geo || "EU/DE";
      prompt = prompt.replace("<<TOPICS>>", JSON.stringify(standardTopics));
      prompt = prompt.replace("<<REGION>>", region);
    }
    
    if (inputs.brief) {
      prompt += `\\n\\n## BRIEF DATA\\n${JSON.stringify(inputs.brief, null, 2)}`;
    }
    if (inputs.sources) {
      prompt += `\\n\\n## SOURCES DATA\\n${JSON.stringify(inputs.sources, null, 2)}`;
    }

    prompt += `\\n\\n## IMPORTANT\\nReturn ONLY valid JSON matching the expected output schema. No additional text or explanations.`;

    const model = step.model_preference || "gpt-4o";
    const response = await chatComplete(prompt, { model, temperature: 0.1 });

    // Parse JSON response - clean markdown code blocks first
    try {
      let cleanResponse = response.trim();

      // Remove markdown code blocks if present
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, "");
      }
      if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse.replace(/^```\s*/, "");
      }
      if (cleanResponse.endsWith("```")) {
        cleanResponse = cleanResponse.replace(/\s*```$/, "");
      }

      return JSON.parse(cleanResponse.trim());
    } catch (parseError) {
      console.error(
        "Failed to parse LLM response as JSON:",
        response.substring(0, 500),
      );
      throw new Error(`LLM response is not valid JSON: ${parseError}`);
    }
  }

  private async executeScriptStep(
    step: PipelineStep,
    inputs: Record<string, any>,
  ): Promise<any> {
    // Handle different script-based steps
    switch (step.id) {
      case "input":
        return this.processInput(inputs);
      case "assemble":
        return this.assembleResults(inputs);
      case "validate":
        return this.validateNumbers(inputs);
      default:
        throw new Error(`Unknown script step: ${step.id}`);
    }
  }

  private processInput(inputs: Record<string, any>): any {
    const { project_title, elevator_pitch } = inputs;

    if (!project_title || !elevator_pitch) {
      throw new Error(
        "Missing required fields: project_title or elevator_pitch",
      );
    }

    // Generate pitch hash exactly as specified
    const pitch_hash = crypto
      .createHash("sha256")
      .update(elevator_pitch.trim())
      .digest("hex");

    return {
      meta: {
        version: "1.0",
        ts: new Date().toISOString(),
      },
      project_title,
      pitch_text: elevator_pitch,
      pitch_hash,
    };
  }

  private assembleResults(inputs: Record<string, any>): any {
    return {
      pitch: inputs.pitch,
      sources: inputs.sources || { sources: [] },
      brief: inputs.brief,
      sections: inputs.sections || {},
      investor_score: inputs.investor_score,
      meta: {
        version: "1.0",
        generated_at: new Date().toISOString(),
        total_duration_ms: inputs.total_duration_ms || 0,
      },
    };
  }

  private validateNumbers(inputs: Record<string, any>): any {
    // Simple validation - in production this would be more comprehensive
    const sections = inputs.sections || {};
    const issues: string[] = [];

    // Check business model consistency
    const bizModel = sections.business_model;
    if (bizModel?.data) {
      const { arpu, gross_margin, churn_monthly, CAC, CLV, payback_months } =
        bizModel.data;

      if (arpu && gross_margin && churn_monthly) {
        const expectedCLV = arpu * gross_margin * (1 / churn_monthly);
        if (CLV && Math.abs(CLV - expectedCLV) > expectedCLV * 0.1) {
          issues.push(
            `CLV inconsistency: expected ~${expectedCLV.toFixed(2)}, got ${CLV}`,
          );
        }
      }
    }

    return {
      validation_passed: issues.length === 0,
      issues,
      suggestions:
        issues.length > 0 ? ["Review unit economics calculations"] : [],
    };
  }

  private async persistStepResult(step: PipelineStep, result: any): Promise<void> {
    try {
      let filePath: string;
      
      // File persistence as per specification
      switch (step.id) {
        case "input":
          // Step 0: Save to examples/input/pitch.json
          filePath = path.resolve(process.cwd(), "examples/input/pitch.json");
          break;
        case "evidence":
          // Step 1: Save to examples/output/sources.json
          filePath = path.resolve(process.cwd(), "examples/output/sources.json");
          break;
        case "brief":
          // Step 2: Save to examples/output/brief.json
          filePath = path.resolve(process.cwd(), "examples/output/brief.json");
          break;
        case "problem":
        case "solution":
        case "team":
        case "market":
        case "business_model":
        case "competition":
        case "status_quo":
        case "gtm":
        case "financial_plan":
          // Step 3: Save each section separately
          const sectionMap: Record<string, string> = {
            problem: "30_problem",
            solution: "31_solution", 
            team: "32_team",
            market: "33_market",
            business_model: "34_business_model",
            competition: "35_competition",
            status_quo: "37_status_quo",
            gtm: "36_go_to_market", 
            financial_plan: "38_financial_plan"
          };
          filePath = path.resolve(process.cwd(), `examples/output/${sectionMap[step.id]}.json`);
          break;
        case "validate":
          // Step 4: Save to examples/output/validated/
          await fs.mkdir(path.resolve(process.cwd(), "examples/output/validated"), { recursive: true });
          filePath = path.resolve(process.cwd(), "examples/output/validated/validation.json");
          break;
        case "investor_score":
          // Step 5: Save to examples/output/investor_score.json
          filePath = path.resolve(process.cwd(), "examples/output/investor_score.json");
          break;
        case "assemble":
          // Step 6: Save with timestamp as per specification
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          filePath = path.resolve(process.cwd(), `examples/output/dossier_${timestamp}.json`);
          break;
        default:
          return; // Skip persistence for unknown steps
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write JSON file
      await writeJsonFile(filePath, result);
      
      console.log(`💾 Persisted ${step.id} result to: ${filePath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to persist ${step.id} result:`, error);
      // Don't fail the pipeline for persistence errors
    }
  }
}
