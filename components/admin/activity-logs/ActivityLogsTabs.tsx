// components/admin/activity-logs/ActivityLogTabs.tsx
import React from 'react'

interface ActivityLogTabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  activeJobsCount: number
}

export function ActivityLogTabs({ 
  activeTab, 
  setActiveTab, 
  activeJobsCount 
}: ActivityLogTabsProps) {
  return (
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
            Active Jobs ({activeJobsCount})
          </button>
        </nav>
      </div>
    </div>
  )
}