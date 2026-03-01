import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import TurndownService from 'turndown'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { summariseResource } from './summarise-resource'
import { tagResource } from './tag-resources'

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
  const description = pageDescription || bodyText.slice(0, 500) || `Resource from ${fallbackTitle}`
  const imagePath = toAbsoluteUrl(imageCandidate, validUrl)
  const slug = await generateUniqueSlug(slugify(title), supabase)

  let createdResource: { id: number } | null = null
  let createError: PostgrestError | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const resourceData: Database['public']['Tables']['content_resource']['Insert'] = {
      title: title.slice(0, 255),
      description: description.slice(0, 500),
      summary: '',
      body: body || null,
      link: validUrl,
      image_path: imagePath,
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
