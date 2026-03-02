import { createHash } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export type SitemapSourceKey =
  | 'static'
  | 'articles'
  | 'tools'
  | 'resources'
  | 'topics'
  | 'sites'
  | 'newsletter'

type Filter =
  | { op: 'eq'; column: string; value: string | number | boolean }
  | { op: 'not'; column: string; operator: string; value: string | number | boolean | null }

type StaticEntry = {
  path: string
  changefreq: ChangeFreq
  priority: number
}

type DynamicSource = {
  key: Exclude<SitemapSourceKey, 'static'>
  table: string
  slugField: string
  lastmodField?: string
  pathPrefix: string
  changefreq: ChangeFreq
  priority: number
  filters: Filter[]
}

export type SourceState = {
  key: SitemapSourceKey
  count: number
  chunkCount: number
  lastmod: string | null
  version: string
}

export type UrlEntry = {
  loc: string
  lastmod?: string
  changefreq?: ChangeFreq
  priority?: number
}

const SITEMAP_SITE_URL = (process.env.SITE_URL || 'https://www.uxlift.org').replace(/\/+$/, '')
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SITEMAP_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24
export const SITEMAP_STALE_WHILE_REVALIDATE_SECONDS = 60 * 60 * 6
export const SITEMAP_CHUNK_SIZE = 1000

const STATIC_ENTRIES: StaticEntry[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/news/', changefreq: 'daily', priority: 0.8 },
  { path: '/tools/', changefreq: 'weekly', priority: 0.7 },
  { path: '/topics/', changefreq: 'weekly', priority: 0.6 },
  { path: '/resources/', changefreq: 'weekly', priority: 0.7 },
  { path: '/books/', changefreq: 'weekly', priority: 0.7 },
  { path: '/sites/', changefreq: 'weekly', priority: 0.6 },
  { path: '/publications/', changefreq: 'weekly', priority: 0.7 },
  { path: '/newsletter/', changefreq: 'weekly', priority: 0.7 },
  { path: '/search/', changefreq: 'daily', priority: 0.5 },
  { path: '/cookies/', changefreq: 'yearly', priority: 0.3 },
  { path: '/privacy/', changefreq: 'yearly', priority: 0.3 },
]

const DYNAMIC_SOURCES: Record<Exclude<SitemapSourceKey, 'static'>, DynamicSource> = {
  articles: {
    key: 'articles',
    table: 'content_post',
    slugField: 'slug',
    lastmodField: 'date_published',
    pathPrefix: '/articles',
    changefreq: 'daily',
    priority: 0.9,
    filters: [
      { op: 'eq', column: 'status', value: 'published' },
      { op: 'not', column: 'slug', operator: 'is', value: null },
    ],
  },
  tools: {
    key: 'tools',
    table: 'content_tool',
    slugField: 'slug',
    lastmodField: 'date',
    pathPrefix: '/tools',
    changefreq: 'weekly',
    priority: 0.7,
    filters: [
      { op: 'eq', column: 'status', value: 'published' },
      { op: 'not', column: 'slug', operator: 'is', value: null },
    ],
  },
  resources: {
    key: 'resources',
    table: 'content_resource',
    slugField: 'slug',
    lastmodField: 'date_published',
    pathPrefix: '/resources',
    changefreq: 'weekly',
    priority: 0.7,
    filters: [
      { op: 'eq', column: 'status', value: 'published' },
      { op: 'not', column: 'slug', operator: 'is', value: null },
    ],
  },
  topics: {
    key: 'topics',
    table: 'content_topic',
    slugField: 'slug',
    pathPrefix: '/topics',
    changefreq: 'weekly',
    priority: 0.6,
    filters: [{ op: 'not', column: 'slug', operator: 'is', value: null }],
  },
  sites: {
    key: 'sites',
    table: 'content_site',
    slugField: 'slug',
    pathPrefix: '/sites',
    changefreq: 'weekly',
    priority: 0.6,
    filters: [
      { op: 'eq', column: 'status', value: 'P' },
      { op: 'not', column: 'slug', operator: 'is', value: null },
    ],
  },
  newsletter: {
    key: 'newsletter',
    table: 'newsletter_posts',
    slugField: 'slug',
    lastmodField: 'publish_date',
    pathPrefix: '/newsletter',
    changefreq: 'weekly',
    priority: 0.7,
    filters: [
      { op: 'eq', column: 'status', value: 'confirmed' },
      { op: 'not', column: 'slug', operator: 'is', value: null },
    ],
  },
}

export const SITEMAP_SOURCE_ORDER: SitemapSourceKey[] = [
  'static',
  'articles',
  'tools',
  'resources',
  'topics',
  'sites',
  'newsletter',
]

const normalizePath = (path: string): string => {
  if (path === '/') return '/'
  if (/\/[^/]+\.[^/]+$/.test(path)) return path
  return path.endsWith('/') ? path : `${path}/`
}

const normalizeIsoDate = (value?: string | null): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const applyFilters = (query: any, filters: Filter[]) => {
  return filters.reduce((acc, filter) => {
    if (filter.op === 'eq') {
      return acc.eq(filter.column, filter.value)
    }
    return acc.not(filter.column, filter.operator, filter.value)
  }, query)
}

const parsePositiveInt = (value: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.floor(parsed)
}

export const createSitemapClient = (): SupabaseClient => {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
}

export const toAbsoluteUrl = (path: string): string => `${SITEMAP_SITE_URL}${normalizePath(path)}`

export const getCacheControl = (): string =>
  `public, s-maxage=${SITEMAP_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${SITEMAP_STALE_WHILE_REVALIDATE_SECONDS}`

