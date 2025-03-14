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
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between border-b border-gray-200">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Log Details - {log.function_name}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              ID: {log.id} | Execution ID: {log.execution_id}
            </p>
          </div>
          <button 
            onClick={onClose}
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
              <div className="mt-1"><StatusBadge status={log.status} /></div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700 text-sm">Duration</h4>
              <div className="mt-1 text-gray-900">
                {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(2)}s` : 'In progress'}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700 text-sm">Started</h4>
              <div className="mt-1 text-gray-900">
                {format(new Date(log.started_at), 'MMM d, yyyy HH:mm:ss')}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700 text-sm">Completed</h4>
              <div className="mt-1 text-gray-900">
                {log.completed_at 
                  ? format(new Date(log.completed_at), 'MMM d, yyyy HH:mm:ss')
                  : 'Not completed'
                }
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700 text-sm">Items Processed</h4>
              <div className="mt-1 text-gray-900">
                {log.items_processed}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700 text-sm">Items Failed</h4>
              <div className="mt-1 text-gray-900">
                {log.items_failed}
              </div>
            </div>
          </div>
          
          {/* Error Display */}
          {log.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 text-sm">Error</h4>
              <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap break-words">
                {log.error}
              </pre>
            </div>
          )}
          
          {/* Log Steps */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Execution Steps</h4>
            
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Loading steps...</p>
              </div>
            ) : log.steps && log.steps.length > 0 ? (
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
                    {log.steps.map((step) => (
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
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}