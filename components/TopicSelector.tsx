'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Topic = Database['public']['Tables']['content_topic']['Row']

interface TopicSelectorProps {
  selectedTopics: number[]
  onChange: (topics: number[]) => void
}

export default function TopicSelector({ selectedTopics, onChange }: TopicSelectorProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadTopics() {
      const { data } = await supabase
        .from('content_topic')
        .select('*')
        .order('name')
      
      if (data) setTopics(data)
    }
    
    loadTopics()
  }, [])

  const toggleTopic = (topicId: number) => {
    const newSelection = selectedTopics.includes(topicId)
      ? selectedTopics.filter(id => id !== topicId)
      : [...selectedTopics, topicId]
    
    onChange(newSelection)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Select your interests</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => toggleTopic(topic.id)}
            className={`p-2 rounded border ${
              selectedTopics.includes(topic.id)
                ? 'bg-primary text-white'
                : 'bg-white'
            }`}
          >
            {topic.name}
          </button>
        ))}
      </div>
    </div>
  )
}
