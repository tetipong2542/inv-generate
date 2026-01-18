import { Hono } from 'hono';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SIGNATURES_DIR = path.join(PROJECT_ROOT, 'signatures');

const app = new Hono();

// Ensure signatures directory exists
async function ensureSignaturesDir() {
  const { mkdir } = await import('fs/promises');
  try {
    await mkdir(SIGNATURES_DIR, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

// GET /api/signatures - List all signatures
app.get('/', async (c) => {
  try {
    await ensureSignaturesDir();
    const { readdir, stat } = await import('fs/promises');
    
    const files = await readdir(SIGNATURES_DIR);
    const signatures = await Promise.all(
      files
        .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .map(async (filename) => {
          const filePath = path.join(SIGNATURES_DIR, filename);
          const stats = await stat(filePath);
          return {
            filename,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            url: `/api/signatures/file/${filename}`,
          };
        })
    );
    
    // Sort by creation date, newest first
    signatures.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ success: true, data: signatures });
  } catch (error) {
    console.error('List signatures error:', error);
    return c.json({ success: true, data: [] });
  }
});

// GET /api/signatures/file/:filename - Serve a signature file
app.get('/file/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(SIGNATURES_DIR, filename);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'Signature not found' }, 404);
    }
    
    const content = await file.arrayBuffer();
    const ext = path.extname(filename).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    
    return new Response(content, {
      headers: {
        'Content-Type': contentTypes[ext] || 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Serve signature error:', error);
    return c.json({ success: false, error: 'Failed to load signature' }, 500);
  }
});

// POST /api/signatures/upload - Upload a new signature
app.post('/upload', async (c) => {
  try {
    await ensureSignaturesDir();
    
    const formData = await c.req.formData();
    const file = formData.get('signature') as File | null;
    
    if (!file) {
      return c.json({ 
        success: false, 
        error: 'กรุณาเลือกไฟล์รูปภาพ' 
      }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'รองรับเฉพาะไฟล์ PNG, JPG, GIF, WEBP เท่านั้น' 
      }, 400);
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ 
        success: false, 
        error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `signature_${timestamp}.${ext}`;
    const filePath = path.join(SIGNATURES_DIR, filename);
    
    // Save the file
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);
    
    return c.json({ 
      success: true, 
      data: {
        filename,
        path: filePath,
        url: `/api/signatures/file/${filename}`,
      },
      message: 'อัปโหลดลายเซ็นสำเร็จ'
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการอัปโหลด' 
    }, 500);
  }
});

// DELETE /api/signatures/:filename - Delete a signature
app.delete('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(SIGNATURES_DIR, filename);
    const { unlink } = await import('fs/promises');
    
    await unlink(filePath);
    
    return c.json({ 
      success: true, 
      message: 'ลบลายเซ็นสำเร็จ'
    });
  } catch (error) {
    console.error('Delete signature error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการลบ' 
    }, 500);
  }
});

export default app;
