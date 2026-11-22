import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import TurndownService from 'turndown'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { summariseResource } from './summarise-resource'
import { tagResource } from './tag-resources'
import {
  contentLlmClient,
  contentLlmModel,
  contentLlmProvider,
  hasContentLlmCredentials,
} from '@/utils/llm'
import { sanitizeToolTitle } from '@/utils/tool-tools/sanitize-tool-title'

type Resource = Database['public']['Tables']['content_resource']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ResourceCategory = Database['public']['Tables']['content_resource_category']['Row']

type ResourceWithRelations = Resource & {
  resource_category: ResourceCategory | null
  content_resource_topics: {
    content_topic: Topic
  }[]
}

interface FetchResourceOptions {
  user_id?: number
  status?: string
}

interface FetchResourceResult {
  resource: ResourceWithRelations
  created: boolean
}

interface ProcessedResourceContent {
  title: string
  description: string
  body: string
  imagePath: string | null
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

function buildDeterministicResourceBody(params: {
  title: string
  sourceText: string
  sourceMarkdown: string
}): string {
  const sentences = toSentenceList(params.sourceText)
  const overview = sentences[0] || `\`${params.title}\` is a UX-related resource.`

  const keyPoints = sentences
    .slice(1)
    .filter((sentence) => sentence.length >= 30)
    .slice(0, 5)

  const fallbackPoints =
    keyPoints.length > 0
      ? keyPoints
      : params.sourceMarkdown
          .split('\n')
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length >= 20)
          .slice(0, 5)

  const whyItMatters =
    sentences.find((sentence) =>
      /(help|improve|learn|understand|practice|research|strategy|design)/i.test(sentence)
    ) ||
    sentences[1] ||
    'It is useful for improving UX knowledge and practical design decisions.'

  const pointLines =
    fallbackPoints.length > 0
      ? fallbackPoints.map((point) => `- ${point}`)
      : ['- Key points were extracted from the source page content.']

  return [
    '## Overview',
    overview,
    '',
    '## Key Points',
    ...pointLines,
    '',
    '## Why It Matters',
    whyItMatters,
  ].join('\n').trim()
}

async function rewriteResourceBodyToFormattedMarkdown(params: {
  title: string
  url: string
  sourceMarkdown: string
  sourceText: string
}): Promise<string> {
  const source = params.sourceMarkdown.trim() || params.sourceText.trim()
  const deterministicFallback = buildDeterministicResourceBody(params)

  if (!source) return ''
  if (!hasContentLlmCredentials) return deterministicFallback

  try {
    const completion = await contentLlmClient.chat.completions.create({
      model: contentLlmModel,
      messages: [
        {
          role: 'system',
          content:
            'You rewrite scraped article/resource content into clean, factual markdown for a UX resource directory. Keep claims grounded in source text only.',
        },
        {
          role: 'user',
          content: `Rewrite this source into a polished resource profile in Markdown.

Requirements:
- Use headings and short paragraphs.
- Include sections:
  - "## Overview" (1 short paragraph)
  - "## Key Points" (3-6 concise bullet points)
  - "## Why It Matters" (1 short paragraph)
- Keep total length around 160-320 words.
- Preserve only information supported by source text.
- Avoid hype and marketing language.

Resource title: ${params.title}
URL: ${params.url}

Source content:
${source.slice(0, 12000)}`,
        },
      ],
      temperature: 0.2,
    })

    return completion.choices[0]?.message?.content?.trim() || deterministicFallback
  } catch (error) {
    console.warn('[fetchAndProcessResource] AI rewrite failed, using deterministic fallback:', {
      provider: contentLlmProvider,
      model: contentLlmModel,
      error,
    })
    return deterministicFallback
  }
}

export function normalizeResourceUrl(urlString: string): string {
  const parsed = new URL(urlString)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use HTTP or HTTPS protocol')
  }

  parsed.hash = ''
  return parsed.toString()
}

export function getResourceUrlLookupVariants(urlString: string): string[] {
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
  const normalizedBase = baseSlug || `resource-${Date.now()}`
  let candidate = normalizedBase
  let counter = 2

  while (true) {
    const { data: existingResource } = await supabase
      .from('content_resource')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (!existingResource) {
      return candidate
    }

    candidate = `${normalizedBase}-${counter}`
    counter += 1
  }
}

