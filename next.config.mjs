/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP is defined in netlify.toml to avoid duplication issues
        ],
      },
    ];
  },

  // ── Image Optimization ────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
      },
      {
        protocol: 'https',
        hostname: '*.jtvnw.net',
      },
      {
        protocol: 'https',
        hostname: 'clips-media-assets2.twitch.tv',
      },
    ],
  },

  // ── Server-only packages (not bundled to client) ──────────────────────────
  experimental: {
    serverComponentsExternalPackages: [
      '@anthropic-ai/sdk',
      'openai',
      'stripe',
    ],
  },

  // ── Build settings ────────────────────────────────────────────────────────
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;