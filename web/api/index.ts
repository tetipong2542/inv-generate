import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import path from 'path';
import customers from './routes/customers';
import documents from './routes/documents';
import generate from './routes/generate';
import config from './routes/config';
import chat from './routes/chat';
import ai from './routes/ai';
import signatures from './routes/signatures';
import freelancers from './routes/freelancers';
import services from './routes/services';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type'],
}));

// Static file serving for generated PDFs
app.get('/output/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = path.join(process.cwd(), 'output', filename);
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
  const outputDir = path.join(process.cwd(), 'output');
  const { readdir, stat } = await import('fs/promises');
  
  try {
    const files = await readdir(outputDir);
    const fileInfos = await Promise.all(
      files
        .filter(f => f.endsWith('.pdf'))
        .map(async (f) => {
          const filePath = path.join(outputDir, f);
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
app.route('/api/freelancers', freelancers);
app.route('/api/services', services);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', message: 'Pacioli API is running' }));

// Start server
const port = Number(process.env.PORT) || 3001;
console.log(`Pacioli API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
