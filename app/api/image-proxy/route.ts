import { NextRequest } from 'next/server'

const ONE_DAY_IN_SECONDS = 60 * 60 * 24
const FALLBACK_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f3f4f6"/></svg>`

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase()

  if (value === 'localhost' || value === '::1' || value.endsWith('.local')) {
    return true
  }

  if (/^(127\.|10\.|192\.168\.)/.test(value)) {
    return true
  }

  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
}

function fallbackImageResponse() {
  return new Response(FALLBACK_IMAGE, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${ONE_DAY_IN_SECONDS}, s-maxage=${ONE_DAY_IN_SECONDS}, stale-while-revalidate=604800`,
    },
  })
}

export async function GET(request: NextRequest) {
  const encodedUrl = request.nextUrl.searchParams.get('url')
  if (!encodedUrl) {
    return new Response('Missing "url" parameter', { status: 400 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(encodedUrl)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new Response('Only HTTP(S) URLs are supported', { status: 400 })
  }

  if (isBlockedHostname(targetUrl.hostname)) {
    return new Response('Hostname is not allowed', { status: 400 })
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      next: { revalidate: ONE_DAY_IN_SECONDS },
    })

    if (!upstreamResponse.ok) {
      return fallbackImageResponse()
    }

    const contentType = upstreamResponse.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      return fallbackImageResponse()
    }

    const body = await upstreamResponse.arrayBuffer()
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set(
      'Cache-Control',
      `public, max-age=${ONE_DAY_IN_SECONDS}, s-maxage=${ONE_DAY_IN_SECONDS}, stale-while-revalidate=604800`
    )

    const contentLength = upstreamResponse.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    const eTag = upstreamResponse.headers.get('etag')
    if (eTag) headers.set('ETag', eTag)

    return new Response(body, { status: 200, headers })
  } catch {
    return fallbackImageResponse()
  }
}
