import { CacheManager } from "../cache/CacheManager.js";
import { StepProcessor } from "./StepProcessor.js";
import { writeJsonFile } from "../utils/hash.js";
import { IncrementalBuilder, type RebuildPlan } from "./IncrementalBuilder.js";
import type {
  PipelineStep,
  PipelineState,
  PitchInput,
  DossierData,
} from "../types.js";
import { initializeRateGate } from "../../lib/rate-gate.js";
import path from "path";

export class PipelineManager {
  private cache: CacheManager;
  private stepProcessor: StepProcessor;
  private outputDir: string;
  private incrementalBuilder: IncrementalBuilder;

  constructor(outputDir = "examples/output") {
    this.cache = new CacheManager();
    this.stepProcessor = new StepProcessor(this.cache);
    this.outputDir = outputDir;
    this.incrementalBuilder = new IncrementalBuilder();

    // Initialize RateGate system for token budgeting
    initializeRateGate();
    console.log("🛡️ RateGate system initialized for token management");
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
        model_preference: "gpt-4", // GPT-4.1 for research & curation per specification
      },
      {
        id: "brief",
        name: "Brief Extraction",
        dependencies: ["input"],
        inputs: ["pitch", "sources"],
        outputs: ["brief"],
        prompt_file: "20_extract_brief.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "problem",
        name: "Problem Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.problem"],
        prompt_file: "30_problem.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "solution",
        name: "Solution Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.solution"],
        prompt_file: "31_solution.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "team",
        name: "Team Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.team"],
        prompt_file: "32_team.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "market",
        name: "Market Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.market"],
        prompt_file: "33_market.md",
        model_preference: "gpt-4", // GPT-4.1 for numbers/methodology per specification
      },
      {
        id: "business_model",
        name: "Business Model Section",
        dependencies: ["brief", "evidence", "market"],
        inputs: ["brief", "sources", "sections.market"],
        outputs: ["sections.business_model"],
        prompt_file: "34_business_model.md",
        model_preference: "gpt-4", // GPT-4.1 for financial modeling per specification
      },
      {
        id: "competition",
        name: "Competition Section",
        dependencies: ["brief", "evidence", "market"],
        inputs: ["brief", "sources", "sections.market"],
        outputs: ["sections.competition"],
        prompt_file: "35_competition.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "status_quo",
        name: "Status Quo Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.status_quo"],
        prompt_file: "37_status_quo.md",
        model_preference: "gpt-4o", // Using GPT-4o for testing
      },
      {
        id: "gtm",
        name: "Go-to-Market Section",
        dependencies: ["brief", "evidence", "market", "business_model"],
        inputs: [
          "brief",
          "sources",
          "sections.market",
          "sections.business_model",
        ],
        outputs: ["sections.gtm"],
        prompt_file: "36_go-to-market.md",
        model_preference: "gpt-4o-mini", // Temporary: Use gpt-4o-mini to avoid TPM rate limits
      },
      {
        id: "financial_plan",
        name: "Financial Plan Section",
        dependencies: ["business_model", "market"],
        inputs: [
          "brief",
          "sources",
          "sections.market",
          "sections.business_model",
        ],
        outputs: ["sections.financial_plan"],
        prompt_file: "38_financial_plan.md",
        model_preference: "gpt-4", // GPT-4.1 for financial modeling per specification
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
        dependencies: [
          "problem",
          "solution",
          "team",
          "market",
          "business_model",
          "competition",
          "status_quo",
          "gtm",
          "financial_plan",
        ],
        inputs: ["sections", "brief"],
        outputs: ["investor_score"],
        prompt_file: "90_investor_scoring.md",
        model_preference: "gpt-4", // GPT-4.1 for rubric evaluation per specification
      },
      {
        id: "assemble",
        name: "Final Assembly",
        dependencies: ["investor_score", "validate"],
        inputs: [
          "pitch",
          "sources",
          "brief",
          "sections",
          "investor_score",
          "validation",
        ],
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
      pipelineId?: string;
      resumeFromCheckpoint?: boolean;
    } = {},
  ): Promise<{
    success: boolean;
    data?: DossierData;
    error?: string;
    state: PipelineState;
    checkpoints_available?: boolean;
    resume_possible?: boolean;
  }> {
    const {
      skipCache = false,
      parallelLimit = 2, // Reduced to 2 per specification for better stability
      timeoutMs = 120000,
      pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      resumeFromCheckpoint = false,
    } = options;
    const startTime = Date.now();

    console.log("🚀 Starting pipeline execution for:", input.project_title);
    console.log("🆔 Pipeline ID:", pipelineId);

    // Check for resume capability
    let resumeState = null;
    if (resumeFromCheckpoint) {
      resumeState = await this.cache.loadCheckpoint(pipelineId);
      if (resumeState) {
        console.log("▶️  Resuming from checkpoint:", resumeState.step_id);
      } else {
        console.log("⚠️  No checkpoint found, starting from beginning");
      }
    }

    // Analyze what needs to be rebuilt using incremental builder
    const lastBuildState = await this.incrementalBuilder.loadBuildState();
    let rebuildPlan: RebuildPlan;

    if (skipCache) {
      rebuildPlan = {
        steps_to_rebuild: [
          "input",
          "evidence",
          "brief",
          "problem",
          "solution",
          "team",
          "market",
          "business_model",
          "competition",
          "status_quo",
          "gtm",
          "financial_plan",
          "validate",
          "investor_score",
          "assemble",
        ],
        steps_to_skip: [],
        reason: "skipCache=true - forcing full rebuild",
        estimated_duration_ms: 180000,
      };
    } else {
      // Create minimal pitch/sources objects for analysis
      const currentPitch = { pitch_text: input.elevator_pitch };
      const currentSources = {}; // Will be populated after evidence step

      rebuildPlan = await this.incrementalBuilder.analyzeBuildNeeds(
        currentPitch,
        currentSources,
        lastBuildState || undefined,
      );
    }

    console.log(`📋 Rebuild plan: ${rebuildPlan.reason}`);
    console.log(
      `⚡ Steps to rebuild: ${rebuildPlan.steps_to_rebuild.length}/${rebuildPlan.steps_to_rebuild.length + rebuildPlan.steps_to_skip.length}`,
    );
    console.log(
      `⏱️  Estimated duration: ${Math.round(rebuildPlan.estimated_duration_ms / 1000)}s`,
    );

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
      // Restore state from checkpoint if resuming
      let completed = new Set<string>();
      if (resumeState) {
        // Restore completed steps
        for (const [stepId, stepState] of Object.entries(
          resumeState.pipeline_state.steps,
        )) {
          const typedStepState = stepState as {
            status: string;
            [key: string]: any;
          };
          if (
            typedStepState.status === "completed" ||
            typedStepState.status === "skipped"
          ) {
            completed.add(stepId);
            state.steps[stepId] = typedStepState as any;
          }
        }
        // Restore artifacts
        state.artifacts = {
          ...state.artifacts,
          ...resumeState.pipeline_state.artifacts,
        };
        state.cache_hits = resumeState.pipeline_state.cache_hits || 0;
        console.log(
          `🔄 Restored ${completed.size} completed steps from checkpoint`,
        );
      }

      // Execute steps in dependency order with limited parallelism
      const timeoutController = new AbortController();
      const globalTimeout = setTimeout(() => {
        timeoutController.abort();
      }, timeoutMs);

      try {
        while (completed.size < steps.length) {
          const readySteps = steps.filter(
            (step) =>
              !completed.has(step.id) &&
              state.steps[step.id].status === "pending" &&
              step.dependencies.every((dep) => completed.has(dep)) &&
              rebuildPlan.steps_to_rebuild.includes(step.id), // Only process steps that need rebuilding
          );

          // Mark skipped steps as completed immediately
          for (const step of steps) {
            if (
              !completed.has(step.id) &&
              rebuildPlan.steps_to_skip.includes(step.id) &&
              step.dependencies.every((dep) => completed.has(dep))
            ) {
              state.steps[step.id].status = "skipped";
              state.steps[step.id].duration_ms = 0;
              state.cache_hits++;

              // Load cached result for skipped steps
              // TODO: Implement proper cache loading for skipped steps
              for (const outputKey of step.outputs) {
                if (outputKey.includes(".")) {
                  const [parent, child] = outputKey.split(".");
                  if (!state.artifacts[parent]) {
                    state.artifacts[parent] = {};
                  }
                  state.artifacts[parent][child] = {}; // Placeholder
                } else {
                  state.artifacts[outputKey] = {}; // Placeholder
                }
              }

              completed.add(step.id);
              console.log(`⏭️  Skipped ${step.name} (cached)`);
            }
          }

          if (readySteps.length === 0) {
            const remaining = steps.filter((step) => !completed.has(step.id));
            throw new Error(
              `Dependency deadlock. Remaining steps: ${remaining.map((s) => s.id).join(", ")}`,
            );
          }

          // Execute up to parallelLimit steps concurrently
          const batch = readySteps.slice(0, parallelLimit);
          const promises = batch.map(async (step) => {
            if (timeoutController.signal.aborted) {
              throw new Error("Pipeline aborted due to timeout");
            }

            state.steps[step.id].status = "running";
            state.steps[step.id].started_at = new Date().toISOString();

            // Save checkpoint before starting critical steps
            if (
              [
                "evidence",
                "brief",
                "market",
                "business_model",
                "investor_score",
              ].includes(step.id)
            ) {
              await this.cache.saveCheckpoint(pipelineId, {
                step_id: step.id,
                pipeline_state: { ...state },
                timestamp: new Date().toISOString(),
                input_hash: this.cache.generatePitchHash(input),
              });
            }

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

            const result = await this.stepProcessor.executeStep(
              step,
              stepInputs,
              skipCache,
            );

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
          completedBatch.forEach((stepId) => completed.add(stepId));

          // Periodic checkpoint save every 2 completed steps
          if (completed.size % 2 === 0) {
            await this.cache.saveCheckpoint(pipelineId, {
              step_id: "batch_checkpoint",
              pipeline_state: { ...state },
              timestamp: new Date().toISOString(),
              input_hash: this.cache.generatePitchHash(input),
            });
          }

          // Check timeout via controller
          if (timeoutController.signal.aborted) {
            throw new Error(`Pipeline timeout after ${timeoutMs}ms`);
          }
        }
      } finally {
        clearTimeout(globalTimeout);
      }

      state.total_duration_ms = Date.now() - startTime;

      console.log(
        `✅ Pipeline completed in ${state.total_duration_ms}ms (${state.cache_hits} cache hits)`,
      );

      // Save final dossier
      const dossier = state.artifacts.dossier as DossierData;
      if (dossier) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `dossier_${input.project_title}_${timestamp}.json`;
        await writeJsonFile(path.join(this.outputDir, filename), dossier);
      }

      // Clean up checkpoints after successful completion
      await this.cache.deleteCheckpoint(pipelineId);

      return {
        success: true,
        data: dossier,
        state,
        checkpoints_available: false,
        resume_possible: false,
      };
    } catch (error) {
      state.total_duration_ms = Date.now() - startTime;

      console.error("❌ Pipeline failed:", error);

      // Save error checkpoint for potential resume
      await this.cache.saveCheckpoint(pipelineId, {
        step_id: "error_state",
        pipeline_state: { ...state },
        timestamp: new Date().toISOString(),
        input_hash: this.cache.generatePitchHash(input),
        error: error instanceof Error ? error.message : String(error),
      });

      const checkpointExists = await this.cache.loadCheckpoint(pipelineId);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        state,
        checkpoints_available: !!checkpointExists,
        resume_possible: !!checkpointExists,
      };
    }
  }

  async getState(pipelineId: string): Promise<PipelineState | null> {
    const checkpoint = await this.cache.loadCheckpoint(pipelineId);
    return checkpoint?.pipeline_state || null;
  }

  async resume(
    pipelineId: string,
    input?: PitchInput,
  ): Promise<{
    success: boolean;
    data?: DossierData;
    error?: string;
    state?: PipelineState;
  }> {
    console.log(`🔄 Attempting to resume pipeline: ${pipelineId}`);

    const checkpoint = await this.cache.loadCheckpoint(pipelineId);
    if (!checkpoint) {
      return {
        success: false,
        error: `No checkpoint found for pipeline: ${pipelineId}`,
      };
    }

    // If no input provided, try to reconstruct from checkpoint
    if (!input) {
      const artifacts = checkpoint.pipeline_state.artifacts;
      if (!artifacts.project_title || !artifacts.elevator_pitch) {
        return {
          success: false,
          error:
            "Cannot resume: original input data not available in checkpoint",
        };
      }

      input = {
        project_title: artifacts.project_title,
        elevator_pitch: artifacts.elevator_pitch,
        language: artifacts.language || "de",
        target: artifacts.target || "Pre-Seed/Seed VCs",
        geo: artifacts.geo || "EU/DACH",
      };
    }

    console.log(`⏮️  Resuming from step: ${checkpoint.step_id}`);
    console.log(`📅 Checkpoint created: ${checkpoint.timestamp}`);

    // Resume execution with existing checkpoint
    return await this.executePipeline(input, {
      pipelineId,
      resumeFromCheckpoint: true,
    });
  }

  async listCheckpoints(): Promise<string[]> {
    // This would need implementation in CacheManager
    // For now, return empty array
    return [];
  }

  async deleteCheckpoint(pipelineId: string): Promise<boolean> {
    try {
      await this.cache.deleteCheckpoint(pipelineId);
      return true;
    } catch (error) {
      console.error(`Failed to delete checkpoint ${pipelineId}:`, error);
      return false;
    }
  }
}
