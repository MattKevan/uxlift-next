import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import TurndownService from 'turndown'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { tagTool } from './tag-tools'
import {
  hasToolsLlmCredentials,
  toolsLlmClient,
  toolsLlmModel,
  toolsLlmProvider,
} from './llm'
import { sanitizeToolTitle } from './sanitize-tool-title'

type Tool = Database['public']['Tables']['content_tool']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ToolWithRelations = Tool & {
  content_tool_topics: {
    content_topic: Topic
  }[]
}

interface FetchToolOptions {
  user_id?: number
  status?: string
  description?: string
}

interface FetchToolResult {
  tool: ToolWithRelations
  created: boolean
}

interface ProcessedToolContent {
  title: string
  description: string
  body: string
  image: string
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
})

function convertHtmlToMarkdown(contentHtml: string): string {
  const trimmed = contentHtml.trim()
  if (!trimmed) return ''

  return turndownService
    .turndown(trimmed)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toSentenceList(sourceText: string): string[] {
  return sourceText
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function buildDeterministicToolBody(params: {
  title: string
  sourceText: string
  sourceMarkdown: string
}): string {
  const sentences = toSentenceList(params.sourceText)
  const overview = sentences[0] || `\`${params.title}\` is a software tool.`

  const featureCandidates = sentences
    .slice(1)
    .filter((sentence) => sentence.length >= 30)
    .slice(0, 5)

  const features =
    featureCandidates.length > 0
      ? featureCandidates
      : (params.sourceMarkdown
          .split('\n')
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length >= 20)
          .slice(0, 5))

  const valueProposition =
    sentences.find((sentence) =>
      /(help|improve|faster|productivity|workflow|automation|quality|scale|value)/i.test(sentence)
    ) ||
    sentences[1] ||
    'It helps teams work more effectively by reducing manual effort and making core workflows clearer.'

  const featureLines = features.length > 0
    ? features.map((feature) => `- ${feature}`)
    : ['- Core product capabilities are extracted from the source page content.']

  return [
    '## Overview',
    overview,
    '',
    '## Key Features',
    ...featureLines,
    '',
    '## Value Proposition',
    valueProposition,
  ].join('\n').trim()
}

async function rewriteToolBodyToFormattedMarkdown(params: {
  title: string
  url: string
  sourceMarkdown: string
  sourceText: string
}): Promise<string> {
  const source = params.sourceMarkdown.trim() || params.sourceText.trim()
  const deterministicFallback = buildDeterministicToolBody(params)

  if (!source) return ''
  if (!hasToolsLlmCredentials) return deterministicFallback

  try {
    const completion = await toolsLlmClient.chat.completions.create({
      model: toolsLlmModel,
      messages: [
        {
          role: 'system',
          content:
            'You rewrite scraped product content into clean, factual markdown for a UX tool directory. Keep claims grounded in source text only. Do not add unsupported facts.',
        },
        {
          role: 'user',
          content: `Rewrite this source into a polished tool profile in Markdown.

Requirements:
- Use headings and short paragraphs.
- Include sections:
  - "## Overview" (1 short paragraph)
  - "## Features" (3-6 concise bullet points)
  - An additional short paragraph of supporting text 
- Keep total length around 140-260 words.
- Preserve only information supported by source text.
- Avoid hype and marketing language. Tone should be knowledgable but friendly, as if explaining to a colleague.

Tool title: ${params.title}
URL: ${params.url}

Source content:
${source.slice(0, 12000)}`,
        },
      ],
      temperature: 0.2,
    })

    return completion.choices[0]?.message?.content?.trim() || deterministicFallback
  } catch (error) {
    console.warn('[fetchAndProcessTool] AI rewrite failed, using deterministic fallback:', {
      provider: toolsLlmProvider,
      model: toolsLlmModel,
      error,
    })
    return deterministicFallback
  }
}

async function generateShortDescriptionIfMissing(params: {
  title: string
  url: string
  sourceText: string
  fallbackBody: string
}): Promise<string> {
  if (!hasToolsLlmCredentials) {
    return toSentenceList(params.sourceText)[0]?.slice(0, 180).trim() || ''
  }

  const source = params.sourceText.trim() || params.fallbackBody.trim()
  if (!source) return ''

  try {
    const completion = await toolsLlmClient.chat.completions.create({
      model: toolsLlmModel,
      messages: [
        {
          role: 'system',
          content:
            'You write concise factual product descriptions for a UX tools directory. Keep it to one sentence.',
        },
        {
          role: 'user',
          content: `Write one concise sentence (max 180 characters) describing this tool's core value. No hype.

Tool title: ${params.title}
URL: ${params.url}
Source:
${source.slice(0, 5000)}`,
        },
      ],
      temperature: 0.2,
    })

    return completion.choices[0]?.message?.content?.replace(/\s+/g, ' ').trim() || ''
  } catch (error) {
    console.warn('[fetchAndProcessTool] AI description generation failed, using deterministic fallback:', {
      provider: toolsLlmProvider,
      model: toolsLlmModel,
      error,
    })
    return toSentenceList(params.sourceText)[0]?.slice(0, 180).trim() || ''
  }
}

export function normalizeToolUrl(urlString: string): string {
  const parsed = new URL(urlString)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use HTTP or HTTPS protocol')
  }

  parsed.hash = ''
  return parsed.toString()
}

