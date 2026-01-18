import { Hono } from 'hono';
import path from 'path';

const app = new Hono();

const CONFIG_DIR = path.join(process.cwd(), 'config');

// GET /api/config/freelancer - ดึงข้อมูล freelancer profile
app.get('/freelancer', async (c) => {
  const filePath = path.join(CONFIG_DIR, 'freelancer.json');

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      // Return example config if main config doesn't exist
      const examplePath = path.join(CONFIG_DIR, 'freelancer.example.json');
      const exampleFile = Bun.file(examplePath);
      
      if (await exampleFile.exists()) {
        const content = await exampleFile.json();
        return c.json({ 
          success: true, 
          data: content, 
          isExample: true,
          message: 'กรุณาสร้างไฟล์ config/freelancer.json' 
        });
      }
      
      return c.json({ success: false, error: 'ไม่พบไฟล์ config' }, 404);
    }

    const content = await file.json();
    return c.json({ success: true, data: content });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการอ่าน config' }, 500);
  }
});

// PUT /api/config/freelancer - แก้ไข freelancer profile
app.put('/freelancer', async (c) => {
  const filePath = path.join(CONFIG_DIR, 'freelancer.json');

  try {
    const body = await c.req.json();
    const { name, title, email, phone, address, taxId, signature, bankInfo } = body;

    if (!name || !email || !address || !taxId || !bankInfo) {
      return c.json({ 
        success: false, 
        error: 'กรุณากรอกข้อมูลที่จำเป็น' 
      }, 400);
    }

    const configData = { name, title, email, phone, address, taxId, signature, bankInfo };
    await Bun.write(filePath, JSON.stringify(configData, null, 2));

    return c.json({ success: true, data: configData });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการบันทึก config' }, 500);
  }
});

export default app;
