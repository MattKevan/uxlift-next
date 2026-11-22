import {
  createSitemapClient,
  getCacheControl,
  getChunkUrlEntries,
  getEtag,
  getSourceState,
  parseChunkId,
  renderUrlSetXml,
  SITEMAP_SOURCE_ORDER,
} from '@/lib/sitemap/core'

export const runtime = 'nodejs'
export const revalidate = 3600

type RouteContext = {
  params: Promise<{ chunk: string }>
}

export async function generateStaticParams() {
  const supabase = createSitemapClient()
  const states = await Promise.all(
    SITEMAP_SOURCE_ORDER.map((key) => getSourceState(supabase, key)),
  )

  return states.flatMap((state) =>
    Array.from({ length: state.chunkCount }, (_, page) => ({
      chunk: `${state.key}-${page}.xml`,
    })),
  )
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { chunk } = await context.params
    const parsed = parseChunkId(chunk)

    if (!parsed) {
      return new Response('Not found', { status: 404 })
    }

    const supabase = createSitemapClient()
    const entries = await getChunkUrlEntries(supabase, parsed.key, parsed.page)

    if (!entries.length) {
      return new Response('Not found', { status: 404 })
    }

    const xml = renderUrlSetXml(entries)
    const etag = getEtag(`${chunk}:${xml}`)
    const headers = new Headers({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': getCacheControl(),
      ETag: etag,
    })

    return new Response(xml, { status: 200, headers })
  } catch (error) {
    console.error('Sitemap chunk generation failed:', error)
    return new Response('Sitemap generation failed', { status: 500 })
  }
}
