'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditToolModal from '@/components/EditToolModal'

type Tool = Database['public']['Tables']['content_tool']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ToolWithRelations = Tool & {
  content_tool_topics: {
    content_topic: Topic
  }[]
}

const TOOLS_PER_PAGE = 50

export default function AdminTools() {
  const [tools, setTools] = useState<ToolWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = createClient()
  const [selectedTool, setSelectedTool] = useState<ToolWithRelations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchTools = async () => {
    const { data: toolsData, count: totalCount } = await supabase
      .from('content_tool')
      .select(`
        *,
        content_tool_topics (
          content_topic (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .order('title', { ascending: true })
      .range((currentPage - 1) * TOOLS_PER_PAGE, currentPage * TOOLS_PER_PAGE - 1)

    if (toolsData) {
      setTools(toolsData as ToolWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [currentPage])

  const handleEdit = (tool: ToolWithRelations) => {
    setSelectedTool(tool)
    setIsModalOpen(true)
  }

  const handleUpdate = (updatedTool: ToolWithRelations) => {
    setTools(tools.map(tool => 
      tool.id === updatedTool.id ? updatedTool : tool
    ))
  }

  const handleDelete = async (toolId: number) => {
    if (!confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      return
    }

    try {
      // First delete related records in content_tool_topics
      const { error: topicsError } = await supabase
        .from('content_tool_topics')
        .delete()
        .eq('tool_id', toolId)

      if (topicsError) {
        throw new Error('Failed to delete tool topics')
      }

      // Then delete the tool itself
      const { error: toolError } = await supabase
        .from('content_tool')
        .delete()
        .eq('id', toolId)

      if (toolError) {
        throw new Error('Failed to delete tool')
      }

      // Update the UI
      setTools(currentTools => 
        currentTools.filter(tool => tool.id !== toolId)
      )
      setCount(prevCount => prevCount - 1)

    } catch (error) {
      console.error('Error deleting tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tool')
    }
  }

  const totalPages = Math.ceil(count / TOOLS_PER_PAGE)

  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-6">Manage Tools</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-sans">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tool</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {tools.map((tool) => (
              <tr key={tool.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium dark:text-white">{tool.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {tool.description}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a 
                    href={tool.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Visit
                  </a>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {tool.content_tool_topics.map(({ content_topic }) => (
                      <span 
                        key={content_topic.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {content_topic.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    tool.status === 'P' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    tool.status === 'D' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {tool.status === 'P' ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(tool)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * TOOLS_PER_PAGE) + 1} to {Math.min(currentPage * TOOLS_PER_PAGE, count)} of {count} results
        </div>
        <div className="flex space-x-2">
          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous
            </button>
          )}
          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {selectedTool && (
        <EditToolModal
          tool={selectedTool}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedTool(null)
          }}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
