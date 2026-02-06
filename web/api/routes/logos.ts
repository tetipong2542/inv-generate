import { Hono } from 'hono';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Use /data in production (Railway volume), local path in development
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : PROJECT_ROOT;
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

const app = new Hono();

// Ensure logos directory exists
async function ensureLogosDir() {
  const { mkdir } = await import('fs/promises');
  try {
    await mkdir(LOGOS_DIR, { recursive: true });
  } catch (error) {
  }
}

// GET /api/logos - List all logos
app.get('/', async (c) => {
  try {
    await ensureLogosDir();
    const { readdir, stat } = await import('fs/promises');
    
    const files = await readdir(LOGOS_DIR);
    const logos = await Promise.all(
      files
        .filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
        .map(async (filename) => {
          const filePath = path.join(LOGOS_DIR, filename);
          const stats = await stat(filePath);
          return {
            filename,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            url: `/api/logos/file/${filename}`,
          };
        })
    );
    
    logos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ success: true, data: logos });
  } catch (error) {
    console.error('List logos error:', error);
    return c.json({ success: true, data: [] });
  }
});

// GET /api/logos/file/:filename - Serve a logo file
app.get('/file/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(LOGOS_DIR, filename);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'Logo not found' }, 404);
    }
    
    const content = await file.arrayBuffer();
    const ext = path.extname(filename).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    
    return new Response(content, {
      headers: {
        'Content-Type': contentTypes[ext] || 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Serve logo error:', error);
    return c.json({ success: false, error: 'Failed to load logo' }, 500);
  }
});

// POST /api/logos/upload - Upload a new logo
app.post('/upload', async (c) => {
  try {
    await ensureLogosDir();
    
    const formData = await c.req.formData();
    const file = formData.get('logo') as File | null;
    
    if (!file) {
      return c.json({ 
        success: false, 
        error: 'กรุณาเลือกไฟล์รูปภาพโลโก้' 
      }, 400);
    }
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'รองรับเฉพาะไฟล์ PNG, JPG, GIF, WEBP, SVG เท่านั้น' 
      }, 400);
    }
    
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ 
        success: false, 
        error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' 
      }, 400);
    }
    
    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `logo_${timestamp}.${ext}`;
    const filePath = path.join(LOGOS_DIR, filename);
    
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);
    
    return c.json({ 
      success: true, 
      data: {
        filename,
        path: filePath,
        url: `/api/logos/file/${filename}`,
      },
      message: 'อัปโหลดโลโก้สำเร็จ'
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการอัปโหลด' 
    }, 500);
  }
});

// DELETE /api/logos/:filename - Delete a logo
app.delete('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(LOGOS_DIR, filename);
    const { unlink } = await import('fs/promises');
    
    await unlink(filePath);
    
    return c.json({ 
      success: true, 
      message: 'ลบโลโก้สำเร็จ'
    });
  } catch (error) {
    console.error('Delete logo error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการลบ' 
    }, 500);
  }
});

export default app;
