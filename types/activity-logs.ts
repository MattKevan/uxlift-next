// types/activity-logs.ts

export interface ActivityLog {
  id: number;
  function_name: string;
  execution_id: string;
  job_id: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  success: boolean | null;
  error: string | null;
  items_processed: number;
  items_failed: number;
  total_sites: number | null;
  processed_sites: number | null;
  total_batches: number | null;
  current_batch: number | null;
  batch_size: number | null;
  current_site: string | null;
  total_steps: number;
  successful_steps: number;
  steps?: LogStep[]; // Added during detail fetch
}

export interface LogStep {
  id: number;
  log_id: number;
  step_name: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  success: boolean | null;
  message: string | null;
  data: any;
}

export interface Job {
  id: number;
  status: string;
  job_type: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  processed_items: number;
  error_count: number;
  current_site: string | null;
  current_batch: number | null;
  total_batches: number | null;
  total_sites: number | null;
  processed_sites: number | null;
  is_cron: boolean;
  error: string | null;
  metadata: {
    github_workflow?: string;
    process_type?: 'feeds' | 'embed' | 'both';
    [key: string]: any;
  };
  duration: number | null;
  isGithubAction?: boolean; // Added to indicate if job is a GitHub Action
  displayName?: string; // Added for better display in UI
}

export interface ActivityLogsFilter {
  function: string;
  status: string;
}

export interface Pagination {
  total: number;
  offset: number;
  limit: number;
}
