'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

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
            <div className="bg-red-50 p-4 rounded mb-4">
              <p className="text-red-800">{error}</p>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}