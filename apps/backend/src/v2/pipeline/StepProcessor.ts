import { chatComplete } from "../../lib/llm.js";
import { CacheManager } from "../cache/CacheManager.js";
import { writeJsonFile, readJsonFile } from "../utils/hash.js";
import {
  pickSourcesFor,
  estimateTokenSavings,
} from "../../lib/source-filter.js";
import type { StepResult, PipelineStep } from "../types.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { EvidenceHarvester } from "./EvidenceHarvester.js";
import { NumberValidator } from "./NumberValidator.js";
import { traceSystem } from "../../lib/trace-system.js";

export class StepProcessor {
  private cache: CacheManager;
  private promptsDir: string;
  private evidenceHarvester: EvidenceHarvester;
  private numberValidator: NumberValidator;

  constructor(cache: CacheManager, promptsDir?: string) {
    this.cache = cache;
    // Use absolute path resolution for better compatibility
    this.promptsDir =
      promptsDir || path.resolve(process.cwd(), "src/v2/prompts");
    this.evidenceHarvester = new EvidenceHarvester();
    this.numberValidator = new NumberValidator();
  }

  /**
   * Execute function with timeout and retry logic
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    stepName: string,
    maxRetries: number = 2,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`LLM call timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          }),
        ]);

        if (attempt > 1) {
          console.log(`✅ [${stepName}] Succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error: any) {
        const isTimeout =
          error instanceof Error && error.message.includes("timed out");
        const isRateLimit =
          error?.status === 429 || error?.code === "rate_limit_exceeded";

        console.warn(`⚠️ [${stepName}] Attempt ${attempt} failed:`, {
          isTimeout,
          isRateLimit,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt <= maxRetries && (isTimeout || isRateLimit)) {
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`🔄 [${stepName}] Retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw error;
      }
    }

    throw new Error(`All retry attempts failed for ${stepName}`);
  }

  async executeStep(
    step: PipelineStep,
    inputs: Record<string, any>,
    options: {
      skipCache?: boolean;
      forceRebuild?: boolean;
      nonce?: string;
      jobId?: string;
    } = {},
  ): Promise<StepResult> {
    const { skipCache = false, forceRebuild = false, nonce, jobId } = options;
    const startTime = Date.now();

    console.log(`📋 Executing step: ${step.name}`);

    // Apply cache busting if requested
    const effectiveSkipCache = skipCache || forceRebuild;
    const cacheInputs = nonce ? { ...inputs, __cache_nonce: nonce } : inputs;

    if (forceRebuild && nonce) {
      console.log(`🔄 Cache bust requested with nonce: ${nonce.substring(0, 8)}...`);
    }

    // Check cache first
    if (!effectiveSkipCache) {
      const cacheKey = await this.cache.createStepCacheKey(step.id, cacheInputs);
      const cached = await this.cache.get(cacheKey);

      if (cached?.data) {
        console.log(`🎯 Cache hit for step: ${step.name}`);
        console.log(`🎯 [STEP] ${step.id}: cache_used=true`);
        return {
          success: true,
          data: cached.data,
          duration_ms: Date.now() - startTime,
          cache_hit: true,
          hash: cacheKey,
        };
      } else {
        console.log(`❌ Cache miss for step: ${step.name} (cache_used=false)`);
      }
    } else {
      const reason = forceRebuild ? 'forceRebuild=true' : 'skipCache=true';
      console.log(
        `⏭️  Cache bypassed for step: ${step.name} (${reason}, cache_used=false)`,
      );
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

    // Check if this is a large step that needs phase-splitting
    const largeTLMSteps = ["financial_plan", "market", "gtm"];
    if (largeTLMSteps.includes(step.id)) {
      return await this.executePhaseSplitStep(step, inputs);
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

    // Special processing per step
    if (step.id === "evidence") {
      // Use advanced Evidence Harvester with topic parallelization and retry
      const region = inputs.geo || "EU/DE";
      console.log(`🔬 Using advanced Evidence Harvester for region: ${region}`);

      return await this.evidenceHarvester.harvestEvidence(inputs.pitch, region);
    }

    if (inputs.brief) {
      prompt += `\\n\\n## BRIEF DATA\\n${JSON.stringify(inputs.brief, null, 2)}`;
    }
    if (inputs.sources) {
      // Filter sources for this specific step to reduce token load
      const filteredSources = pickSourcesFor(step.id, inputs.sources, 8);
      const tokenSavings = estimateTokenSavings(
        inputs.sources.sources || [],
        filteredSources.sources || [],
      );

      console.log(`🎯 Source filtering for ${step.id}:`, {
        original: inputs.sources.sources?.length || 0,
        filtered: filteredSources.sources?.length || 0,
        tokenSavings: tokenSavings.savings,
        percentage: Math.round(
          (tokenSavings.savings / tokenSavings.originalTokens) * 100,
        ),
      });

      prompt += `\\n\\n## SOURCES DATA (filtered for ${step.id})\\n${JSON.stringify(filteredSources, null, 2)}`;
    }

    prompt += `\\n\\n## IMPORTANT\\nReturn ONLY valid JSON matching the expected output schema. No additional text or explanations.`;

    const model = this.getModelForStep(step.id, step.model_preference);
    console.log(
      `🤖 [STEP] ${step.id}: Using model ${model} (from ${this.getModelSource(step.id, step.model_preference)})`,
    );
    const response = await this.executeWithTimeout(
      () => chatComplete(prompt, { model, temperature: 0.1 }),
      60000, // 60 second timeout per call for complex steps
      `${step.id}-step`,
    );

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

  private async executePhaseSplitStep(
    step: PipelineStep,
    inputs: Record<string, any>,
  ): Promise<any> {
    console.log(`🔀 Executing phase-split step: ${step.name}`);

    // Phase 1: Generate data/structure
    const phase1Result = await this.executePhase(
      step,
      inputs,
      "data",
      `${step.prompt_file}_phase1.txt`,
    );

    // Phase 2: Generate narrative/text using phase 1 data
    const phase2Inputs = {
      ...inputs,
      phase1_data: phase1Result,
    };

    const phase2Result = await this.executePhase(
      step,
      phase2Inputs,
      "narrative",
      `${step.prompt_file}_phase2.txt`,
    );

    // Merge results - phase 2 should contain narrative text with phase 1 data
    return {
      ...phase1Result,
      ...phase2Result,
      _meta: {
        phase_split: true,
        phase1_tokens: this.estimateTokens(JSON.stringify(phase1Result)),
        phase2_tokens: this.estimateTokens(JSON.stringify(phase2Result)),
      },
    };
  }

  private async executePhase(
    step: PipelineStep,
    inputs: Record<string, any>,
    phaseName: string,
    promptFileName: string,
  ): Promise<any> {
    const promptPath = path.join(this.promptsDir, promptFileName);
    console.log(
      `📋 Phase ${phaseName}: Looking for prompt file: ${promptPath}`,
    );

    let promptTemplate: string;
    try {
      promptTemplate = await fs.readFile(promptPath, "utf-8");
      console.log(
        `✅ Phase ${phaseName} prompt loaded: ${promptFileName} (${promptTemplate.length} chars)`,
      );
    } catch (error) {
      // Fallback to single-phase execution if phase files don't exist
      console.warn(
        `⚠️  Phase file not found: ${promptPath}, falling back to single-phase`,
      );
      return await this.executeSinglePhaseStep(step, inputs);
    }

    // Replace placeholders in prompt
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `<<${key.toUpperCase()}>>`;
      const replacementValue =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      prompt = prompt.replace(new RegExp(placeholder, "g"), replacementValue);
    }

    if (inputs.brief) {
      prompt += `\\n\\n## BRIEF DATA\\n${JSON.stringify(inputs.brief, null, 2)}`;
    }
    if (inputs.sources) {
      // Filter sources for this specific step to reduce token load
      const filteredSources = pickSourcesFor(step.id, inputs.sources, 8);
      const tokenSavings = estimateTokenSavings(
        inputs.sources.sources || [],
        filteredSources.sources || [],
      );

      console.log(`🎯 Source filtering for ${step.id} (${phaseName}):`, {
        original: inputs.sources.sources?.length || 0,
        filtered: filteredSources.sources?.length || 0,
        tokenSavings: tokenSavings.savings,
        percentage: Math.round(
          (tokenSavings.savings / tokenSavings.originalTokens) * 100,
        ),
      });

      prompt += `\\n\\n## SOURCES DATA (filtered for ${step.id})\\n${JSON.stringify(filteredSources, null, 2)}`;
    }

    prompt += `\\n\\n## IMPORTANT\\nReturn ONLY valid JSON matching the expected output schema. No additional text or explanations.`;

    const model = this.getModelForStep(
      step.id,
      step.model_preference,
      phaseName,
    );
    console.log(
      `🤖 [STEP] ${step.id} (${phaseName}): Using model ${model} (from ${this.getModelSource(step.id, step.model_preference, phaseName)})`,
    );
    const response = await this.executeWithTimeout(
      () => chatComplete(prompt, { model, temperature: 0.1 }),
      60000, // 60 second timeout per call for complex phases
      `${step.id}-${phaseName}`,
    );

    // Parse JSON response
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
        `Failed to parse ${phaseName} phase response as JSON:`,
        response.substring(0, 500),
      );
      throw new Error(
        `Phase ${phaseName} response is not valid JSON: ${parseError}`,
      );
    }
  }

  private async executeSinglePhaseStep(
    step: PipelineStep,
    inputs: Record<string, any>,
  ): Promise<any> {
    // Original single-phase execution logic
    const promptPath = path.join(this.promptsDir, step.prompt_file!);
    console.log(`🔍 Single-phase: Looking for prompt file: ${promptPath}`);
    let promptTemplate: string;

    try {
      promptTemplate = await fs.readFile(promptPath, "utf-8");
      console.log(
        `✅ Single-phase prompt loaded: ${step.prompt_file} (${promptTemplate.length} chars)`,
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

    if (inputs.brief) {
      prompt += `\\n\\n## BRIEF DATA\\n${JSON.stringify(inputs.brief, null, 2)}`;
    }
    if (inputs.sources) {
      // Filter sources for this specific step to reduce token load
      const filteredSources = pickSourcesFor(step.id, inputs.sources, 8);
      const tokenSavings = estimateTokenSavings(
        inputs.sources.sources || [],
        filteredSources.sources || [],
      );

      console.log(`🎯 Source filtering for ${step.id}:`, {
        original: inputs.sources.sources?.length || 0,
        filtered: filteredSources.sources?.length || 0,
        tokenSavings: tokenSavings.savings,
        percentage: Math.round(
          (tokenSavings.savings / tokenSavings.originalTokens) * 100,
        ),
      });

      prompt += `\\n\\n## SOURCES DATA (filtered for ${step.id})\\n${JSON.stringify(filteredSources, null, 2)}`;
    }

    prompt += `\\n\\n## IMPORTANT\\nReturn ONLY valid JSON matching the expected output schema. No additional text or explanations.`;

    const model = this.getModelForStep(step.id, step.model_preference);
    console.log(
      `🤖 [STEP] ${step.id}: Using model ${model} (from ${this.getModelSource(step.id, step.model_preference)})`,
    );
    const response = await this.executeWithTimeout(
      () => chatComplete(prompt, { model, temperature: 0.1 }),
      60000, // 60 second timeout per call for complex single-phase steps
      `${step.id}-single`,
    );

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

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private getModelForStep(
    stepId: string,
    defaultModel?: string,
    phaseName?: string,
  ): string {
    console.log(
      `🔍 [DEBUG] Model selection for ${stepId}${phaseName ? ` (${phaseName})` : ""}:`,
    );
    console.log(`🔍 - defaultModel: ${defaultModel || "none"}`);
    console.log(
      `🔍 - process.env.LLM_DEFAULT_MODEL: ${process.env.LLM_DEFAULT_MODEL || "NOT SET"}`,
    );

    // For phase-split steps, check phase-specific models first
    if (phaseName) {
      const phaseEnvVar = `LLM_MODEL_${stepId.toUpperCase()}_${phaseName.toUpperCase()}`;
      const phaseSpecificModel = process.env[phaseEnvVar];

      console.log(
        `🔍 - Checking phase env var ${phaseEnvVar}: ${phaseSpecificModel || "NOT SET"}`,
      );

      if (phaseSpecificModel) {
        console.log(
          `🔀 Found phase-specific model for ${stepId} (${phaseName}): ${phaseSpecificModel}`,
        );
        return phaseSpecificModel;
      }
    }

    // Check for step-specific environment variable
    const envVarName = `LLM_MODEL_${stepId.toUpperCase()}`;
    const stepSpecificModel = process.env[envVarName];

    console.log(
      `🔍 - Checking step env var ${envVarName}: ${stepSpecificModel || "NOT SET"}`,
    );

    if (stepSpecificModel) {
      console.log(
        `🎯 Found step-specific model for ${stepId}: ${stepSpecificModel}`,
      );
      return stepSpecificModel;
    }

    // Fallback to step preference, then global default
    const finalModel =
      defaultModel || process.env.LLM_DEFAULT_MODEL || "gpt-4o";
    console.log(
      `🔍 - Final model selection: ${finalModel} (${!defaultModel && !process.env.LLM_DEFAULT_MODEL ? "hardcoded fallback" : "from env/default"})`,
    );
    return finalModel;
  }

  private getModelSource(
    stepId: string,
    defaultModel?: string,
    phaseName?: string,
  ): string {
    // Check for phase-specific environment variable first (if applicable)
    if (phaseName) {
      const phaseEnvVar = `LLM_MODEL_${stepId.toUpperCase()}_${phaseName.toUpperCase()}`;
      if (process.env[phaseEnvVar]) {
        return `LLM_MODEL_${stepId.toUpperCase()}_${phaseName.toUpperCase()} env var`;
      }
    }

    // Check for step-specific environment variable
    const envVarName = `LLM_MODEL_${stepId.toUpperCase()}`;
    if (process.env[envVarName]) {
      return `LLM_MODEL_${stepId.toUpperCase()} env var`;
    }

    // Check step preference
    if (defaultModel) {
      return "step model_preference";
    }

    // Check global default
    if (process.env.LLM_DEFAULT_MODEL) {
      return "LLM_DEFAULT_MODEL env var";
    }

    return "hardcoded fallback (gpt-4o)";
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
    const sections = inputs.sections || {};

    // Enhanced chart collection from both section.data.charts and section.charts
    const chartMap = new Map<string, any>();
    
    for (const [secKey, secVal] of Object.entries<any>(sections)) {
      // Check both data.charts and direct charts property
      const dataCharts = secVal?.data?.charts;
      const directCharts = secVal?.charts;
      
      const allCharts = [
        ...(Array.isArray(dataCharts) ? dataCharts : []),
        ...(Array.isArray(directCharts) ? directCharts : []),
      ];
      
      for (const chart of allCharts) {
        if (chart && chart.id && !chartMap.has(chart.id)) {
          // Ensure chart has proper structure
          const normalizedChart = {
            id: chart.id,
            type: chart.type || "bar",
            title: chart.title || `${secKey} Chart`,
            x: Array.isArray(chart.x) ? chart.x : [],
            series: Array.isArray(chart.series) ? chart.series : [],
            ...chart,
          };
          chartMap.set(chart.id, normalizedChart);
        }
      }
    }

    const mergedCharts = Array.from(chartMap.values());

    // Generate Executive Summary if not present
    let executiveSummary = sections.executive_summary;
    if (!executiveSummary && Object.keys(sections).length > 2) {
      executiveSummary = this.generateExecutiveSummary(sections);
    }

    const finalSections = executiveSummary 
      ? { executive_summary: executiveSummary, ...sections }
      : sections;

    return {
      pitch: inputs.pitch,
      sources: inputs.sources || { sources: [] },
      brief: inputs.brief,
      sections: finalSections,
      investor_score: inputs.investor_score,
      charts: mergedCharts.length > 0 ? mergedCharts : undefined,
      meta: {
        version: "1.0",
        generated_at: new Date().toISOString(),
        total_duration_ms: inputs.total_duration_ms || 0,
      },
    };
  }

  /**
   * Generate executive summary from existing sections
   */
  private generateExecutiveSummary(sections: any): any {
    const parts = [];

    if (sections.problem?.narrative) {
      parts.push(sections.problem.narrative.split('.')[0] + '.');
    }

    if (sections.solution?.narrative) {
      parts.push(sections.solution.narrative.split('.')[0] + '.');
    }

    if (sections.market?.data?.tam) {
      parts.push(`The total addressable market is ${sections.market.data.tam}.`);
    }

    const narrative = parts.slice(0, 3).join(' ');
    
    return narrative ? {
      headline: "Executive Summary",
      narrative,
      bullets: [
        "Innovative approach to solving market problems",
        "Strong market opportunity with clear demand",
        "Scalable business model with growth potential"
      ]
    } : null;
  }

