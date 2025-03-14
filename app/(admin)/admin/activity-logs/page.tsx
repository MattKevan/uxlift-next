'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

interface LogStep {
  id: number
  log_id: number
  step_name: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  success: boolean | null
  message: string | null
  data: any
}

interface ActivityLog {
  id: number
  function_name: string
  execution_id: string
  job_id: number | null
  status: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  success: boolean | null
  error: string | null
  items_processed: number
  items_failed: number
  total_sites: number | null
  processed_sites: number | null
  total_batches: number | null
  current_batch: number | null
  batch_size: number | null
  current_site: string | null
  total_steps: number
  successful_steps: number
  steps?: LogStep[] // New field for steps
}

interface Job {
  id: number
  status: string
  job_type: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  processed_items: number
  error_count: number
  current_site: string | null
  current_batch: number | null
  total_batches: number | null
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({ function: '', status: '' })
  const [pagination, setPagination] = useState({ total: 0, offset: 0, limit: 20 })
  const [activeTab, setActiveTab] = useState('logs')
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  const fetchLogs = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      params.append('limit', pagination.limit.toString())
      params.append('offset', pagination.offset.toString())
      
      if (filter.function) params.append('function', filter.function)
      if (filter.status) params.append('status', filter.status)
      
      const response = await fetch(`/api/admin/activity-logs?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs')
      }
      
      const data = await response.json()
      setLogs(data.logs || [])
      setActiveJobs(data.activeJobs || [])
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  // New function to fetch log details
  const fetchLogDetails = async (logId: number) => {
    try {
      setLoadingDetails(true)
      
      const response = await fetch(`/api/admin/activity-logs/${logId}/steps`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch log details')
      }
      
      const data = await response.json()
      
      // Update the selected log with steps
      setSelectedLog(prev => {
        if (prev) {
          return { ...prev, steps: data.steps || [] }
        }
        return prev
      })
    } catch (err) {
      console.error('Error fetching log details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }
  
  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log)
    fetchLogDetails(log.id)
  }
  
  useEffect(() => {
    fetchLogs()
    
    // Refresh active logs every 10 seconds
    const interval = setInterval(() => {
      if (activeJobs.length > 0) {
        fetchLogs()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [filter, pagination.offset, pagination.limit])
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'started':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Started</span>
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Processing</span>
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>
    }
  }
  
  // New component for rendering log details in a modal
  const LogDetailsModal = () => {
    if (!selectedLog) return null
    
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex justify-between border-b border-gray-200">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Log Details - {selectedLog.function_name}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                ID: {selectedLog.id} | Execution ID: {selectedLog.execution_id}
              </p>
            </div>
            <button 
              onClick={() => setSelectedLog(null)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="px-4 py-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Status</h4>
                <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Duration</h4>
                <div className="mt-1 text-gray-900">
                  {selectedLog.duration_ms ? `${(selectedLog.duration_ms / 1000).toFixed(2)}s` : 'In progress'}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Started</h4>
                <div className="mt-1 text-gray-900">
                  {format(new Date(selectedLog.started_at), 'MMM d, yyyy HH:mm:ss')}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Completed</h4>
                <div className="mt-1 text-gray-900">
                  {selectedLog.completed_at 
                    ? format(new Date(selectedLog.completed_at), 'MMM d, yyyy HH:mm:ss')
                    : 'Not completed'
                  }
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Items Processed</h4>
                <div className="mt-1 text-gray-900">
                  {selectedLog.items_processed}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 text-sm">Items Failed</h4>
                <div className="mt-1 text-gray-900">
                  {selectedLog.items_failed}
                </div>
              </div>
            </div>
            
            {/* Error Display */}
            {selectedLog.error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 text-sm">Error</h4>
                <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap break-words">
                  {selectedLog.error}
                </pre>
              </div>
            )}
            
            {/* Log Steps */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Execution Steps</h4>
              
              {loadingDetails ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">Loading steps...</p>
                </div>
              ) : selectedLog.steps && selectedLog.steps.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedLog.steps.map((step) => (
                        <tr key={step.id} className="hover:bg-gray-50 group cursor-pointer">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{step.step_name}</td>
                          <td className="px-4 py-3 text-sm">
                            {step.success === true ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Success</span>
                            ) : step.success === false ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">In Progress</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {format(new Date(step.started_at), 'HH:mm:ss')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(2)}s` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {step.message || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No steps available for this log.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="px-4 py-3 sm:px-6 bg-gray-50 flex justify-end">
            <button
              onClick={() => setSelectedLog(null)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Edge Function Activity Logs</h1>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('logs')}
              className={`${
                activeTab === 'logs'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              All Logs
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`${
                activeTab === 'active'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Active Jobs ({activeJobs.length})
            </button>
          </nav>
        </div>
      </div>
      
      {activeTab === 'logs' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Activity Logs</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                View detailed logs of edge function executions
              </p>
            </div>
            
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
                <select 
                  className="border rounded p-2 text-sm"
                  value={filter.function}
                  onChange={(e) => setFilter({...filter, function: e.target.value})}
                >
                  <option value="">All Functions</option>
                  <option value="process-feeds-controller">Controller</option>
                  <option value="process-feeds-worker">Worker</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select 
                  className="border rounded p-2 text-sm"
                  value={filter.status}
                  onChange={(e) => setFilter({...filter, status: e.target.value})}
                >
                  <option value="">All Statuses</option>
                  <option value="started">Started</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              
              <div className="self-end">
                <button 
                  onClick={() => fetchLogs()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
          
          {loading && (
            <div className="px-4 py-5 sm:p-6">
              <p className="text-center">Loading...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded mx-4 my-2">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading logs</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => fetchLogs()}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Function</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Processed</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className={`hover:bg-gray-50 ${log.error ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.function_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStatusBadge(log.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{formatDistanceToNow(new Date(log.started_at))} ago</div>
                          <div className="text-xs text-gray-400">
                            {format(new Date(log.started_at), 'MMM d, yyyy HH:mm:ss')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(2)}s` : 'In progress'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.items_processed} 
                          {log.items_failed > 0 && (
                            <span className="text-red-600 ml-1">
                              ({log.items_failed} failed)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.job_id ? (
                            <span className="text-blue-600">#{log.job_id}</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleViewDetails(log)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            Details
                          </button>
                          
                          {log.error && (
                            <div className="mt-1">
                              <button
                                onClick={() => handleViewDetails(log)}
                                className="text-red-600 hover:text-red-800 text-xs flex items-center"
                              >
                                <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                View Error
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {!loading && !error && logs.length > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination({...pagination, offset: Math.max(0, pagination.offset - pagination.limit)})}
                  disabled={pagination.offset === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({...pagination, offset: pagination.offset + pagination.limit})}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{pagination.offset + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(pagination.offset + logs.length, pagination.total)}</span> of{' '}
                    <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPagination({...pagination, offset: Math.max(0, pagination.offset - pagination.limit)})}
                      disabled={pagination.offset === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPagination({...pagination, offset: pagination.offset + pagination.limit})}
                      disabled={pagination.offset + pagination.limit >= pagination.total}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'active' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Active Jobs</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Currently running feed processing jobs
            </p>
            <div className="mt-4">
              <button 
                onClick={() => fetchLogs()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Refresh
              </button>
            </div>
          </div>
          
          {loading && (
            <div className="px-4 py-5 sm:p-6">
              <p className="text-center">Loading...</p>
            </div>
          )}
          
          {!loading && activeJobs.length === 0 ? (
            <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
              No active jobs
            </div>
          ) : (
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-6">
                {activeJobs.map(job => (
                  <div key={job.id} className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                    <div className="px-4 py-5 sm:px-6 flex justify-between">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Job #{job.id}</h3>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="px-4 py-5 sm:p-6">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                          <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Started</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {job.started_at ? formatDistanceToNow(new Date(job.started_at)) + ' ago' : 'Pending'}
                            </dd>
                          </div>
                        </div>
                        
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                          <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Current Batch</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {job.current_batch !== null ? `${job.current_batch + 1} of ${job.total_batches}` : 'N/A'}
                            </dd>
                          </div>
                        </div>
                        
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                          <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Items Processed</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">{job.processed_items}</dd>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-500">Current Site</h4>
                        <p className="mt-2 text-sm text-gray-900">{job.current_site || 'N/A'}</p>
                      </div>
                      
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-500">Progress</h4>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ 
                                width: `${job.total_batches ? ((job.current_batch || 0) / job.total_batches) * 100 : 0}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Buttons to interact with job */}
                      <div className="mt-6 flex space-x-3">
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => {
                            // Find the log for this job
                            const jobLog = logs.find(log => log.job_id === job.id);
                            if (jobLog) {
                              handleViewDetails(jobLog);
                            }
                          }}
                        >
                          View Details
                        </button>
                        
                        {/* This would require backend support to implement */}
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          onClick={() => {
                            // This would need an API endpoint to cancel jobs
                            if (confirm('Are you sure you want to cancel this job?')) {
                              // cancelJob(job.id)
                              alert('Job cancellation not implemented yet');
                            }
                          }}
                        >
                          Cancel Job
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Log Details Modal */}
      {selectedLog && <LogDetailsModal />}
    </div>
  )}