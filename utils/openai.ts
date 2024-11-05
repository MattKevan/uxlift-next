import { OpenAI } from 'openai'

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  console.error('OpenAI API key is not configured in environment variables')
}

export const openaiApi = new OpenAI({
  apiKey: apiKey || ''
})
