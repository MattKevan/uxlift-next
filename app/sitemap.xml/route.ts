import {
  createSitemapClient,
  getCacheControl,
  getEtag,
  getSitemapIndexEntries,
  getSitemapIndexVersion,
  renderSitemapIndexXml,
} from '@/lib/sitemap/core'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET() {
  try {
    const supabase = createSitemapClient()
    const [entries, version] = await Promise.all([
      getSitemapIndexEntries(supabase),
      getSitemapIndexVersion(supabase),
    ])

    const xml = renderSitemapIndexXml(entries)
    const etag = getEtag(`index:${version}:${xml}`)
    const headers = new Headers({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': getCacheControl(),
      ETag: etag,
    })

    return new Response(xml, { status: 200, headers })
  } catch (error) {
    console.error('Sitemap index generation failed:', error)
    return new Response('Sitemap generation failed', { status: 500 })
  }
}
