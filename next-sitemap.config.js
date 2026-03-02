const createClient = require('./utils/supabase/sitemap-client')

const FETCH_PAGE_SIZE = 1000

const STATIC_PUBLIC_PATHS = [
  '/',
  '/news/',
  '/tools/',
  '/topics/',
  '/resources/',
  '/books/',
  '/sites/',
  '/publications/',
  '/newsletter/',
  '/search/',
  '/cookies/',
  '/privacy/',
]

const addOrReplacePath = (map, entry) => {
  if (!entry?.loc) return
  map.set(entry.loc, entry)
}

const pathEntry = (loc, overrides = {}) => ({
  loc,
  lastmod: new Date().toISOString(),
  changefreq: 'weekly',
  priority: 0.7,
  ...overrides,
})

const buildQuery = (supabase, config) => {
  let query = supabase.from(config.table).select(config.select)

  for (const [method, ...args] of config.filters || []) {
    query = query[method](...args)
  }

  if (config.orderBy) {
    query = query.order(config.orderBy, { ascending: true })
  }

  return query
}

const fetchAllRows = async (supabase, queryConfig) => {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + FETCH_PAGE_SIZE - 1
    const { data, error } = await buildQuery(supabase, queryConfig).range(from, to)

    if (error) {
      throw error
    }

    if (!data?.length) {
      break
    }

    allRows.push(...data)

    if (data.length < FETCH_PAGE_SIZE) {
      break
    }

    from += FETCH_PAGE_SIZE
  }

  return allRows
}

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || 'https://www.uxlift.org',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: [
    '/api/*',
    '/admin/*',
    '/auth/*',
    '/confirm',
    '/confirmed',
    '/feed',
    '/forgot-password',
    '/login',
    '/opengraph-image.png',
    '/profile/*',
    '/protected/*',
    '/sign-in',
    '/sign-up',
    '/signup',
    '/reset-password',
    '/twitter-image.png',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/*',
          '/admin/*',
          '/auth/*',
          '/confirm',
          '/confirmed',
          '/feed',
          '/forgot-password',
          '/login',
          '/profile/*',
          '/protected/*',
          '/reset-password',
          '/sign-in',
          '/sign-up',
          '/signup',
        ]
      }
    ]
  },
  transform: async (config, path) => {
    // Return undefined for paths you want to exclude
    if (
      path.startsWith('/api/') ||
      path.startsWith('/admin/') ||
      path.startsWith('/auth/') ||
      path.startsWith('/profile/') ||
      path.startsWith('/protected/')
    ) {
      return undefined
    }

    const defaultTransform = {
      loc: path,
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date().toISOString(),
      alternateRefs: [],
    }

    if (path === '/') {
      return {
        ...defaultTransform,
        changefreq: 'daily',
        priority: 1.0,
      }
    }

    if (path.startsWith('/articles/')) {
      return {
        ...defaultTransform,
        changefreq: 'daily',
        priority: 0.9,
      }
    }

    if (path.startsWith('/topics/')) {
      return {
        ...defaultTransform,
        changefreq: 'weekly',
        priority: 0.6,
      }
    }

    if (path.startsWith('/tools/')) {
      return {
        ...defaultTransform,
        changefreq: 'weekly',
        priority: 0.7,
      }
    }

    if (path.startsWith('/sites/')) {
      return {
        ...defaultTransform,
        changefreq: 'weekly',
        priority: 0.6,
      }
    }

    if (path.startsWith('/newsletter/')) {
      return {
        ...defaultTransform,
        changefreq: 'weekly',
        priority: 0.7,
      }
    }

    if (path.startsWith('/resources/')) {
      return {
        ...defaultTransform,
        changefreq: 'weekly',
        priority: 0.7,
      }
    }

    return defaultTransform
  },

  additionalPaths: async (config) => {
    const supabase = await createClient()
    const paths = new Map()

    try {
      STATIC_PUBLIC_PATHS.forEach((path) => addOrReplacePath(paths, pathEntry(path)))

      const [
        posts,
        tools,
        resources,
        topics,
        sites,
        newsletters,
      ] = await Promise.all([
        fetchAllRows(supabase, {
          table: 'content_post',
          select: 'slug, date_published',
          filters: [
            ['eq', 'status', 'published'],
            ['not', 'slug', 'is', null],
          ],
          orderBy: 'id',
        }),
        fetchAllRows(supabase, {
          table: 'content_tool',
          select: 'slug, date',
          filters: [
            ['eq', 'status', 'published'],
            ['not', 'slug', 'is', null],
          ],
          orderBy: 'id',
        }),
        fetchAllRows(supabase, {
          table: 'content_resource',
          select: 'slug, date_published',
          filters: [
            ['eq', 'status', 'published'],
            ['not', 'slug', 'is', null],
          ],
          orderBy: 'id',
        }),
        fetchAllRows(supabase, {
          table: 'content_topic',
          select: 'slug',
          filters: [['not', 'slug', 'is', null]],
          orderBy: 'id',
        }),
        fetchAllRows(supabase, {
          table: 'content_site',
          select: 'slug',
          filters: [
            ['eq', 'status', 'P'],
            ['not', 'slug', 'is', null],
          ],
          orderBy: 'id',
        }),
        fetchAllRows(supabase, {
          table: 'newsletter_posts',
          select: 'slug, publish_date',
          filters: [
            ['eq', 'status', 'confirmed'],
            ['not', 'slug', 'is', null],
          ],
          orderBy: 'id',
        }),
      ])

      // Fetch and add posts
      posts?.forEach((post) => {
        addOrReplacePath(paths, pathEntry(`/articles/${encodeURIComponent(post.slug)}`, {
          lastmod: post.date_published || new Date().toISOString(),
          changefreq: 'daily',
          priority: 0.9,
        }))
      })

      // Fetch and add tools
      tools?.forEach((tool) => {
        addOrReplacePath(paths, pathEntry(`/tools/${encodeURIComponent(tool.slug)}`, {
          lastmod: tool.date,
          changefreq: 'weekly',
          priority: 0.7,
        }))
      })

      // Fetch and add resources
      resources?.forEach((resource) => {
        addOrReplacePath(paths, pathEntry(`/resources/${encodeURIComponent(resource.slug)}`, {
          lastmod: resource.date_published || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        }))
      })

      // Fetch and add topics
      topics?.forEach((topic) => {
        addOrReplacePath(paths, pathEntry(`/topics/${encodeURIComponent(topic.slug)}`, {
          lastmod: new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.6,
        }))
      })

      // Fetch and add sites
      sites?.forEach((site) => {
        addOrReplacePath(paths, pathEntry(`/sites/${encodeURIComponent(site.slug)}`, {
          changefreq: 'weekly',
          priority: 0.6,
        }))
      })

      // Fetch and add newsletter editions
      newsletters?.forEach((edition) => {
        addOrReplacePath(paths, pathEntry(`/newsletter/${encodeURIComponent(edition.slug)}`, {
          lastmod: edition.publish_date || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        }))
      })

    } catch (error) {
      console.error('Error generating sitemap:', error)
    }

    return Array.from(paths.values())
  },
}

module.exports = config
