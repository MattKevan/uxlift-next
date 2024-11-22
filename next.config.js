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
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on'
            },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains'
            },
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
  