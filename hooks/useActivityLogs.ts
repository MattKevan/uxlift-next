// hooks/useActivityLogs.ts
import { useState, useEffect, useCallback } from 'react'
import type { ActivityLog, Job, ActivityLogsFilter, Pagination } from '@/types/activity-logs'
import { createClient } from '@/utils/supabase/client'

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ActivityLogsFilter>({ function: '', status: '' })
  const [pagination, setPagination] = useState<Pagination>({ total: 0, offset: 0, limit: 20 })
  
  // Fetch logs directly from Supabase
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const supabase = createClient()
      
      // Check user permission (optional as RLS will handle this)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Unauthorized - Please sign in')
      }
      
      // Build the query
      let query = supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact' })
      
      // Add filters
      if (filter.function) {
        query = query.eq('function_name', filter.function)
      }
      
      if (filter.status) {
        query = query.eq('status', filter.status)
      }
      
      // Add pagination and ordering
      query = query
        .order('started_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)
      
      const { data: logsData, error: logsError, count } = await query
      
      if (logsError) {
        console.error('Error fetching logs:', logsError)
        throw new Error(`Failed to fetch logs: ${logsError.message}`)
      }
      
      // Fetch active jobs
      const { data: activeJobsData, error: jobsError } = await supabase
        .from('feed_processing_jobs')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
      
      if (jobsError) {
        console.error('Error fetching active jobs:', jobsError)
        // Continue anyway as this is secondary information
      }
      
      setLogs(logsData || [])
      setActiveJobs(activeJobsData || [])
      setPagination(prev => ({ ...prev, total: count || 0 }))
      
    } catch (err) {
      console.error('Error in fetchLogs:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filter, pagination.limit, pagination.offset])
  
  // Fetch log details directly from Supabase
  const fetchLogDetails = useCallback(async (logId: number) => {
    try {
      setLoadingDetails(true)
      
      const supabase = createClient()
      
      // Fetch steps
      const { data: steps, error: stepsError } = await supabase
        .from('edge_function_steps')
        .select('*')
        .eq('log_id', logId)
        .order('started_at', { ascending: true })
      
      if (stepsError) {
        console.error('Error fetching steps:', stepsError)
        throw new Error(stepsError.message)
      }
      
      // Update the log with steps
      setLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === logId ? { ...log, steps: steps || [] } : log
        )
      )
      
      return steps || []
    } catch (err) {
      console.error('Error in fetchLogDetails:', err)
      return []
    } finally {
      setLoadingDetails(false)
    }
  }, [])
  
  // Initial fetch and refresh interval
  useEffect(() => {
    fetchLogs()
    
    // Refresh active logs every 10 seconds if there are active jobs
    const interval = setInterval(() => {
      if (activeJobs.length > 0) {
        fetchLogs()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [fetchLogs, activeJobs.length])
  
  return {
    logs,
    activeJobs,
    loading,
    loadingDetails,
    error,
    filter,
    setFilter,
    pagination,
    setPagination,
    fetchLogs,
    fetchLogDetails
  }
}