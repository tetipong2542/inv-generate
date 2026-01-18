import { Hono } from 'hono';
import path from 'path';
import { readdir, unlink, mkdir } from 'fs/promises';
import { freelancersRepo } from '../db/repository';

const app = new Hono();

// Freelancers directory
const FREELANCERS_DIR = path.join(process.cwd(), 'config', 'freelancers');
const LEGACY_CONFIG_PATH = path.join(process.cwd(), 'config', 'freelancer.json');
const USE_REPO = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

// Ensure directory exists
async function ensureDir() {
  try {
    await mkdir(FREELANCERS_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Migrate legacy freelancer.json to new multi-profile system
async function migrateLegacyConfig() {
  try {
    const legacyFile = Bun.file(LEGACY_CONFIG_PATH);
    if (!(await legacyFile.exists())) {
      return; // No legacy config to migrate
    }

    if (USE_REPO) {
      // Check if database has freelancers
      const existing = await freelancersRepo.getAll();
      if (existing.length > 0) return;
      
      const legacyData = await legacyFile.json();
      await freelancersRepo.create({
        id: 'default',
        name: legacyData.name,
        title: legacyData.title,
        email: legacyData.email,
        phone: legacyData.phone,
        address: legacyData.address,
        taxId: legacyData.taxId,
        signature: legacyData.signature,
        bankInfo: legacyData.bankInfo,
      });
      console.log('Migrated legacy freelancer.json to SQLite');
      return;
    }

    // Check if freelancers directory is empty
    const files = await readdir(FREELANCERS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length > 0) {
      return; // Already have freelancers, skip migration
    }

    // Read legacy config and create as default profile
    const legacyData = await legacyFile.json();
    const defaultId = 'default';
    const newFilePath = path.join(FREELANCERS_DIR, `${defaultId}.json`);
    
    await Bun.write(newFilePath, JSON.stringify(legacyData, null, 2));
    console.log('Migrated legacy freelancer.json to config/freelancers/default.json');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// GET /api/freelancers - List all freelancer profiles
app.get('/', async (c) => {
  try {
    if (USE_REPO) {
      await migrateLegacyConfig();
      const freelancers = await freelancersRepo.getAll();
      return c.json({ success: true, data: freelancers });
    }

    await ensureDir();
    await migrateLegacyConfig(); // Auto-migrate on first load
    
    const files = await readdir(FREELANCERS_DIR);
    const freelancers = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(FREELANCERS_DIR, file);
        const content = await Bun.file(filePath).json();
        freelancers.push({
          id: file.replace('.json', ''),
          ...content,
        });
      }
    }

    return c.json({ success: true, data: freelancers });
  } catch (error) {
    console.error('Error listing freelancers:', error);
    return c.json({ success: false, error: 'Failed to list freelancers' }, 500);
  }
});

// GET /api/freelancers/:id - Get single freelancer
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    if (USE_REPO) {
      const freelancer = await freelancersRepo.getById(id);
      if (!freelancer) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
      }
      return c.json({ success: true, data: freelancer });
    }

    const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
    }

    const content = await file.json();
    return c.json({ success: true, data: { id, ...content } });
  } catch (error) {
    console.error('Error getting freelancer:', error);
    return c.json({ success: false, error: 'Failed to get freelancer' }, 500);
  }
});

// POST /api/freelancers - Create new freelancer
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, ...data } = body;

    if (!id) {
      return c.json({ success: false, error: 'กรุณาระบุ ID' }, 400);
    }

    if (!data.name) {
      return c.json({ success: false, error: 'กรุณาระบุชื่อ' }, 400);
    }

    if (USE_REPO) {
      const existing = await freelancersRepo.getById(id);
      if (existing) {
        return c.json({ success: false, error: 'ID นี้มีอยู่แล้ว' }, 409);
      }
      
      await freelancersRepo.create({
        id,
        name: data.name,
        title: data.title,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId,
        signature: data.signature,
        bankInfo: data.bankInfo,
      });
      return c.json({ success: true, data: { id, ...data } }, 201);
    }

    await ensureDir();
    const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return c.json({ success: false, error: 'ID นี้มีอยู่แล้ว' }, 409);
    }

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return c.json({ success: true, data: { id, ...data } }, 201);
  } catch (error) {
    console.error('Error creating freelancer:', error);
    return c.json({ success: false, error: 'Failed to create freelancer' }, 500);
  }
});

// PUT /api/freelancers/:id - Update freelancer
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (USE_REPO) {
      const existing = await freelancersRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
      }
      
      await freelancersRepo.update(id, {
        name: body.name,
        title: body.title,
        email: body.email,
        phone: body.phone,
        address: body.address,
        taxId: body.taxId,
        signature: body.signature,
        bankInfo: body.bankInfo,
      });
      return c.json({ success: true, data: { id, ...body } });
    }

    const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
    }

    await Bun.write(filePath, JSON.stringify(body, null, 2));
    return c.json({ success: true, data: { id, ...body } });
  } catch (error) {
    console.error('Error updating freelancer:', error);
    return c.json({ success: false, error: 'Failed to update freelancer' }, 500);
  }
});

// DELETE /api/freelancers/:id - Delete freelancer
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    if (USE_REPO) {
      const existing = await freelancersRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
      }
      
      const deleted = await freelancersRepo.delete(id);
      if (deleted) {
        return c.json({ success: true, message: 'ลบข้อมูลเรียบร้อย' });
      } else {
        return c.json({ success: false, error: 'ไม่สามารถลบข้อมูลได้' }, 500);
      }
    }

    const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลผู้ออกเอกสาร' }, 404);
    }

    await unlink(filePath);
    return c.json({ success: true, message: 'ลบข้อมูลเรียบร้อย' });
  } catch (error) {
    console.error('Error deleting freelancer:', error);
    return c.json({ success: false, error: 'Failed to delete freelancer' }, 500);
  }
});

export default app;
