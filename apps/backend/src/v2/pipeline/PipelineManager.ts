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
  private progressCallback?: (event: any) => void;

  constructor(outputDir = "examples/output", progressCallback?: (event: any) => void) {
    this.cache = new CacheManager();
    this.stepProcessor = new StepProcessor(this.cache);
    this.outputDir = outputDir;
    this.incrementalBuilder = new IncrementalBuilder();
    this.progressCallback = progressCallback;

    // Initialize RateGate system for token budgeting
    initializeRateGate();
    console.log("🛡️ RateGate system initialized for token management");
  }

  /**
   * Get stage and substep information for a given step ID
   */
  private getStageInfo(stepId: string): {
    stage: "S1" | "S2" | "S3" | "S4";
    substep: string;
    substepIndex: number;
    substepTotal: number;
  } {
    // S1: Input Processing, Evidence Harvesting, Brief Extraction
    const s1Steps = [
      { id: "input", name: "Input Processing" },
      { id: "evidence", name: "Evidence Harvesting" },
      { id: "brief", name: "Brief Extraction" },
    ];

    // S2: Problem, Solution, Team, Market, Business Model, Competition, Status Quo, Go-to-Market, Financial Plan
    const s2Steps = [
      { id: "problem", name: "Problem" },
      { id: "solution", name: "Solution" },
      { id: "team", name: "Team" },
      { id: "market", name: "Market" },
      { id: "business_model", name: "Business Model" },
      { id: "competition", name: "Competition" },
      { id: "status_quo", name: "Status Quo" },
      { id: "gtm", name: "Go-to-Market" },
      { id: "financial_plan", name: "Financial Plan" },
    ];

    // S3: Validation/Number Check, Style & Consistency Pass
    const s3Steps = [
      { id: "validate", name: "Validation / Number Check" },
      { id: "style_check", name: "Style & Consistency Pass" }, // Virtual step - will be marked as skipped
    ];

    // S4: Final Assembly, Investment Score
    const s4Steps = [
      { id: "assemble", name: "Final Assembly" },
      { id: "investor_score", name: "Investment Score" },
    ];

    // Find step in S1
    const s1Index = s1Steps.findIndex((s) => s.id === stepId);
    if (s1Index !== -1) {
      return {
        stage: "S1",
        substep: s1Steps[s1Index].name,
        substepIndex: s1Index + 1,
        substepTotal: s1Steps.length,
      };
    }

    // Find step in S2
    const s2Index = s2Steps.findIndex((s) => s.id === stepId);
    if (s2Index !== -1) {
      return {
        stage: "S2",
        substep: s2Steps[s2Index].name,
        substepIndex: s2Index + 1,
        substepTotal: s2Steps.length,
      };
    }

    // Find step in S3
    const s3Index = s3Steps.findIndex((s) => s.id === stepId);
    if (s3Index !== -1) {
      return {
        stage: "S3",
        substep: s3Steps[s3Index].name,
        substepIndex: s3Index + 1,
        substepTotal: s3Steps.length,
      };
    }

    // Find step in S4
    const s4Index = s4Steps.findIndex((s) => s.id === stepId);
    if (s4Index !== -1) {
      return {
        stage: "S4",
        substep: s4Steps[s4Index].name,
        substepIndex: s4Index + 1,
        substepTotal: s4Steps.length,
      };
    }

    // Default fallback
    return {
      stage: "S1",
      substep: stepId,
      substepIndex: 1,
      substepTotal: 1,
    };
  }

  /**
   * Send progress event with stage/substep details
   */
  private sendProgressEvent(stepId: string, status: "running" | "completed" | "failed" | "skipped", completed: Set<string>, totalSteps: number, additionalData?: any) {
    if (!this.progressCallback) return;

    const stageInfo = this.getStageInfo(stepId);
    const percentage = Math.round((completed.size / totalSteps) * 100);

    const progressEvent = {
      step: stepId,
      stage: stageInfo.stage,
      substep: stageInfo.substep,
      substepIndex: stageInfo.substepIndex,
      substepTotal: stageInfo.substepTotal,
      percentage,
      currentStep: completed.size,
      totalSteps,
      status,
      ...additionalData,
    };

    this.progressCallback(progressEvent);
  }

  /**
   * Sanitize nonce to safe characters and length
   */
  private sanitizeNonce(nonce: string): string {
    if (!nonce) return "";
    // Keep only alphanumeric, underscore, hyphen characters and limit to 64 chars
    return nonce.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 64);
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
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster problem step
      },
      {
        id: "solution",
        name: "Solution Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.solution"],
        prompt_file: "31_solution.md",
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster solution step
      },
      {
        id: "team",
        name: "Team Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.team"],
        prompt_file: "32_team.md",
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster team step
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
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster competition step
      },
      {
        id: "status_quo",
        name: "Status Quo Section",
        dependencies: ["brief", "evidence"],
        inputs: ["brief", "sources"],
        outputs: ["sections.status_quo"],
        prompt_file: "37_status_quo.md",
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster status_quo step
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
        model_preference: "gpt-4o-mini", // Performance: Use gpt-4o-mini for faster gtm step
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
      // New: cache-busting nonce propagated to step cache keys (should be sanitized to [-A-Za-z0-9_] and <=64 chars)
      nonce?: string;
      // Callbacks for job integration
      onProgress?: (step: string, percentage: number) => void;
      onArtifact?: (key: string, artifact: any) => void;
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
      // New: carry nonce through pipeline state for cache-key context
      nonce: options.nonce || "",
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
        // Send virtual style_check step as skipped for S3 completeness
        if (this.progressCallback) {
          this.sendProgressEvent("style_check", "skipped", completed, steps.length, { skipped: true });
        }

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

              // Send progress event for skipped step
              this.sendProgressEvent(step.id, "skipped", completed, steps.length);

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

          // SERIAL S2 EXECUTION: S2 section steps (problem -> financial_plan) run one at a time
          const s2Steps = ["problem", "solution", "team", "market", "business_model", "competition", "status_quo", "gtm", "financial_plan"];
          const s2ReadySteps = readySteps.filter((step) => s2Steps.includes(step.id));
          const nonS2ReadySteps = readySteps.filter((step) => !s2Steps.includes(step.id));

          let batch: PipelineStep[] = [];

          if (s2ReadySteps.length > 0) {
            // For S2 steps, only process ONE at a time (serial execution)
            batch = [s2ReadySteps[0]];
          } else {
            // For non-S2 steps, use normal parallelLimit
            batch = nonS2ReadySteps.slice(0, parallelLimit);
          }

          const promises = batch.map(async (step) => {
            if (timeoutController.signal.aborted) {
              throw new Error("Pipeline aborted due to timeout");
            }

            state.steps[step.id].status = "running";
            state.steps[step.id].started_at = new Date().toISOString();

            // Send running progress event
            this.sendProgressEvent(step.id, "running", completed, steps.length);

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

            // Attach cache-busting context to inputs so cache keys change with nonce and input identity
            const cacheCtx = {
              project_title: state.artifacts.project_title,
              elevator_pitch: state.artifacts.elevator_pitch,
              nonce: state.artifacts.nonce || "",
              input_hash: this.cache.generatePitchHash({
                project_title: state.artifacts.project_title,
                elevator_pitch: state.artifacts.elevator_pitch,
              }),
            };
            const inputsWithCtx = { ...stepInputs, __ctx: cacheCtx };

            const result = await this.stepProcessor.executeStep(
              step,
              inputsWithCtx,
              {
                skipCache: skipCache,
                forceRebuild: false,
                nonce: options.nonce,
                jobId: pipelineId,
              },
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

              // Send completed progress event
              this.sendProgressEvent(step.id, "completed", completed, steps.length, { duration_ms: result.duration_ms });

            } else {
              state.steps[step.id].status = "failed";
              state.steps[step.id].error = result.error;
              // Send failed progress event
              this.sendProgressEvent(step.id, "failed", completed, steps.length, { error: result.error });
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