export function getToolUrlLookupVariants(urlString: string): string[] {
  const parsed = new URL(urlString)
  const variants = new Set<string>()

  variants.add(parsed.toString())

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    const withoutTrailingSlash = new URL(parsed.toString())
    withoutTrailingSlash.pathname = withoutTrailingSlash.pathname.replace(/\/+$/, '')
    variants.add(withoutTrailingSlash.toString())
  } else if (parsed.pathname.length > 1 && !parsed.pathname.endsWith('/')) {
    const withTrailingSlash = new URL(parsed.toString())
    withTrailingSlash.pathname = `${withTrailingSlash.pathname}/`
    variants.add(withTrailingSlash.toString())
  }

  return Array.from(variants)
}

function toAbsoluteUrl(url: string | undefined | null, baseUrl: string): string | null {
  if (!url) return null

  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith('data:')) return null

  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function generateUniqueSlug(baseSlug: string, supabase: SupabaseClient<Database>) {
  const normalizedBase = baseSlug || `tool-${Date.now()}`
  let candidate = normalizedBase
  let counter = 2

  while (true) {
    const { data: existingTool } = await supabase
      .from('content_tool')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (!existingTool) {
      return candidate
    }

    candidate = `${normalizedBase}-${counter}`
    counter += 1
  }
}

async function getToolWithRelations(id: number, supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
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
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to fetch tool')
  }

  return data as ToolWithRelations
}

async function buildProcessedToolContentFromUrl(
  validUrl: string,
  options?: { description?: string }
): Promise<ProcessedToolContent> {
  const response = await fetch(validUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UXLift/1.0; +https://uxlift.org)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const pageTitle = (
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text() ||
    $('meta[name="title"]').attr('content') ||
    ''
  ).trim()

  const pageDescription = (
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    ''
  ).trim()

  const logoCandidate = (
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    ''
  ).trim()

  let rawBodyMarkdown = ''
  let bodyText = ''
  try {
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

    const virtualConsole = new VirtualConsole()
    virtualConsole.on('error', () => {})

    const dom = new JSDOM(cleanHtml, {
      url: validUrl,
      virtualConsole,
      runScripts: 'outside-only',
      pretendToBeVisual: false,
    })

    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    rawBodyMarkdown = convertHtmlToMarkdown(article?.content || '')
    bodyText = article?.textContent?.replace(/\s+/g, ' ').trim() || ''
  } catch {
    rawBodyMarkdown = convertHtmlToMarkdown($('body').html() || '')
    bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  }

  const urlObj = new URL(validUrl)
  const fallbackTitle = urlObj.hostname.replace(/^www\./, '')
  const title = sanitizeToolTitle(pageTitle || fallbackTitle, fallbackTitle)
  const body = await rewriteToolBodyToFormattedMarkdown({
    title,
    url: validUrl,
    sourceMarkdown: rawBodyMarkdown,
    sourceText: bodyText,
  })

  let description = (options?.description || '').trim() || pageDescription

  if (!description) {
    description = await generateShortDescriptionIfMissing({
      title,
      url: validUrl,
      sourceText: bodyText,
      fallbackBody: body || rawBodyMarkdown,
    })
  }

  if (!description) {
    description = bodyText.slice(0, 500) || body.slice(0, 500) || `Tool from ${fallbackTitle}`
  }

  const image = toAbsoluteUrl(logoCandidate, validUrl) || ''

  return {
    title: title.slice(0, 255),
    description: description.slice(0, 500),
    body,
    image,
  }
}

