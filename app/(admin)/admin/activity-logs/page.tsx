'use client'

import { useState, useEffect } from 'react'
import { ActivityLogTabs } from '@/components/admin/activity-logs/ActivityLogsTabs'
import { LogsTable } from '@/components/admin/activity-logs/ActivityLogsTable'
import { ActiveJobs } from '@/components/admin/activity-logs/ActiveJobs'
import { LogDetailsModal } from '@/components/admin/activity-logs/LogDetailsModal'
import { useActivityLogs } from '@/hooks/useActivityLogs'
import type { ActivityLog } from '@/types/activity-logs'

export default function ActivityLogsPage() {
  const [activeTab, setActiveTab] = useState('logs')
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  
  const { 
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
  } = useActivityLogs()
  
  // Filter for GitHub Actions logs
  const githubActionLogs = logs.filter(log => 
    log.function_name === 'github-action' || 
    (log.job_id && activeJobs.some(job => 
      job.id === log.job_id && 
      job.metadata?.github_workflow
    ))
  );
  
  const handleViewDetails = async (log: ActivityLog) => {
    setSelectedLog(log)
    
    // Only fetch details if we don't already have them and it's not a GitHub Action log
    if (!log.steps && 
        log.function_name !== 'github-action' && 
        !(log.job_id && activeJobs.some(job => job.id === log.job_id && job.metadata?.github_workflow))) {
      await fetchLogDetails(log.id)
    }
  }
  
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Activity Logs</h1>
      
      <ActivityLogTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeJobsCount={activeJobs.length}
      />
      
      {activeTab === 'logs' ? (
        <LogsTable
          logs={logs}
          loading={loading}
          error={error}
          filter={filter}
          setFilter={setFilter}
          pagination={pagination}
          setPagination={setPagination}
          onRefresh={fetchLogs}
          onViewDetails={handleViewDetails}
        />
      ) : activeTab === 'active' ? (
        <ActiveJobs
          jobs={activeJobs}
          loading={loading}
          onRefresh={fetchLogs}
          onViewDetails={(jobId) => {
            const jobLog = logs.find(log => log.job_id === jobId)
            if (jobLog) {
              handleViewDetails(jobLog)
            }
          }}
        />
      ) : (
        // GitHub Actions Tab
        <div className="bg-white shadow overflow-hidden sm:rounded-lg dark:bg-gray-800">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">GitHub Actions</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Background processing jobs running in GitHub Actions
              </p>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={fetchLogs}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Refresh
              </button>
              
              <a 
                href="https://github.com/YourUsername/YourRepo/actions" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                View on GitHub
              </a>
            </div>
          </div>
          
          {loading ? (
            <div className="px-4 py-5 sm:p-6">
              <p className="text-center dark:text-gray-300">Loading...</p>
            </div>
          ) : githubActionLogs.length === 0 ? (
            <div className="px-4 py-5 sm:p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">No GitHub Action logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Job ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Workflow</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Started</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Process Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {githubActionLogs.map((log) => {
                    // Get associated job if available
                    const job = activeJobs.find(j => j.id === log.job_id);
                    const processType = job?.metadata?.process_type || 'unknown';
                    
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {log.job_id ? `#${log.job_id}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          process-content
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            GitHub
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            log.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {log.status === 'initiated' ? 'Running' : log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(log.started_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            processType === 'feeds' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            processType === 'embed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            processType === 'both' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {processType === 'feeds' ? 'Feed Processing' :
                             processType === 'embed' ? 'Embedding' :
                             processType === 'both' ? 'Full Processing' : 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleViewDetails(log)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Details
                          </button>
                          
                          <a 
                            href="https://github.com/YourUsername/YourRepo/actions" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 text-blue-600 hover:text-blue-900 font-medium dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View on GitHub
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Log Details Modal */}
      {selectedLog && (
        <LogDetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}