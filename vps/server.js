import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Import route handlers
import renderRouter from './routes/render.js';
import healthRouter from './routes/health.js';
import downloadRouter from './routes/download.js';

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
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://viral-studio-pro.netlify.app', 'http://localhost:3000'],
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
  console.log(`[${timestamp}] ${method} ${path}`);

  // Log response when finished
  res.on('finish', () => {
    const statusCode = res.statusCode;
    const duration = Date.now() - req._startTime;
    console.log(`[${timestamp}] ${method} ${path} → ${statusCode} (${duration}ms)`);
  });

  req._startTime = Date.now();
  next();
});

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_SECRET;

  if (!apiKey || apiKey !== expectedKey) {
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
    service: 'Viral Studio Pro Render API',
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

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

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
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Viral Studio Pro Render API                                   ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)} ║
║  Port: ${String(PORT).padEnd(55)} ║
║  API Secret: ${process.env.API_SECRET ? '✓ Configured' : '✗ NOT SET'.padEnd(42)} ║
║  Supabase URL: ${process.env.SUPABASE_URL ? '✓ Configured' : '✗ NOT SET'.padEnd(36)} ║
╚════════════════════════════════════════════════════════════════╝
  `);

  if (!process.env.API_SECRET) {
    console.warn('⚠️  Warning: API_SECRET not set! API requests will fail.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set! Database operations will fail.');
  }
});

export default app;
