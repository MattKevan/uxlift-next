// components/admin/activity-logs/LogDetailsModal.tsx
import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import type { ActivityLog } from '@/types/activity-logs'

interface LogDetailsModalProps {
  log: ActivityLog
  onClose: () => void
}

export function LogDetailsModal({ log, onClose }: LogDetailsModalProps) {
  const [isLoading, setIsLoading] = useState(!log.steps)
  
  // Check if this is a GitHub Action-related log
  const isGitHubAction = log.function_name === 'github-action' || 
    (log.job_id && log.status === 'initiated');
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4 dark:bg-gray-900 dark:bg-opacity-75">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden dark:bg-gray-800">
        <div className="px-4 py-5 sm:px-6 flex justify-between border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Log Details - {log.function_name}
              {isGitHubAction && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  GitHub Action
                </span>
              )}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              ID: {log.id} | Execution ID: {log.execution_id}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="px-4 py-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Status</h4>
              <div className="mt-1"><StatusBadge status={log.status} /></div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Duration</h4>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {log.duration_ms 
                  ? `${(log.duration_ms / 1000).toFixed(2)}s` 
                  : isGitHubAction 
                    ? 'Processing in GitHub Actions' 
                    : 'In progress'}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Started</h4>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {format(new Date(log.started_at), 'MMM d, yyyy HH:mm:ss')}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Completed</h4>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {log.completed_at 
                  ? format(new Date(log.completed_at), 'MMM d, yyyy HH:mm:ss')
                  : 'Not completed'
                }
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Items Processed</h4>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {log.items_processed}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
              <h4 className="font-medium text-gray-700 text-sm dark:text-gray-300">Items Failed</h4>
              <div className="mt-1 text-gray-900 dark:text-gray-100">
                {log.items_failed}
              </div>
            </div>
          </div>
          
          {/* GitHub Action Info (if applicable) */}
          {isGitHubAction && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800">
              <h4 className="font-medium text-purple-800 text-sm dark:text-purple-300">GitHub Action Information</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">Workflow:</span> process-content
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">Process Type:</span> {log.status === 'initiated' ? 'Full Process' : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">Repository:</span> YourUsername/YourRepo
                  </p>
                  <a 
                    href="https://github.com/YourUsername/YourRepo/actions" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    View on GitHub →
                  </a>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {log.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
              <h4 className="font-medium text-red-800 text-sm dark:text-red-300">Error</h4>
              <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap break-words dark:text-red-400">
                {log.error}
              </pre>
            </div>
          )}
          
          {/* Log Steps */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4 dark:text-white">Execution Steps</h4>
            
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">Loading steps...</p>
              </div>
            ) : isGitHubAction ? (
              <div className="text-center py-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                <p className="text-gray-500 dark:text-gray-400">
                  Detailed steps for GitHub Actions are available in the GitHub Actions interface.
                </p>
                <a 
                  href="https://github.com/YourUsername/YourRepo/actions" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View on GitHub →
                </a>
              </div>
            ) : log.steps && log.steps.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Step</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Started</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Duration</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Message</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {log.steps.map((step) => (
                      <tr key={step.id} className="hover:bg-gray-50 group cursor-pointer dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{step.step_name}</td>
                        <td className="px-4 py-3 text-sm">
                          {step.success === true ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Success</span>
                          ) : step.success === false ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">In Progress</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(step.started_at), 'HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(2)}s` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {step.message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                <p className="text-gray-500 dark:text-gray-400">No steps available for this log.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-4 py-3 sm:px-6 bg-gray-50 flex justify-end dark:bg-gray-700">
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}