async function getResourceWithRelations(id: number, supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from('content_resource')
    .select(`
      *,
      resource_category:content_resource_category (
        id,
        name,
        slug,
        description,
        sort_order
      ),
      content_resource_topics (
        content_topic:content_topic (
          id,
          name,
          slug,
          description
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to fetch resource')
  }

  return data as ResourceWithRelations
}

async function buildProcessedResourceContentFromUrl(validUrl: string): Promise<ProcessedResourceContent> {
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

  const imageCandidate = (
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    $('link[rel="icon"]').attr('href') ||
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
  const body = await rewriteResourceBodyToFormattedMarkdown({
    title,
    url: validUrl,
    sourceMarkdown: rawBodyMarkdown,
    sourceText: bodyText,
  })
  const description = pageDescription || bodyText.slice(0, 500) || `Resource from ${fallbackTitle}`
  const imagePath = toAbsoluteUrl(imageCandidate, validUrl)

  return {
    title: title.slice(0, 255),
    description: description.slice(0, 500),
    body,
    imagePath,
  }
}

export async function fetchAndProcessResource(
  rawUrl: string,
  supabase: SupabaseClient<Database>,
  options?: FetchResourceOptions
): Promise<FetchResourceResult> {
  const validUrl = normalizeResourceUrl(rawUrl)
  const lookupUrls = getResourceUrlLookupVariants(validUrl)

  const { data: existingResources } = await supabase
    .from('content_resource')
    .select('id')
    .in('link', lookupUrls)
    .limit(1)

  const existingResource = existingResources?.[0]
  if (existingResource) {
    const resource = await getResourceWithRelations(existingResource.id, supabase)
    return { resource, created: false }
  }

  const processed = await buildProcessedResourceContentFromUrl(validUrl)
  const slug = await generateUniqueSlug(slugify(processed.title), supabase)

  let createdResource: { id: number } | null = null
  let createError: PostgrestError | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const resourceData: Database['public']['Tables']['content_resource']['Insert'] = {
      title: processed.title,
      description: processed.description,
      summary: '',
      body: processed.body || null,
      link: validUrl,
      image_path: processed.imagePath,
      status: options?.status || 'draft',
      date_created: new Date().toISOString(),
      date_published: new Date().toISOString(),
      slug,
      user_id: options?.user_id || null,
      resource_category_id: null,
    }

    const insertResult = await supabase
      .from('content_resource')
      .insert([resourceData])
      .select('id')
      .single()

    if (!insertResult.error && insertResult.data) {
      createdResource = insertResult.data
      createError = null
      break
    }

    if (insertResult.error?.code !== '23505') {
      createError = insertResult.error
      break
    }

    createError = insertResult.error
  }

  if (!createdResource) {
    if (createError?.code === '23505') {
      const { data: duplicateResources } = await supabase
        .from('content_resource')
        .select('id')
        .in('link', lookupUrls)
        .limit(1)

      const duplicateResource = duplicateResources?.[0]
      if (duplicateResource) {
        const resource = await getResourceWithRelations(duplicateResource.id, supabase)
        return { resource, created: false }
      }
    }

    throw new Error(createError?.message || 'Failed to create resource')
  }

  try {
    await summariseResource(createdResource.id, supabase)
  } catch {
    // Resource creation should still succeed if summary fails.
  }

  try {
    await tagResource(createdResource.id, supabase)
  } catch {
    // Resource creation should still succeed if tagging fails.
  }

  const resource = await getResourceWithRelations(createdResource.id, supabase)
  return { resource, created: true }
}

export async function reprocessResource(
  resourceId: number,
  supabase: SupabaseClient<Database>
): Promise<ResourceWithRelations> {
  const { data: existingResource, error: existingResourceError } = await supabase
    .from('content_resource')
    .select('id, link')
    .eq('id', resourceId)
    .single()

  if (existingResourceError || !existingResource) {
    throw new Error(existingResourceError?.message || 'Resource not found')
  }

  const validUrl = normalizeResourceUrl(existingResource.link)
  const processed = await buildProcessedResourceContentFromUrl(validUrl)

  const updatePayload: Database['public']['Tables']['content_resource']['Update'] = {
    title: processed.title,
    description: processed.description,
    body: processed.body || null,
    image_path: processed.imagePath,
    link: validUrl,
  }

  const { error: updateError } = await supabase
    .from('content_resource')
    .update(updatePayload)
    .eq('id', resourceId)

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update resource')
  }

  try {
    await summariseResource(resourceId, supabase)
  } catch {
    // Resource update should still succeed if summary fails.
  }

  try {
    await tagResource(resourceId, supabase)
  } catch {
    // Resource update should still succeed if tagging fails.
  }

  return getResourceWithRelations(resourceId, supabase)
}
