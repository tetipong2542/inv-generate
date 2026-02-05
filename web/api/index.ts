import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import path from 'path';
import { mkdir } from 'fs/promises';
import customers from './routes/customers';
import documents from './routes/documents';
import generate from './routes/generate';
import config from './routes/config';
import chat from './routes/chat';
import ai from './routes/ai';
import signatures from './routes/signatures';
import paymentQr from './routes/payment-qr';
import freelancers from './routes/freelancers';
import services from './routes/services';

const app = new Hono();

// Detect if running in production (Railway sets NODE_ENV or PORT)
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

// Use /data in production (Railway volume), local path in development  
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : process.cwd();
const OUTPUT_DIR = path.join(DATA_DIR, 'output');

// Ensure output directory exists
mkdir(OUTPUT_DIR, { recursive: true }).catch(console.error);

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: isProduction 
    ? '*'  // Allow all origins in production (or set specific domain)
    : ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type'],
}));

// Static file serving for generated PDFs
app.get('/output/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = path.join(OUTPUT_DIR, filename);
  const file = Bun.file(filePath);
  
  if (!(await file.exists())) {
    return c.json({ success: false, error: 'File not found' }, 404);
  }
  
  const content = await file.arrayBuffer();
  
  // Determine content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  
  return new Response(content, {
    headers: {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
});

// List generated files
app.get('/api/output', async (c) => {
  const { readdir, stat } = await import('fs/promises');
  
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const files = await readdir(OUTPUT_DIR);
    const fileInfos = await Promise.all(
      files
        .filter(f => f.endsWith('.pdf'))
        .map(async (f) => {
          const filePath = path.join(OUTPUT_DIR, f);
          const stats = await stat(filePath);
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.birthtime,
            url: `/output/${f}`,
          };
        })
    );
    
    // Sort by creation date, newest first
    fileInfos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json({ success: true, data: fileInfos });
  } catch (error) {
    return c.json({ success: true, data: [] });
  }
});

// Routes
app.route('/api/customers', customers);
app.route('/api/documents', documents);
app.route('/api/generate', generate);
app.route('/api/config', config);
app.route('/api/chat', chat);
app.route('/api/ai', ai);
app.route('/api/signatures', signatures);
app.route('/api/payment-qr', paymentQr);
app.route('/api/freelancers', freelancers);
app.route('/api/services', services);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', message: 'Pacioli API is running' }));

// In production, serve static files from React build
if (isProduction) {
  const staticPath = path.join(process.cwd(), 'web/app/dist');
  
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: staticPath }));
  
  // Serve index.html for all non-API routes (SPA fallback)
  app.get('*', async (c) => {
    const requestPath = c.req.path;
    
    // Skip API routes
    if (requestPath.startsWith('/api/') || requestPath.startsWith('/output/')) {
      return c.notFound();
    }
    
    // Try to serve static file first
    const filePath = path.join(staticPath, requestPath);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const content = await file.arrayBuffer();
      const ext = path.extname(requestPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
      };
      return new Response(content, {
        headers: { 'Content-Type': contentTypes[ext] || 'application/octet-stream' },
      });
    }
    
    // Fallback to index.html for SPA routing
    const indexPath = path.join(staticPath, 'index.html');
    const indexFile = Bun.file(indexPath);
    if (await indexFile.exists()) {
      const html = await indexFile.text();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    return c.notFound();
  });
}

// Start server
const port = Number(process.env.PORT) || 3001;
console.log(`Pacioli API running on http://localhost:${port}${isProduction ? ' (production mode)' : ''}`);

export default {
  port,
  fetch: app.fetch,
};
