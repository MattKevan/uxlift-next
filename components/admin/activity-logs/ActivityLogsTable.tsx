// components/admin/activity-logs/LogsTable.tsx
import React from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import type { ActivityLog, ActivityLogsFilter, Pagination } from '@/types/activity-logs'

interface LogsTableProps {
  logs: ActivityLog[]
  loading: boolean
  error: string | null
  filter: ActivityLogsFilter
  setFilter: (filter: ActivityLogsFilter) => void
  pagination: Pagination
  setPagination: (pagination: Pagination) => void
  onRefresh: () => void
  onViewDetails: (log: ActivityLog) => void
}

export function LogsTable({
  logs,
  loading,
  error,
  filter,
  setFilter,
  pagination,
  setPagination,
  onRefresh,
  onViewDetails
}: LogsTableProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {/* Header with filters */}
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
              onClick={onRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="px-4 py-5 sm:p-6">
          <p className="text-center">Loading...</p>
        </div>
      )}
      
      {/* Error state */}
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
                  onClick={onRefresh}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Table */}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <StatusBadge status={log.status} />
                    </td>
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
                        onClick={() => onViewDetails(log)}
                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                      >
                        Details
                      </button>
                      
                      {log.error && (
                        <div className="mt-1">
                          <button
                            onClick={() => onViewDetails(log)}
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
      
      {/* Pagination */}
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
  )
}