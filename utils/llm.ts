import { OpenAI } from 'openai'

const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1/'
const DEFAULT_NEBIUS_MODEL = process.env.NEBIUS_LLM_MODEL?.trim() || 'openai/gpt-oss-120b'

const nebiusApiKey = process.env.NEBIUS_API_KEY?.trim()
export const contentLlmProvider = 'nebius'
export const contentLlmModel = DEFAULT_NEBIUS_MODEL
export const hasContentLlmCredentials = Boolean(nebiusApiKey)

export const contentLlmClient = new OpenAI({
  apiKey: nebiusApiKey || '',
  baseURL: NEBIUS_BASE_URL,
})
