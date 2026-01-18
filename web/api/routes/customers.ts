import { Hono } from 'hono';
import { readdir } from 'fs/promises';
import path from 'path';
import { customersRepo } from '../db/repository';

const app = new Hono();

const CUSTOMERS_DIR = path.join(process.cwd(), 'customers');
const USE_REPO = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

// GET /api/customers - รายชื่อลูกค้าทั้งหมด
app.get('/', async (c) => {
  try {
    if (USE_REPO) {
      const customers = await customersRepo.getAll();
      return c.json({ success: true, data: customers });
    }
    
    const files = await readdir(CUSTOMERS_DIR);
    const customers = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(CUSTOMERS_DIR, file);
        const content = await Bun.file(filePath).json();
        customers.push({
          id: file.replace('.json', ''),
          filename: file,
          ...content,
        });
      }
    }

    return c.json({ success: true, data: customers });
  } catch (error) {
    return c.json({ success: false, error: 'ไม่สามารถอ่านรายชื่อลูกค้าได้' }, 500);
  }
});

// GET /api/customers/:id - ดึงข้อมูลลูกค้า
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    if (USE_REPO) {
      const customer = await customersRepo.getById(id);
      if (!customer) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
      }
      return c.json({ success: true, data: customer });
    }
    
    const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
    }

    const content = await file.json();
    return c.json({ success: true, data: { id, ...content } });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการอ่านข้อมูล' }, 500);
  }
});

// POST /api/customers - สร้างลูกค้าใหม่
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, company, address, taxId, phone, email } = body;

    if (!id || !name || !address || !taxId) {
      return c.json({ 
        success: false, 
        error: 'กรุณากรอกข้อมูลที่จำเป็น: id, name, address, taxId' 
      }, 400);
    }

    if (USE_REPO) {
      const existing = await customersRepo.getById(id);
      if (existing) {
        return c.json({ success: false, error: 'มีลูกค้ารหัสนี้อยู่แล้ว' }, 409);
      }
      
      await customersRepo.create({ id, name, company, address, taxId, phone, email });
      return c.json({ success: true, data: { id, name, company, address, taxId, phone, email } }, 201);
    }

    const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return c.json({ success: false, error: 'มีลูกค้ารหัสนี้อยู่แล้ว' }, 409);
    }

    const customerData = { name, company, address, taxId, phone, email };
    await Bun.write(filePath, JSON.stringify(customerData, null, 2));

    return c.json({ success: true, data: { id, ...customerData } }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างลูกค้า' }, 500);
  }
});

// PUT /api/customers/:id - แก้ไขข้อมูลลูกค้า
app.put('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, company, address, taxId, phone, email } = body;

    if (USE_REPO) {
      const existing = await customersRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
      }
      
      await customersRepo.update(id, { name, company, address, taxId, phone, email });
      return c.json({ success: true, data: { id, name, company, address, taxId, phone, email } });
    }

    const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
    }

    const customerData = { name, company, address, taxId, phone, email };
    await Bun.write(filePath, JSON.stringify(customerData, null, 2));

    return c.json({ success: true, data: { id, ...customerData } });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' }, 500);
  }
});

// DELETE /api/customers/:id - ลบลูกค้า
app.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    if (USE_REPO) {
      const deleted = await customersRepo.delete(id);
      if (!deleted) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
      }
      return c.json({ success: true, message: 'ลบลูกค้าเรียบร้อย' });
    }

    const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลลูกค้า' }, 404);
    }

    const fs = await import('fs/promises');
    await fs.unlink(filePath);

    return c.json({ success: true, message: 'ลบลูกค้าเรียบร้อย' });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบข้อมูล' }, 500);
  }
});

export default app;
