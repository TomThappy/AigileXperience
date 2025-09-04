import crypto from "node:crypto";
import { writeJsonFile, readJsonFile } from "../utils/hash.js";
import path from "node:path";

export interface BuildState {
  pitch_hash: string;
  sources_hash: string;
  brief_hash: string;
  section_hashes: Record<string, string>;
  validated_hash: string;
  score_hash: string;
  dossier_hash: string;
  last_build: string;
  build_history: BuildRecord[];
}

export interface BuildRecord {
  timestamp: string;
  changed_components: string[];
  affected_steps: string[];
  reason: string;
}

export interface RebuildPlan {
  steps_to_rebuild: string[];
  steps_to_skip: string[];
  reason: string;
  estimated_duration_ms: number;
}

export class IncrementalBuilder {
  private stateFile: string;

  constructor(stateFile = "cache/build_state.json") {
    this.stateFile = path.resolve(process.cwd(), stateFile);
  }

  async analyzeBuildNeeds(
    currentPitch: any,
    currentSources: any,
    lastState?: BuildState,
  ): Promise<RebuildPlan> {
    // Calculate current hashes
    const currentPitchHash = this.hashContent(currentPitch?.pitch_text || "");
    const currentSourcesHash = this.hashContent(
      JSON.stringify(currentSources?.sources || []),
    );

    if (!lastState) {
      // First time build - everything needs to run
      return {
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
        reason: "Initial build - no previous state found",
        estimated_duration_ms: 180000, // ~3 minutes estimate
      };
    }

    const changedComponents: string[] = [];
    const affectedSteps = new Set<string>();

    // Check what changed
    if (currentPitchHash !== lastState.pitch_hash) {
      changedComponents.push("pitch");
      // Pitch change affects EVERYTHING
      affectedSteps.add("brief");
      this.addDependentSteps(affectedSteps, "brief");
    }

    if (currentSourcesHash !== lastState.sources_hash) {
      changedComponents.push("sources");
      // Sources change affects brief + all number-heavy sections
      affectedSteps.add("brief");
      affectedSteps.add("market");
      affectedSteps.add("business_model");
      affectedSteps.add("gtm");
      affectedSteps.add("financial_plan");
      this.addDependentSteps(affectedSteps, "market");
      this.addDependentSteps(affectedSteps, "business_model");
    }

    // TODO: Check for individual section parameter changes
    // This would require more sophisticated change detection

    const stepsToRebuild = Array.from(affectedSteps).sort();
    const allSteps = [
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
    ];
    const stepsToSkip = allSteps.filter(
      (step) => !stepsToRebuild.includes(step),
    );

    let reason = "";
    if (changedComponents.length === 0) {
      reason = "No changes detected - full cache hit possible";
    } else {
      reason = `Changed: ${changedComponents.join(", ")} -> affects: ${stepsToRebuild.join(", ")}`;
    }

    return {
      steps_to_rebuild: stepsToRebuild,
      steps_to_skip: stepsToSkip,
      reason,
      estimated_duration_ms: this.estimateDuration(stepsToRebuild),
    };
  }

