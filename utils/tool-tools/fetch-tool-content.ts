import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import TurndownService from 'turndown'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { tagTool } from './tag-tools'

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
}

interface FetchToolResult {
  tool: ToolWithRelations
  created: boolean
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

export async function fetchAndProcessTool(
  rawUrl: string,
  supabase: SupabaseClient<Database>,
  options?: FetchToolOptions
): Promise<FetchToolResult> {
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

  let body = ''
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

    body = convertHtmlToMarkdown(article?.content || '')
    bodyText = article?.textContent?.replace(/\s+/g, ' ').trim() || ''
  } catch {
    body = convertHtmlToMarkdown($('body').html() || '')
    bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  }

  const urlObj = new URL(validUrl)
  const fallbackTitle = urlObj.hostname.replace(/^www\./, '')
  const title = pageTitle || fallbackTitle
  const description =
    pageDescription || bodyText.slice(0, 500) || body.slice(0, 500) || `Tool from ${fallbackTitle}`
  const image = toAbsoluteUrl(logoCandidate, validUrl) || ''
  const slug = await generateUniqueSlug(slugify(title), supabase)

  let createdTool: { id: number } | null = null
  let createError: PostgrestError | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const toolData: Database['public']['Tables']['content_tool']['Insert'] = {
      id: Math.floor(Math.random() * 1_000_000_000),
      title: title.slice(0, 255),
      description: description.slice(0, 500),
      body: body || null,
      link: validUrl,
      image,
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
    await tagTool(createdTool.id, supabase)
  } catch {
    // Tool creation should succeed even if tagging fails.
  }

  const tool = await getToolWithRelations(createdTool.id, supabase)
  return { tool, created: true }
}