  private validateNumbers(inputs: Record<string, any>): any {
    console.log(
      `🔍 Running comprehensive number validation with advanced validator`,
    );

    const sections = inputs.sections || {};
    const validationResult = this.numberValidator.validateSections(sections);

    // Apply high-confidence auto-fixes
    let fixedSections = sections;
    if (validationResult.fixes.length > 0) {
      console.log(`🔧 Applying ${validationResult.fixes.length} auto-fixes`);
      fixedSections = this.numberValidator.applyAutoFixes(
        sections,
        validationResult.fixes,
      );
    }

    return {
      validation_passed: validationResult.validation_passed,
      issues: validationResult.issues,
      fixes: validationResult.fixes,
      warnings: validationResult.warnings,
      summary: validationResult.summary,
      fixed_sections: fixedSections,
      // Legacy format for compatibility
      suggestions: validationResult.issues
        .filter((i) => i.suggestion)
        .map((i) => i.suggestion)
        .filter(Boolean),
    };
  }

  private async persistStepResult(
    step: PipelineStep,
    result: any,
  ): Promise<void> {
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
          filePath = path.resolve(
            process.cwd(),
            "examples/output/sources.json",
          );
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
            financial_plan: "38_financial_plan",
          };
          filePath = path.resolve(
            process.cwd(),
            `examples/output/${sectionMap[step.id]}.json`,
          );
          break;
        case "validate":
          // Step 4: Save to examples/output/validated/
          await fs.mkdir(
            path.resolve(process.cwd(), "examples/output/validated"),
            { recursive: true },
          );
          filePath = path.resolve(
            process.cwd(),
            "examples/output/validated/validation.json",
          );
          break;
        case "investor_score":
          // Step 5: Save to examples/output/investor_score.json
          filePath = path.resolve(
            process.cwd(),
            "examples/output/investor_score.json",
          );
          break;
        case "assemble":
          // Step 6: Save with timestamp as per specification
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          filePath = path.resolve(
            process.cwd(),
            `examples/output/dossier_${timestamp}.json`,
          );
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
