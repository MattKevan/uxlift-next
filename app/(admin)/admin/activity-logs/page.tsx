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
    error, 
    filter, 
    setFilter, 
    pagination, 
    setPagination, 
    fetchLogs,
    fetchLogDetails
  } = useActivityLogs()
  
  const handleViewDetails = async (log: ActivityLog) => {
    setSelectedLog(log)
    
    // Only fetch details if we don't already have them
    if (!log.steps) {
      await fetchLogDetails(log.id)
    }
  }
  
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Edge Function Activity Logs</h1>
      
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
      ) : (
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