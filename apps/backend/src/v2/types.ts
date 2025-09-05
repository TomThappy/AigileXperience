export interface PitchInput {
  project_title: string;
  elevator_pitch: string;
  language?: string;
  target?: string;
  geo?: string;
}

export interface PitchData {
  meta: {
    version: string;
    ts: string;
  };
  project_title: string;
  pitch_text: string;
  pitch_hash: string;
}

export interface Source {
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

export interface SourcesData {
  region: string;
  topics: string[];
  sources: Source[];
}

export interface BriefData {
  facts: {
    target_user: string;
    value_prop: string;
    core_features: string[];
    differentiation: string;
    north_star: string;
    goals_2030: string;
  };
  open_questions: string[];
  assumptions: string[];
  brief: string;
}

export interface SectionData {
  headline: string;
  bullets: string[];
  narrative: string;
  data: Record<string, any>;
  assumptions: string[];
  open_questions: string[];
  citations: Source[];
  evidence_coverage: string;
}

export interface InvestorScore {
  score_total: number;
  verdict: "GREEN" | "YELLOW" | "RED";
  scores: Record<string, number>;
  top_strengths: string[];
  top_risks: string[];
  priority_fixes: string[];
  follow_up_questions: string[];
  consistency_issues: string[];
}

export interface DossierData {
  pitch: PitchData;
  sources: SourcesData;
  brief: BriefData;
  sections: Record<string, SectionData>;
  investor_score: InvestorScore;
  meta: {
    version: string;
    generated_at: string;
    total_duration_ms: number;
  };
}

export interface PipelineStep {
  id: string;
  name: string;
  dependencies: string[];
  inputs: string[];
  outputs: string[];
  prompt_file?: string;
  model_preference?: "gpt-4o" | "gpt-4" | "claude-3-5-sonnet";
}

export interface PipelineState {
  steps: Record<
    string,
    {
      status: "pending" | "running" | "completed" | "failed" | "skipped";
      started_at?: string;
      completed_at?: string;
      duration_ms?: number;
      error?: string;
      hash?: string;
    }
  >;
  artifacts: Record<string, any>;
  cache_hits: number;
  total_duration_ms: number;
}

export interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
  duration_ms: number;
  cache_hit: boolean;
  hash: string;
}