export const getEtag = (value: string): string => `"${createHash('sha1').update(value).digest('hex')}"`

export const matchesEtag = (ifNoneMatchHeader: string | null, etag: string): boolean => {
  if (!ifNoneMatchHeader) return false

  const accepted = ifNoneMatchHeader
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return accepted.includes(etag) || accepted.includes(`W/${etag}`)
}

export const parseChunkId = (chunk: string): { key: SitemapSourceKey; page: number } | null => {
  const match = /^([a-z]+)-(\d+)\.xml$/.exec(chunk)
  if (!match) return null

  const key = match[1] as SitemapSourceKey
  const page = parsePositiveInt(match[2])

  if (!SITEMAP_SOURCE_ORDER.includes(key)) {
    return null
  }

  return { key, page }
}

export const getSourceState = async (
  supabase: SupabaseClient,
  key: SitemapSourceKey
): Promise<SourceState> => {
  if (key === 'static') {
    const version = `count:${STATIC_ENTRIES.length}`
    return {
      key,
      count: STATIC_ENTRIES.length,
      chunkCount: 1,
      lastmod: null,
      version,
    }
  }

  const source = DYNAMIC_SOURCES[key]

  const countQuery = applyFilters(
    supabase.from(source.table).select('id', { count: 'exact', head: true }),
    source.filters
  )
  const [countResult, latestIdResult, latestLastmodResult] = await Promise.all([
    countQuery,
    applyFilters(
      supabase.from(source.table).select('id').order('id', { ascending: false }).limit(1),
      source.filters
    ),
    source.lastmodField
      ? applyFilters(
          supabase
            .from(source.table)
            .select(source.lastmodField)
            .order(source.lastmodField, { ascending: false, nullsFirst: false })
            .limit(1),
          source.filters
        )
      : Promise.resolve({ data: null, error: null }),
  ])

  if (countResult.error) throw countResult.error
  if (latestIdResult.error) throw latestIdResult.error
  if (latestLastmodResult && 'error' in latestLastmodResult && latestLastmodResult.error) {
    throw latestLastmodResult.error
  }

  const count = countResult.count || 0
  const chunkCount = count > 0 ? Math.ceil(count / SITEMAP_CHUNK_SIZE) : 0
  const latestId = latestIdResult.data?.[0]?.id ?? 'none'
  const latestLastmodValue = source.lastmodField
    ? (latestLastmodResult as { data: Record<string, string | null>[] | null }).data?.[0]?.[
        source.lastmodField
      ]
    : null
  const lastmod = normalizeIsoDate((latestLastmodValue as string | null) || null)
  const version = `count:${count};maxId:${latestId};lastmod:${lastmod || 'none'}`

  return {
    key,
    count,
    chunkCount,
    lastmod,
    version,
  }
}

export const getSitemapIndexEntries = async (supabase: SupabaseClient): Promise<UrlEntry[]> => {
  const states = await Promise.all(SITEMAP_SOURCE_ORDER.map((key) => getSourceState(supabase, key)))
  const entries: UrlEntry[] = []

  for (const state of states) {
    for (let page = 0; page < state.chunkCount; page += 1) {
      entries.push({
        loc: toAbsoluteUrl(`/sitemaps/${state.key}-${page}.xml`),
        lastmod: state.lastmod || undefined,
      })
    }
  }

  return entries
}

export const getSitemapIndexVersion = async (supabase: SupabaseClient): Promise<string> => {
  const states = await Promise.all(SITEMAP_SOURCE_ORDER.map((key) => getSourceState(supabase, key)))
  return states.map((state) => `${state.key}:${state.version}`).join('|')
}

export const getChunkUrlEntries = async (
  supabase: SupabaseClient,
  key: SitemapSourceKey,
  page: number
): Promise<UrlEntry[]> => {
  if (key === 'static') {
    if (page > 0) {
      return []
    }

    return STATIC_ENTRIES.map((entry) => ({
      loc: toAbsoluteUrl(entry.path),
      changefreq: entry.changefreq,
      priority: entry.priority,
    }))
  }

  const source = DYNAMIC_SOURCES[key]
  const state = await getSourceState(supabase, key)
  if (page >= state.chunkCount) {
    return []
  }

  const start = page * SITEMAP_CHUNK_SIZE
  const end = start + SITEMAP_CHUNK_SIZE - 1
  const selectColumns = source.lastmodField
    ? `${source.slugField}, ${source.lastmodField}`
    : source.slugField

  const query = applyFilters(
    supabase
      .from(source.table)
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(start, end),
    source.filters
  )

  const { data, error } = await query
  if (error) throw error

  const rows = ((data || []) as Record<string, string | null>[])
    .map((row) => ({
      slug: row[source.slugField] as string,
      lastmod: source.lastmodField ? (row[source.lastmodField] as string | null) : null,
    }))
    .filter((row) => typeof row.slug === 'string' && row.slug.length > 0)

  return rows.map((row) => ({
    loc: toAbsoluteUrl(`${source.pathPrefix}/${encodeURIComponent(row.slug)}`),
    lastmod: normalizeIsoDate(row.lastmod || undefined) || undefined,
    changefreq: source.changefreq,
    priority: source.priority,
  }))
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export const renderSitemapIndexXml = (entries: UrlEntry[]): string => {
  const items = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
      return `<sitemap><loc>${escapeXml(entry.loc)}</loc>${lastmod}</sitemap>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`
}

export const renderUrlSetXml = (entries: UrlEntry[]): string => {
  const items = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
      const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ''
      const priority = typeof entry.priority === 'number' ? `<priority>${entry.priority.toFixed(1)}</priority>` : ''
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}${changefreq}${priority}</url>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`
}