  private addDependentSteps(
    affectedSteps: Set<string>,
    changedStep: string,
  ): void {
    // Define dependency graph for incremental updates
    const dependencies: Record<string, string[]> = {
      brief: [
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
      market: [
        "business_model",
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      business_model: [
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      gtm: ["financial_plan", "validate", "investor_score", "assemble"],
      financial_plan: ["validate", "investor_score", "assemble"],
      problem: ["investor_score", "assemble"],
      solution: ["investor_score", "assemble"],
      team: ["investor_score", "assemble"],
      competition: ["investor_score", "assemble"],
      status_quo: ["investor_score", "assemble"],
      validate: ["investor_score", "assemble"],
      investor_score: ["assemble"],
    };

    const dependents = dependencies[changedStep] || [];
    dependents.forEach((dep) => affectedSteps.add(dep));
  }

  private estimateDuration(steps: string[]): number {
    // Rough duration estimates per step (in ms)
    const durations: Record<string, number> = {
      input: 100,
      evidence: 30000, // 30s - multiple LLM calls
      brief: 8000, // 8s - single LLM call
      problem: 10000, // 10s - Claude call
      solution: 10000,
      team: 8000,
      market: 12000, // 12s - GPT-4 numbers
      business_model: 15000, // 15s - complex calculations
      competition: 10000,
      status_quo: 8000,
      gtm: 12000,
      financial_plan: 18000, // 18s - most complex
      validate: 2000, // 2s - script
      investor_score: 12000, // 12s - comprehensive analysis
      assemble: 1000, // 1s - script
    };

    return steps.reduce((total, step) => total + (durations[step] || 5000), 0);
  }

  async saveCurrentState(
    pitch: any,
    sources: any,
    brief: any,
    sections: Record<string, any>,
    validation: any,
    investorScore: any,
    dossier: any,
    rebuildPlan: RebuildPlan,
  ): Promise<BuildState> {
    const currentState: BuildState = {
      pitch_hash: this.hashContent(pitch?.pitch_text || ""),
      sources_hash: this.hashContent(JSON.stringify(sources?.sources || [])),
      brief_hash: this.hashContent(JSON.stringify(brief || {})),
      section_hashes: {},
      validated_hash: this.hashContent(JSON.stringify(validation || {})),
      score_hash: this.hashContent(JSON.stringify(investorScore || {})),
      dossier_hash: this.hashContent(JSON.stringify(dossier || {})),
      last_build: new Date().toISOString(),
      build_history: [],
    };

    // Calculate section hashes
    const sectionNames = [
      "problem",
      "solution",
      "team",
      "market",
      "business_model",
      "competition",
      "status_quo",
      "gtm",
      "financial_plan",
    ];
    for (const section of sectionNames) {
      currentState.section_hashes[section] = this.hashContent(
        JSON.stringify(sections[section] || {}),
      );
    }

    // Load previous state to preserve history
    const previousState = await this.loadBuildState();
    if (previousState) {
      currentState.build_history = [...(previousState.build_history || [])];
    }

    // Add current build to history
    const buildRecord: BuildRecord = {
      timestamp: new Date().toISOString(),
      changed_components: this.extractChangedComponents(rebuildPlan.reason),
      affected_steps: rebuildPlan.steps_to_rebuild,
      reason: rebuildPlan.reason,
    };

    currentState.build_history.push(buildRecord);

    // Keep only last 20 build records
    if (currentState.build_history.length > 20) {
      currentState.build_history = currentState.build_history.slice(-20);
    }

    // Save state
    await writeJsonFile(this.stateFile, currentState);
    console.log(
      `💾 Saved build state with ${rebuildPlan.steps_to_rebuild.length} rebuilt steps`,
    );

    return currentState;
  }

  async loadBuildState(): Promise<BuildState | null> {
    try {
      return await readJsonFile(this.stateFile);
    } catch (error) {
      return null;
    }
  }

  private hashContent(content: string): string {
    return crypto
      .createHash("sha256")
      .update(content.trim())
      .digest("hex")
      .substring(0, 16);
  }

  private extractChangedComponents(reason: string): string[] {
    // Extract changed components from reason string
    const match = reason.match(/Changed: ([^-]+)/);
    if (match) {
      return match[1].split(", ").map((s) => s.trim());
    }
    return [];
  }

  getIncrementalRebuildStrategies(): Record<string, string[]> {
    // Return common incremental rebuild patterns
    return {
      pitch_only_change: [
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
      sources_only_change: [
        "brief",
        "market",
        "business_model",
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      market_params_change: [
        "market",
        "business_model",
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      business_model_change: [
        "business_model",
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      gtm_budget_change: [
        "gtm",
        "financial_plan",
        "validate",
        "investor_score",
        "assemble",
      ],
      team_only_change: ["team", "investor_score", "assemble"],
      competition_only_change: ["competition", "investor_score", "assemble"],
    };
  }
}
