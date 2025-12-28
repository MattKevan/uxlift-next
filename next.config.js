/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static exports if needed
    // output: 'export',
  
    // Ensure trailing slashes are handled consistently
    trailingSlash: true,
  
    // Configure domains for images if using next/image
    images: {
      domains: [
        'uxlift.org',
        'localhost:3000'
        // Add any other domains you load images from
      ],
      // Optional: Configure remote patterns for more flexible image sources
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**.uxlift.org',
        },
      ],
    },
  
    // Configure redirects from old URLs if needed
    async redirects() {
      return [
        // Example redirect
        // {
        //   source: '/old-path',
        //   destination: '/new-path',
        //   permanent: true,
        // },
      ]
    },
  
    // Configure headers for security and caching
    async headers() {
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      // More permissive CSP for development, strict for production
      const cspValue = isDevelopment 
        ? `
            default-src 'self' 'unsafe-eval' 'unsafe-inline';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http: localhost:*;
            style-src 'self' 'unsafe-inline' https: http: localhost:*;
            img-src 'self' blob: data: https: http: localhost:*;
            font-src 'self' https: http: data: localhost:*;
            connect-src 'self' https: http: ws: wss: localhost:*;
            frame-src 'self' https: http: localhost:*;
          `
        : `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://beamanalytics.b-cdn.net https://embeds.beehiiv.com;
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            img-src 'self' blob: data: https: http:;
            font-src 'self' https://fonts.gstatic.com;
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            frame-src https://embeds.beehiiv.com;
            frame-ancestors 'none';
            connect-src 'self' https://*.supabase.co https://*.pinecone.io https://api.openai.com https://api.beehiiv.com https://api.github.com https://challenges.cloudflare.com https://beamanalytics.b-cdn.net https://*.beamanalytics.io;
          `

      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on'
            },
            ...(isDevelopment ? [] : [{
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains'
            }]),
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN'
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin'
            },
            {
              key: 'Content-Security-Policy',
              value: cspValue.replace(/\s{2,}/g, ' ').trim()
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self "https://embeds.beehiiv.com")'
            },
          ],
        },
      ]
    },
  
    // Configure rewrites if needed
    async rewrites() {
      return {
        beforeFiles: [
          // Example rewrite
          // {
          //   source: '/some-page',
          //   destination: '/api/some-page',
          // },
        ],
      }
    },
  }
  
  module.exports = nextConfig
  