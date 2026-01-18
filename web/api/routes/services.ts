import { Hono } from 'hono';
import path from 'path';
import { readdir, unlink, mkdir } from 'fs/promises';
import { servicesRepo } from '../db/repository';

const app = new Hono();

// Services directory (for fallback mode)
const PROJECT_ROOT = process.cwd();
const SERVICES_DIR = path.join(PROJECT_ROOT, 'config', 'services');

// Use repository for data access (supports both JSON and SQLite)
const USE_REPO = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

// Ensure directory exists (for fallback mode)
async function ensureDir() {
  try {
    await mkdir(SERVICES_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Service interface
interface ServiceItem {
  id?: string;
  type: 'item' | 'package';  // single item or package
  name: string;
  description: string;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
  category?: string;
  isActive?: boolean;
}

// GET /api/services - List all services/packages
app.get('/', async (c) => {
  try {
    if (USE_REPO) {
      const services = await servicesRepo.getAll();
      // Sort by name
      services.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
      return c.json({ success: true, data: services });
    }

    // Legacy filesystem mode
    await ensureDir();
    const files = await readdir(SERVICES_DIR);
    const services: ServiceItem[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(SERVICES_DIR, file);
        const content = await Bun.file(filePath).json();
        
        // Determine type based on items count
        const type = content.type || (content.items?.length === 1 ? 'item' : 'package');
        
        services.push({
          id: file.replace('.json', ''),
          type,
          ...content,
        });
      }
    }

    // Sort by type (items first), then by name
    services.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'item' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'th');
    });

    return c.json({ success: true, data: services });
  } catch (error) {
    console.error('Error listing services:', error);
    return c.json({ success: false, error: 'Failed to list services' }, 500);
  }
});

// GET /api/services/:id - Get single service
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    if (USE_REPO) {
      const service = await servicesRepo.getById(id);
      if (!service) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
      }
      return c.json({ success: true, data: service });
    }

    // Legacy filesystem mode
    const filePath = path.join(SERVICES_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
    }

    const content = await file.json();
    return c.json({ success: true, data: { id, ...content } });
  } catch (error) {
    console.error('Error getting service:', error);
    return c.json({ success: false, error: 'Failed to get service' }, 500);
  }
});

// POST /api/services - Create new service/package
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // Generate ID from name if not provided
    const id = body.id || body.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      + '-' + Date.now().toString(36);

    const { id: _, ...data } = body;

    if (!data.name) {
      return c.json({ success: false, error: 'กรุณาระบุชื่อบริการ' }, 400);
    }

    if (!data.items || data.items.length === 0) {
      return c.json({ success: false, error: 'กรุณาเพิ่มรายการบริการอย่างน้อย 1 รายการ' }, 400);
    }

    if (USE_REPO) {
      // Check if exists
      const existing = await servicesRepo.getById(id);
      if (existing) {
        return c.json({ success: false, error: 'บริการนี้มีอยู่แล้ว' }, 409);
      }

      // Auto-determine type if not provided
      const type = data.type || (data.items.length === 1 ? 'item' : 'package');

      const serviceData = {
        id,
        ...data,
        type,
        isActive: data.isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await servicesRepo.create(serviceData);
      return c.json({ success: true, data: serviceData }, 201);
    }

    // Legacy filesystem mode
    await ensureDir();
    const filePath = path.join(SERVICES_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return c.json({ success: false, error: 'บริการนี้มีอยู่แล้ว' }, 409);
    }

    // Auto-determine type if not provided
    const type = data.type || (data.items.length === 1 ? 'item' : 'package');

    const serviceData = {
      ...data,
      type,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await Bun.write(filePath, JSON.stringify(serviceData, null, 2));
    return c.json({ success: true, data: { id, ...serviceData } }, 201);
  } catch (error) {
    console.error('Error creating service:', error);
    return c.json({ success: false, error: 'Failed to create service' }, 500);
  }
});

// PUT /api/services/:id - Update service
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (USE_REPO) {
      const existing = await servicesRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
      }

      const updatedData = {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString(),
      };

      await servicesRepo.update(id, updatedData);
      return c.json({ success: true, data: { id, ...updatedData } });
    }

    // Legacy filesystem mode
    const filePath = path.join(SERVICES_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
    }

    const existingData = await file.json();

    const updatedData = {
      ...existingData,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await Bun.write(filePath, JSON.stringify(updatedData, null, 2));
    return c.json({ success: true, data: { id, ...updatedData } });
  } catch (error) {
    console.error('Error updating service:', error);
    return c.json({ success: false, error: 'Failed to update service' }, 500);
  }
});

// DELETE /api/services/:id - Delete service
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    if (USE_REPO) {
      const existing = await servicesRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
      }

      const deleted = await servicesRepo.delete(id);
      if (deleted) {
        return c.json({ success: true, message: 'ลบบริการเรียบร้อย' });
      }
      return c.json({ success: false, error: 'ไม่สามารถลบบริการได้' }, 500);
    }

    // Legacy filesystem mode
    const filePath = path.join(SERVICES_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบข้อมูลบริการ' }, 404);
    }

    await unlink(filePath);
    return c.json({ success: true, message: 'ลบบริการเรียบร้อย' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return c.json({ success: false, error: 'Failed to delete service' }, 500);
  }
});

export default app;
