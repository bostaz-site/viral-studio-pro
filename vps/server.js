// Load environment variables FIRST (must be before any imports that read process.env)
import 'dotenv/config';

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
});

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import route handlers
import renderRouter from './routes/render.js';
import healthRouter from './routes/health.js';
import downloadRouter from './routes/download.js';
import { logger } from './lib/logger.js';

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3100;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://viralanimal.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  logger.info({ method, path }, 'request');

  // Log response when finished
  res.on('finish', () => {
    const statusCode = res.statusCode;
    const duration = Date.now() - req._startTime;
    logger.info({ method, path, statusCode, duration }, 'response');
  });

  req._startTime = Date.now();
  next();
});

// API Key authentication middleware (timing-safe comparison)
import crypto from 'crypto';

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.VPS_RENDER_API_KEY || process.env.API_SECRET;

  if (!apiKey || !expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
  }

  // Timing-safe comparison to prevent timing attacks
  const bufA = Buffer.from(apiKey, 'utf8');
  const bufB = Buffer.from(expectedKey, 'utf8');
  const isValid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Health check (no auth required)
app.use('/api/health', healthRouter);

// Render endpoint (requires auth)
app.use('/api/render', authenticateApiKey, renderRouter);

// Download endpoint (requires auth)
app.use('/api/download', authenticateApiKey, downloadRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Viral Animal Render API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      render: 'POST /api/render',
      download: 'POST /api/download',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Error handler
app.use((err, req, res, next) => {
  logger.error({ err, method: req.method, path: req.path }, 'unhandled error');

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred while processing your request'
      : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server startup
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info({
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    apiKey: !!(process.env.VPS_RENDER_API_KEY || process.env.API_SECRET),
    supabase: !!process.env.SUPABASE_URL,
    sentry: !!process.env.SENTRY_DSN,
  }, 'Viral Animal Render API started');

  if (!process.env.VPS_RENDER_API_KEY && !process.env.API_SECRET) {
    logger.warn('VPS_RENDER_API_KEY / API_SECRET not set — API requests will fail');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('SUPABASE_SERVICE_ROLE_KEY not set — database operations will fail');
  }
});

export default app;