export async function fetchAndProcessTool(
  rawUrl: string,
  supabase: SupabaseClient<Database>,
  options?: FetchToolOptions
): Promise<FetchToolResult> {
  console.log('[fetchAndProcessTool] starting', {
    url: rawUrl,
    llmProvider: toolsLlmProvider,
    llmModel: toolsLlmModel,
    hasCredentials: hasToolsLlmCredentials,
  })

  const validUrl = normalizeToolUrl(rawUrl)
  const lookupUrls = getToolUrlLookupVariants(validUrl)

  const { data: existingTools } = await supabase
    .from('content_tool')
    .select('id')
    .in('link', lookupUrls)
    .limit(1)

  const existingTool = existingTools?.[0]
  if (existingTool) {
    const tool = await getToolWithRelations(existingTool.id, supabase)
    return { tool, created: false }
  }

  const processed = await buildProcessedToolContentFromUrl(validUrl, {
    description: options?.description,
  })
  const slug = await generateUniqueSlug(slugify(processed.title), supabase)

  let createdTool: { id: number } | null = null
  let createError: PostgrestError | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const toolData: Database['public']['Tables']['content_tool']['Insert'] = {
      id: Math.floor(Math.random() * 1_000_000_000),
      title: processed.title,
      description: processed.description,
      body: processed.body || null,
      link: validUrl,
      image: processed.image,
      status: options?.status || 'D',
      date: new Date().toISOString(),
      slug,
      user_id: options?.user_id || null,
    }

    const insertResult = await supabase
      .from('content_tool')
      .insert([toolData])
      .select('id')
      .single()

    if (!insertResult.error && insertResult.data) {
      createdTool = insertResult.data
      createError = null
      break
    }

    if (insertResult.error?.code !== '23505') {
      createError = insertResult.error
      break
    }

    createError = insertResult.error
  }

  if (!createdTool) {
    if (createError?.code === '23505') {
      const { data: duplicateTools } = await supabase
        .from('content_tool')
        .select('id')
        .in('link', lookupUrls)
        .limit(1)

      const duplicateTool = duplicateTools?.[0]
      if (duplicateTool) {
        const tool = await getToolWithRelations(duplicateTool.id, supabase)
        return { tool, created: false }
      }
    }

    throw new Error(createError?.message || 'Failed to create tool')
  }

  try {
    const tagResult = await tagTool(createdTool.id, supabase)
    if (!tagResult.success) {
      console.warn('[fetchAndProcessTool] Tool tagging did not complete successfully:', tagResult.error, tagResult.details)
    }
  } catch (error) {
    // Tool creation should succeed even if tagging fails.
    console.warn('[fetchAndProcessTool] Unexpected tool tagging failure:', error)
  }

  const tool = await getToolWithRelations(createdTool.id, supabase)
  return { tool, created: true }
}

export async function reprocessTool(
  toolId: number,
  supabase: SupabaseClient<Database>,
  options?: { description?: string }
): Promise<ToolWithRelations> {
  console.log('[reprocessTool] starting', { toolId })

  const { data: existingTool, error: existingToolError } = await supabase
    .from('content_tool')
    .select('id, link')
    .eq('id', toolId)
    .single()

  if (existingToolError || !existingTool) {
    throw new Error(existingToolError?.message || 'Tool not found')
  }

  const validUrl = normalizeToolUrl(existingTool.link)
  const processed = await buildProcessedToolContentFromUrl(validUrl, {
    description: options?.description,
  })

  const updatePayload: Database['public']['Tables']['content_tool']['Update'] = {
    title: processed.title,
    description: processed.description,
    body: processed.body || null,
    image: processed.image,
    link: validUrl,
  }

  const { error: updateError } = await supabase
    .from('content_tool')
    .update(updatePayload)
    .eq('id', toolId)

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update tool')
  }

  try {
    const tagResult = await tagTool(toolId, supabase)
    if (!tagResult.success) {
      console.warn('[reprocessTool] Tool tagging did not complete successfully:', tagResult.error, tagResult.details)
    }
  } catch (error) {
    console.warn('[reprocessTool] Unexpected tool tagging failure:', error)
  }

  const tool = await getToolWithRelations(toolId, supabase)
  console.log('[reprocessTool] completed', { toolId })
  return tool
}
