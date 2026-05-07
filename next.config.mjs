import { withSentryConfig } from '@sentry/nextjs'

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
      {
        protocol: 'https',
        hostname: 'files.kick.com',
      },
      {
        protocol: 'https',
        hostname: 'clips.kick.com',
      },
      {
        protocol: 'https',
        hostname: '*.kick.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
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
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // ── Dev: fresh webpack cache each startup (prevents .next corruption) ───
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: 'filesystem',
        version: Date.now().toString(),
      }
    }
    return config
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable source map upload when no auth token (local dev)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Prevents Sentry from failing the build when not configured
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});