import crypto from "crypto";

export interface TraceEntry {
  step: string;
  phase?: string;
  model: string;
  ctx_max: number;
  prompt_tokens_est: number;
  truncate_applied: boolean;
  sources_after_filter: number;
  rategate_wait_ms: number;
  attempts: number;
  status: "ok" | "error" | "running" | "pending";
  error_code?: string;
  error_message?: string;
  raw_text_path?: string;
  
  // Legacy fields for compatibility
  prompt_bytes?: number;
  input_tokens_est?: number;
  max_tokens?: number;
  source_count_after_filter?: number;
  
  // Hashes for reproducibility
  prompt_hash: string;
  sources_hash: string;
  brief_hash?: string;
  section_key?: string;
  
  // Timing
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  
  // Token efficiency
  actual_tokens?: number;
  token_efficiency?: string; // actual/estimated as percentage
}

export interface JobTrace {
  job_id: string;
  created_at: string;
  completed_at?: string;
  status: "running" | "completed" | "failed";
  total_duration_ms: number;
  entries: TraceEntry[];
  
  // Summary stats
  summary: {
    total_steps: number;
    total_phases: number;
    total_llm_calls: number;
    total_tokens_estimated: number;
    total_tokens_actual?: number;
    total_rategate_wait_ms: number;
    models_used: Record<string, number>; // model -> call count
    errors: number;
  };
}

class TraceSystem {
  private traces = new Map<string, JobTrace>();
  
  /**
   * Initialize tracing for a new job
   */
  startTrace(jobId: string): void {
    const trace: JobTrace = {
      job_id: jobId,
      created_at: new Date().toISOString(),
      status: "running",
      total_duration_ms: 0,
      entries: [],
      summary: {
        total_steps: 0,
        total_phases: 0,
        total_llm_calls: 0,
        total_tokens_estimated: 0,
        total_rategate_wait_ms: 0,
        models_used: {},
        errors: 0,
      },
    };
    
    this.traces.set(jobId, trace);
    console.log(`🔍 [TRACE] Started tracing for job: ${jobId}`);
  }
  
  /**
   * Add a trace entry for a step/phase execution
   */
  addEntry(jobId: string, entry: Partial<TraceEntry>): void {
    const trace = this.traces.get(jobId);
    if (!trace) {
      console.warn(`⚠️ [TRACE] No trace found for job: ${jobId}`);
      return;
    }
    
    const fullEntry: TraceEntry = {
      step: entry.step || "unknown",
      phase: entry.phase,
      model: entry.model || "unknown",
      ctx_max: entry.ctx_max || this.getContextLength(entry.model || "unknown"),
      prompt_tokens_est: entry.prompt_tokens_est || Math.ceil((entry.prompt_bytes || 0) / 4),
      truncate_applied: entry.truncate_applied || false,
      sources_after_filter: entry.sources_after_filter || entry.source_count_after_filter || 0,
      rategate_wait_ms: entry.rategate_wait_ms || 0,
      attempts: entry.attempts || 1,
      status: entry.status || "ok",
      error_code: entry.error_code,
      error_message: entry.error_message,
      raw_text_path: entry.raw_text_path,
      
      // Legacy fields for compatibility
      prompt_bytes: entry.prompt_bytes || 0,
      input_tokens_est: entry.input_tokens_est || entry.prompt_tokens_est || Math.ceil((entry.prompt_bytes || 0) / 4),
      max_tokens: entry.max_tokens || 1200,
      source_count_after_filter: entry.source_count_after_filter || entry.sources_after_filter || 0,
      
      // Hashes for reproducibility
      prompt_hash: entry.prompt_hash || crypto.createHash("sha256").update(entry.step || "").digest("hex").substring(0, 8),
      sources_hash: entry.sources_hash || "none",
      brief_hash: entry.brief_hash,
      section_key: entry.section_key,
      
      // Timing
      started_at: entry.started_at || new Date().toISOString(),
      completed_at: entry.completed_at || new Date().toISOString(),
      duration_ms: entry.duration_ms || 0,
      
      // Token efficiency
      actual_tokens: entry.actual_tokens,
      token_efficiency: entry.actual_tokens && (entry.input_tokens_est || entry.prompt_tokens_est) 
        ? `${Math.round((entry.actual_tokens / (entry.input_tokens_est || entry.prompt_tokens_est!)) * 100)}%`
        : undefined,
    };
    
    trace.entries.push(fullEntry);
    this.updateSummary(trace, fullEntry);
    
    console.log(`🔍 [TRACE] Added entry for ${jobId}: ${fullEntry.step}${fullEntry.phase ? `(${fullEntry.phase})` : ""} - ${fullEntry.status}`);
  }
  
  /**
   * Mark a trace as completed
   */
  completeTrace(jobId: string, status: "completed" | "failed"): void {
    const trace = this.traces.get(jobId);
    if (!trace) return;
    
    trace.completed_at = new Date().toISOString();
    trace.status = status;
    trace.total_duration_ms = new Date().getTime() - new Date(trace.created_at).getTime();
    
    console.log(`🔍 [TRACE] Completed trace for ${jobId}: ${status} (${trace.total_duration_ms}ms)`);
  }
  
  /**
   * Get trace for a job
   */
  getTrace(jobId: string): JobTrace | null {
    return this.traces.get(jobId) || null;
  }
  
  /**
   * Clean up old traces (keep only last 100)
   */
  cleanup(): void {
    const traces = Array.from(this.traces.entries());
    if (traces.length > 100) {
      // Sort by creation time and keep only newest 100
      traces
        .sort(([, a], [, b]) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(100)
        .forEach(([jobId]) => this.traces.delete(jobId));
      
      console.log(`🔍 [TRACE] Cleaned up old traces, keeping ${this.traces.size} traces`);
    }
  }
  
  private updateSummary(trace: JobTrace, entry: TraceEntry): void {
    trace.summary.total_steps = new Set(trace.entries.map(e => e.step)).size;
    trace.summary.total_phases = trace.entries.filter(e => e.phase).length;
    trace.summary.total_llm_calls = trace.entries.length;
    trace.summary.total_tokens_estimated = trace.entries.reduce((sum, e) => sum + e.input_tokens_est, 0);
    trace.summary.total_tokens_actual = trace.entries.reduce((sum, e) => sum + (e.actual_tokens || 0), 0) || undefined;
    trace.summary.total_rategate_wait_ms = trace.entries.reduce((sum, e) => sum + e.rategate_wait_ms, 0);
    trace.summary.errors = trace.entries.filter(e => e.status === "error").length;
    
    // Update models_used count
    trace.summary.models_used[entry.model] = (trace.summary.models_used[entry.model] || 0) + 1;
  }
  
  private getContextLength(model: string): number {
    const contextLengths: Record<string, number> = {
      "gpt-3.5-turbo": 4096,
      "gpt-4": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "claude-3-5-sonnet": 200000,
      "claude-3-haiku": 200000,
    };
    
    return contextLengths[model] || 128000;
  }
}

// Singleton instance
export const traceSystem = new TraceSystem();

/**
 * Utility function to create hash from object
 */
export function createHash(data: any): string {
  const jsonString = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("sha256").update(jsonString).digest("hex").substring(0, 8);
}
