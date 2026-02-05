import { Hono } from 'hono';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Use /data in production (Railway volume), local path in development
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : PROJECT_ROOT;
const PAYMENT_QR_DIR = path.join(DATA_DIR, 'payment-qr');

const app = new Hono();

// Ensure signatures directory exists
async function ensurePaymentQrDir() {
  const { mkdir } = await import('fs/promises');
  try {
    await mkdir(PAYMENT_QR_DIR, { recursive: true });
  } catch (error) {
  }
}

// GET /api/signatures - List all signatures
app.get('/', async (c) => {
  try {
    await ensurePaymentQrDir();
    const { readdir, stat } = await import('fs/promises');
    
    const files = await readdir(PAYMENT_QR_DIR);
    const qrCodes = await Promise.all(
      files
        .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .map(async (filename) => {
          const filePath = path.join(PAYMENT_QR_DIR, filename);
          const stats = await stat(filePath);
          return {
            filename,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            url: `/api/payment-qr/file/${filename}`,
          };
        })
    );
    
    qrCodes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ success: true, data: qrCodes });
  } catch (error) {
    console.error('List payment QR error:', error);
    return c.json({ success: true, data: [] });
  }
});

// GET /api/signatures/file/:filename - Serve a signature file
app.get('/file/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(PAYMENT_QR_DIR, filename);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'Payment QR not found' }, 404);
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
    console.error('Serve payment QR error:', error);
    return c.json({ success: false, error: 'Failed to load payment QR' }, 500);
  }
});

// POST /api/signatures/upload - Upload a new signature
app.post('/upload', async (c) => {
  try {
    await ensurePaymentQrDir();
    
    const formData = await c.req.formData();
    const file = formData.get('paymentQr') as File | null;
    
    if (!file) {
      return c.json({ 
        success: false, 
        error: 'กรุณาเลือกไฟล์รูปภาพ QR Code' 
      }, 400);
    }
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'รองรับเฉพาะไฟล์ PNG, JPG, GIF, WEBP เท่านั้น' 
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
    const filename = `qr_${timestamp}.${ext}`;
    const filePath = path.join(PAYMENT_QR_DIR, filename);
    
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);
    
    return c.json({ 
      success: true, 
      data: {
        filename,
        path: filePath,
        url: `/api/payment-qr/file/${filename}`,
      },
      message: 'อัปโหลด QR Code สำเร็จ'
    });
  } catch (error) {
    console.error('Upload payment QR error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการอัปโหลด' 
    }, 500);
  }
});

app.delete('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const filePath = path.join(PAYMENT_QR_DIR, filename);
    const { unlink } = await import('fs/promises');
    
    await unlink(filePath);
    
    return c.json({ 
      success: true, 
      message: 'ลบ QR Code สำเร็จ'
    });
  } catch (error) {
    console.error('Delete payment QR error:', error);
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการลบ' 
    }, 500);
  }
});

export default app;
