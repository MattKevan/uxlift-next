// /supabase/functions/_shared/logger.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'

export class EdgeFunctionLogger {
  private supabase;
  private logId: number | null = null;
  private functionName: string;
  private executionId: string;
  private jobId?: number;
  private startTime: number;
  private steps: Map<string, { startTime: number, data: any }> = new Map();
  
  constructor(functionName: string, jobId?: number) {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    this.functionName = functionName;
    this.executionId = crypto.randomUUID();
    this.jobId = jobId;
    this.startTime = performance.now();
  }
  
  async initialize(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('edge_function_logs')
        .insert([{
          function_name: this.functionName,
          execution_id: this.executionId,
          job_id: this.jobId,
          status: 'started',
          context: {
            environment: Deno.env.get('ENVIRONMENT') || 'production',
            timestamp: new Date().toISOString()
          }
        }])
        .select('id')
        .single();
      
      if (error) throw error;
      this.logId = data.id;
      return data.id;
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      return 0;
    }
  }
  
  async startStep(stepName: string, data: any = {}): Promise<void> {
    if (!this.logId) await this.initialize();
    
    this.steps.set(stepName, {
      startTime: performance.now(),
      data
    });
    
    try {
      await this.supabase
        .from('edge_function_steps')
        .insert([{
          log_id: this.logId,
          step_name: stepName,
          data
        }]);
    } catch (error) {
      console.error(`Failed to log step start (${stepName}):`, error);
    }
  }
  
  async endStep(stepName: string, success: boolean, message?: string, additionalData: any = {}): Promise<void> {
    if (!this.logId) return;
    
    const step = this.steps.get(stepName);
    if (!step) return;
    
    const duration = Math.round(performance.now() - step.startTime);
    const data = { ...step.data, ...additionalData };
    
    try {
      const { data: stepData } = await this.supabase
        .from('edge_function_steps')
        .select('id')
        .eq('log_id', this.logId)
        .eq('step_name', stepName)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (stepData?.id) {
        await this.supabase
          .from('edge_function_steps')
          .update({
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            success,
            message,
            data
          })
          .eq('id', stepData.id);
      }
    } catch (error) {
      console.error(`Failed to log step end (${stepName}):`, error);
    }
  }
  
  async complete(success: boolean, metrics: {
    itemsProcessed?: number;
    itemsFailed?: number;
    memoryUsed?: number;
  } = {}, error?: Error): Promise<void> {
    if (!this.logId) return;
    
    const duration = Math.round(performance.now() - this.startTime);
    
    try {
      await this.supabase
        .from('edge_function_logs')
        .update({
          status: success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          success,
          error: error?.message,
          items_processed: metrics.itemsProcessed || 0,
          items_failed: metrics.itemsFailed || 0,
          memory_used_mb: metrics.memoryUsed || 0
        })
        .eq('id', this.logId);
    } catch (updateError) {
      console.error('Failed to complete log:', updateError);
    }
  }
}