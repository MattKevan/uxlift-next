const createClient = require('./utils/supabase/sitemap-client')
// or if your file is in a different location, adjust the path accordingly
// const { createClient } = require('./app/utils/supabase/server')

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || 'https://www.uxlift.org',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: [
    '/api/*',
    '/admin/*',
    '/login',
    '/signup',
    '/reset-password',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/*', '/admin/*', '/login', '/signup', '/reset-password']
      }
    ]
  },
  transform: async (config, path) => {
    // Return undefined for paths you want to exclude
    if (path.startsWith('/api/') || path.startsWith('/admin/')) {
      return undefined
    }

    const defaultTransform = {
      loc: path,
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date().toISOString(),
      alternateRefs: [],
    }

    if (path.startsWith('/posts/')) {
      return {
        ...defaultTransform,
        changefreq: 'daily',
        priority: 0.8,
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
    const results = []

    try {
      // Fetch and add posts
      const { data: posts } = await supabase
        .from('content_post')
        .select('slug, date_published')
        .eq('status', 'published')
        .not('slug', 'is', null)

      posts?.forEach((post) => {
        results.push({
          loc: `/posts/${post.slug}`,
          lastmod: post.date_published || new Date().toISOString(),
          changefreq: 'daily',
          priority: 0.8,
        })
      })

      // Fetch and add tools
      const { data: tools } = await supabase
        .from('content_tool')
        .select('slug, date')
        .eq('status', 'published')

      tools?.forEach((tool) => {
        results.push({
          loc: `/tools/${tool.slug}`,
          lastmod: tool.date,
          changefreq: 'weekly',
          priority: 0.7,
        })
      })

      // Fetch and add resources
      const { data: resources } = await supabase
        .from('content_resource')
        .select('slug, date_published')
        .eq('status', 'published')
        .not('slug', 'is', null)

      resources?.forEach((resource) => {
        results.push({
          loc: `/resources/${resource.slug}`,
          lastmod: resource.date_published || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        })
      })

      // Fetch and add topics
      const { data: topics } = await supabase
        .from('content_topic')
        .select('slug')

      topics?.forEach((topic) => {
        results.push({
          loc: `/topics/${topic.slug}`,
          lastmod: new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.6,
        })
      })

    } catch (error) {
      console.error('Error generating sitemap:', error)
    }

    return results
  },
}

module.exports = config
