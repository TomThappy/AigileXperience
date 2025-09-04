import { CacheManager } from "../cache/CacheManager.js";
import { StepProcessor } from "./StepProcessor.js";
import { writeJsonFile } from "../utils/hash.js";
import type { PipelineStep, PipelineState, PitchInput, DossierData } from "../types.js";
import path from "node:path";

export class PipelineManager {
  private cache: CacheManager;
  private stepProcessor: StepProcessor;
  private outputDir: string;

  constructor(outputDir = "examples/output") {
    this.cache = new CacheManager();
    this.stepProcessor = new StepProcessor(this.cache);
    this.outputDir = outputDir;
  }

  private getPipelineDefinition(): PipelineStep[] {
    return [
      {
        id: "input",
        name: "Input Processing",
        dependencies: [],
        inputs: ["project_title", "elevator_pitch"],
        outputs: ["pitch"],
      },
      {
        id: "evidence",
        name: "Evidence Harvester",
        dependencies: ["input"],
        inputs: ["pitch"],
        outputs: ["sources"],
        prompt_file: "10_evidence_harvester.md",
        model_preference: "gpt-4o",
      },
      {
        id: "brief",
        name: "Brief Extraction", 
        dependencies: ["input"],
        inputs: ["pitch", "sources"],
        outputs: ["brief"],
        prompt_file: "20_extract_brief.md",
        model_preference: "claude-3.5-sonnet",
      },
      {
        id: "problem",
        name: "Problem Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.problem"],
        prompt_file: "30_problem.md",
        model_preference: "claude-3.5-sonnet",
      },
      {
        id: "solution",
        name: "Solution Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.solution"],
        prompt_file: "31_solution.md",
        model_preference: "claude-3.5-sonnet",
      },
      {
        id: "market",
        name: "Market Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.market"],
        prompt_file: "33_market.md",
        model_preference: "gpt-4o",
      },
      {
        id: "business_model",
        name: "Business Model Section",
        dependencies: ["brief", "evidence", "market"],
        inputs: ["brief", "sources", "sections.market"],
        outputs: ["sections.business_model"],
        prompt_file: "34_business_model.md", 
        model_preference: "gpt-4o",
      },
      {
        id: "validate",
        name: "Number Validation",
        dependencies: ["business_model"],
        inputs: ["sections"],
        outputs: ["validation"],
      },
      {
        id: "investor_score",
        name: "Investor Scoring",
        dependencies: ["problem", "solution", "market", "business_model"],
        inputs: ["sections", "brief"],
        outputs: ["investor_score"],
        prompt_file: "90_investor_scoring.md",
        model_preference: "gpt-4o",
      },
      {
        id: "assemble",
        name: "Final Assembly",
        dependencies: ["investor_score", "validate"],
        inputs: ["pitch", "sources", "brief", "sections", "investor_score", "validation"],
        outputs: ["dossier"],
      },
    ];
  }

  async executePipeline(
    input: PitchInput,
    options: {
      skipCache?: boolean;
      parallelLimit?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<{ success: boolean; data?: DossierData; error?: string; state: PipelineState }> {
    const { skipCache = false, parallelLimit = 3, timeoutMs = 300000 } = options;
    const startTime = Date.now();

    console.log("🚀 Starting pipeline execution for:", input.project_title);

    const steps = this.getPipelineDefinition();
    const state: PipelineState = {
      steps: {},
      artifacts: {},
      cache_hits: 0,
      total_duration_ms: 0,
    };

    // Initialize step states
    for (const step of steps) {
      state.steps[step.id] = { status: "pending" };
    }

    // Set initial inputs
    state.artifacts = {
      project_title: input.project_title,
      elevator_pitch: input.elevator_pitch,
      language: input.language || "de",
      target: input.target || "Pre-Seed/Seed VCs",
      geo: input.geo || "EU/DACH",
    };

    try {
      // Execute steps in dependency order with limited parallelism
      const completed = new Set<string>();
      
      while (completed.size < steps.length) {
        const readySteps = steps.filter(step => 
          !completed.has(step.id) && 
          state.steps[step.id].status === "pending" &&
          step.dependencies.every(dep => completed.has(dep))
        );

        if (readySteps.length === 0) {
          const remaining = steps.filter(step => !completed.has(step.id));
          throw new Error(`Dependency deadlock. Remaining steps: ${remaining.map(s => s.id).join(", ")}`);
        }

        // Execute up to parallelLimit steps concurrently
        const batch = readySteps.slice(0, parallelLimit);
        const promises = batch.map(async step => {
          state.steps[step.id].status = "running";
          state.steps[step.id].started_at = new Date().toISOString();

          // Prepare inputs for this step
          const stepInputs: Record<string, any> = {};
          for (const inputKey of step.inputs) {
            if (inputKey.includes(".")) {
              // Nested property like "sections.market"
              const [parent, child] = inputKey.split(".");
              stepInputs[inputKey] = state.artifacts[parent]?.[child];
            } else {
              stepInputs[inputKey] = state.artifacts[inputKey];
            }
          }

          const result = await this.stepProcessor.executeStep(step, stepInputs, skipCache);
          
          if (result.success) {
            state.steps[step.id].status = "completed";
            state.steps[step.id].duration_ms = result.duration_ms;
            state.steps[step.id].hash = result.hash;
            
            if (result.cache_hit) {
              state.cache_hits++;
            }

            // Store outputs
            for (const outputKey of step.outputs) {
              if (outputKey.includes(".")) {
                // Nested property like "sections.problem"
                const [parent, child] = outputKey.split(".");
                if (!state.artifacts[parent]) {
                  state.artifacts[parent] = {};
                }
                state.artifacts[parent][child] = result.data;
              } else {
                state.artifacts[outputKey] = result.data;
              }
            }
          } else {
            state.steps[step.id].status = "failed";
            state.steps[step.id].error = result.error;
            throw new Error(`Step ${step.id} failed: ${result.error}`);
          }

          state.steps[step.id].completed_at = new Date().toISOString();
          return step.id;
        });

        const completedBatch = await Promise.all(promises);
        completedBatch.forEach(stepId => completed.add(stepId));

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(`Pipeline timeout after ${timeoutMs}ms`);
        }
      }

      state.total_duration_ms = Date.now() - startTime;

      console.log(`✅ Pipeline completed in ${state.total_duration_ms}ms (${state.cache_hits} cache hits)`);

      // Save final dossier
      const dossier = state.artifacts.dossier as DossierData;
      if (dossier) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `dossier_${input.project_title}_${timestamp}.json`;
        await writeJsonFile(path.join(this.outputDir, filename), dossier);
      }

      return {
        success: true,
        data: dossier,
        state,
      };

    } catch (error) {
      state.total_duration_ms = Date.now() - startTime;
      
      console.error("❌ Pipeline failed:", error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        state,
      };
    }
  }

  async getState(pipelineId: string): Promise<PipelineState | null> {
    // In a real implementation, you'd persist and retrieve state
    return null;
  }

  async resume(pipelineId: string): Promise<{ success: boolean; data?: DossierData; error?: string }> {
    // TODO: Implement resume functionality
    throw new Error("Resume not yet implemented");
  }
}
