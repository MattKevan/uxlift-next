// components/admin/activity-logs/ActiveJobs.tsx
import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import type { Job } from '@/types/activity-logs'

interface ActiveJobsProps {
  jobs: Job[]
  loading: boolean
  onRefresh: () => void
  onViewDetails: (jobId: number) => void
}

export function ActiveJobs({ jobs, loading, onRefresh, onViewDetails }: ActiveJobsProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg dark:bg-gray-800">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Active Jobs</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Currently running processing jobs (both Edge Functions and GitHub Actions)
        </p>
        <div className="mt-4">
          <button 
            onClick={onRefresh}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {loading && (
        <div className="px-4 py-5 sm:p-6">
          <p className="text-center dark:text-gray-300">Loading...</p>
        </div>
      )}
      
      {!loading && jobs.length === 0 ? (
        <div className="px-4 py-5 sm:p-6 text-center text-gray-500 dark:text-gray-400">
          No active jobs
        </div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-6">
            {jobs.map(job => (
              <div key={job.id} className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:bg-gray-700 dark:divide-gray-600">
                <div className="px-4 py-5 sm:px-6 flex justify-between">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                      Job #{job.id}
                    </h3>
                    {job.isGithubAction && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                        GitHub Action
                      </span>
                    )}
                    {job.metadata?.process_type && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                        {job.metadata.process_type === 'feeds' ? 'Feed Processing' :
                         job.metadata.process_type === 'embed' ? 'Embedding' : 'Full Processing'}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">Started</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                          {job.started_at ? formatDistanceToNow(new Date(job.started_at)) + ' ago' : 'Pending'}
                        </dd>
                      </div>
                    </div>
                    
                    {job.isGithubAction ? (
                      // GitHub Action specific information
                      <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
                        <div className="px-4 py-5 sm:p-6">
                          <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">Process Type</dt>
                          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                            {job.metadata?.process_type === 'feeds' ? 'Feeds' : 
                             job.metadata?.process_type === 'embed' ? 'Embed' : 
                             job.metadata?.process_type === 'both' ? 'Full' : 'Unknown'}
                          </dd>
                        </div>
                      </div>
                    ) : (
                      // Edge Function specific information about batches
                      <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
                        <div className="px-4 py-5 sm:p-6">
                          <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">Current Batch</dt>
                          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                            {job.current_batch !== null ? `${job.current_batch + 1} of ${job.total_batches}` : 'N/A'}
                          </dd>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">Items Processed</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{job.processed_items}</dd>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show different info based on job type */}
                  {job.isGithubAction ? (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">GitHub Workflow</h4>
                      <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                        {job.metadata?.github_workflow || 'process-content'}
                      </p>
                      <div className="mt-3">
                        <a 
                          href="https://github.com/yourusername/yourrepo/actions" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          View on GitHub →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Site</h4>
                      <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">{job.current_site || 'N/A'}</p>
                    </div>
                  )}
                  
                  {/* Progress bar - works for both job types */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Progress</h4>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ 
                            width: job.isGithubAction
                              ? '50%' // For GitHub Actions, we don't have precise progress, so show 50%
                              : `${job.total_batches ? ((job.current_batch || 0) / job.total_batches) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Buttons to interact with job */}
                  <div className="mt-6 flex space-x-3">
                    <button 
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => onViewDetails(job.id)}
                    >
                      View Details
                    </button>
                    
                    {!job.isGithubAction && (
                      <button 
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel this job?')) {
                            alert('Job cancellation not implemented yet');
                          }
                        }}
                      >
                        Cancel Job
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}