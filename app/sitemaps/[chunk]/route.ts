import {
  createSitemapClient,
  getCacheControl,
  getChunkUrlEntries,
  getEtag,
  matchesEtag,
  parseChunkId,
  renderUrlSetXml,
} from '@/lib/sitemap/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ chunk: string }>
}

export async function GET(request: Request, context: RouteContext) {
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

    if (matchesEtag(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers })
    }

    return new Response(xml, { status: 200, headers })
  } catch (error) {
    console.error('Sitemap chunk generation failed:', error)
    return new Response('Sitemap generation failed', { status: 500 })
  }
}
