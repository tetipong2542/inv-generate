/**
 * Data Repository - Abstraction layer for data storage
 * Supports both JSON files (development/fallback) and SQLite (production)
 */

import path from 'path';
import { readdir, mkdir } from 'fs/promises';
import * as db from './index';

// Determine storage mode
const USE_SQLITE = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

const PROJECT_ROOT = process.cwd();
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples');
const CUSTOMERS_DIR = path.join(PROJECT_ROOT, 'customers');
const FREELANCERS_DIR = path.join(PROJECT_ROOT, 'config/freelancers');
const SERVICES_DIR = path.join(PROJECT_ROOT, 'config/services');

console.log(`Data storage mode: ${USE_SQLITE ? 'SQLite' : 'JSON files'}`);

// ============================================
// Documents Repository
// ============================================

export interface Document {
  id: string;
  type: 'quotation' | 'invoice' | 'receipt';
  documentNumber: string;
  issueDate: string;
  customerId?: string;
  status: string;
  chainId?: string;
  sourceDocumentId?: string;
  createdAt?: string;
  [key: string]: any;
}

export const documentsRepo = {
  async getAll(): Promise<Document[]> {
    if (USE_SQLITE) {
      const rows = await db.getAllDocuments();
      return rows.map(db.documentRowToApi);
    }
    
    // JSON fallback
    try {
      const files = await readdir(EXAMPLES_DIR);
      const docs: Document[] = [];
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const data = await Bun.file(path.join(EXAMPLES_DIR, file)).json();
        docs.push({
          id: file.replace('.json', ''),
          filename: file,
          type: data.type || (data.validUntil ? 'quotation' : data.dueDate ? 'invoice' : 'receipt'),
          ...data,
        });
      }
      return docs.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<Document | null> {
    if (USE_SQLITE) {
      const row = await db.getDocumentById(id);
      return row ? db.documentRowToApi(row) : null;
    }
    
    try {
      const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const data = await file.json();
        return { id, ...data };
      }
      return null;
    } catch {
      return null;
    }
  },

  async create(doc: Document): Promise<void> {
    if (USE_SQLITE) {
      await db.createDocument({
        id: doc.id,
        type: doc.type,
        document_number: doc.documentNumber,
        issue_date: doc.issueDate,
        customer_id: doc.customerId,
        status: doc.status || 'pending',
        data: doc,
        chain_id: doc.chainId,
        source_document_id: doc.sourceDocumentId,
      });
      return;
    }
    
    await mkdir(EXAMPLES_DIR, { recursive: true });
    const filePath = path.join(EXAMPLES_DIR, `${doc.id}.json`);
    await Bun.write(filePath, JSON.stringify(doc, null, 2));
  },

  async update(id: string, updates: Partial<Document>): Promise<void> {
    if (USE_SQLITE) {
      const existing = await db.getDocumentById(id);
      if (existing) {
        const currentData = JSON.parse(existing.data);
        await db.updateDocument(id, {
          status: updates.status,
          data: { ...currentData, ...updates },
          chain_id: updates.chainId,
        });
      }
      return;
    }
    
    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const data = await file.json();
      await Bun.write(filePath, JSON.stringify({ ...data, ...updates }, null, 2));
    }
  },

  async delete(id: string): Promise<boolean> {
    if (USE_SQLITE) {
      return db.deleteDocument(id);
    }
    
    try {
      const { unlink } = await import('fs/promises');
      const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Customers Repository
// ============================================

export interface Customer {
  id: string;
  name: string;
  company?: string;
  address: string;
  taxId: string;
  phone?: string;
  email?: string;
}

export const customersRepo = {
  async getAll(): Promise<Customer[]> {
    if (USE_SQLITE) {
      const rows = await db.getAllCustomers();
      return rows.map(db.customerRowToApi);
    }
    
    try {
      const files = await readdir(CUSTOMERS_DIR);
      const customers: Customer[] = [];
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const data = await Bun.file(path.join(CUSTOMERS_DIR, file)).json();
        customers.push({
          id: file.replace('.json', ''),
          filename: file,
          ...data,
        });
      }
      return customers;
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<Customer | null> {
    if (USE_SQLITE) {
      const row = await db.getCustomerById(id);
      return row ? db.customerRowToApi(row) : null;
    }
    
    try {
      const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const data = await file.json();
        return { id, ...data };
      }
      return null;
    } catch {
      return null;
    }
  },

  async create(customer: Customer): Promise<void> {
    if (USE_SQLITE) {
      await db.createCustomer({
        id: customer.id,
        name: customer.name,
        company: customer.company,
        address: customer.address,
        tax_id: customer.taxId,
        phone: customer.phone,
        email: customer.email,
      });
      return;
    }
    
    await mkdir(CUSTOMERS_DIR, { recursive: true });
    const filePath = path.join(CUSTOMERS_DIR, `${customer.id}.json`);
    await Bun.write(filePath, JSON.stringify(customer, null, 2));
  },

  async update(id: string, updates: Partial<Customer>): Promise<void> {
    if (USE_SQLITE) {
      await db.updateCustomer(id, {
        name: updates.name,
        company: updates.company,
        address: updates.address,
        tax_id: updates.taxId,
        phone: updates.phone,
        email: updates.email,
      });
      return;
    }
    
    const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const data = await file.json();
      await Bun.write(filePath, JSON.stringify({ ...data, ...updates }, null, 2));
    }
  },

  async delete(id: string): Promise<boolean> {
    if (USE_SQLITE) {
      return db.deleteCustomer(id);
    }
    
    try {
      const { unlink } = await import('fs/promises');
      const filePath = path.join(CUSTOMERS_DIR, `${id}.json`);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Freelancers Repository
// ============================================

export interface Freelancer {
  id: string;
  name: string;
  title?: string;
  email: string;
  phone?: string;
  address: string;
  taxId: string;
  signature?: string;
  bankInfo: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch?: string;
  };
}

export const freelancersRepo = {
  async getAll(): Promise<Freelancer[]> {
    if (USE_SQLITE) {
      const rows = await db.getAllFreelancers();
      return rows.map(db.freelancerRowToApi);
    }
    
    try {
      const files = await readdir(FREELANCERS_DIR);
      const freelancers: Freelancer[] = [];
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const data = await Bun.file(path.join(FREELANCERS_DIR, file)).json();
        freelancers.push({
          id: file.replace('.json', ''),
          ...data,
        });
      }
      return freelancers;
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<Freelancer | null> {
    if (USE_SQLITE) {
      const row = await db.getFreelancerById(id);
      return row ? db.freelancerRowToApi(row) : null;
    }
    
    try {
      const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const data = await file.json();
        return { id, ...data };
      }
      return null;
    } catch {
      return null;
    }
  },

  async create(freelancer: Freelancer): Promise<void> {
    if (USE_SQLITE) {
      await db.createFreelancer({
        id: freelancer.id,
        name: freelancer.name,
        title: freelancer.title,
        email: freelancer.email,
        phone: freelancer.phone,
        address: freelancer.address,
        tax_id: freelancer.taxId,
        signature: freelancer.signature,
        bank_info: freelancer.bankInfo,
      });
      return;
    }
    
    await mkdir(FREELANCERS_DIR, { recursive: true });
    const filePath = path.join(FREELANCERS_DIR, `${freelancer.id}.json`);
    await Bun.write(filePath, JSON.stringify(freelancer, null, 2));
  },

  async update(id: string, updates: Partial<Freelancer>): Promise<void> {
    if (USE_SQLITE) {
      await db.updateFreelancer(id, {
        name: updates.name,
        title: updates.title,
        email: updates.email,
        phone: updates.phone,
        address: updates.address,
        tax_id: updates.taxId,
        signature: updates.signature,
        bank_info: updates.bankInfo,
      });
      return;
    }
    
    const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const data = await file.json();
      await Bun.write(filePath, JSON.stringify({ ...data, ...updates }, null, 2));
    }
  },

  async delete(id: string): Promise<boolean> {
    if (USE_SQLITE) {
      return db.deleteFreelancer(id);
    }
    
    try {
      const { unlink } = await import('fs/promises');
      const filePath = path.join(FREELANCERS_DIR, `${id}.json`);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Services Repository
// ============================================

export interface Service {
  id: string;
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  category?: string;
}

export const servicesRepo = {
  async getAll(): Promise<Service[]> {
    if (USE_SQLITE) {
      const rows = await db.getAllServices();
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        unit: r.unit,
        unitPrice: r.unit_price,
        category: r.category || undefined,
      }));
    }
    
    try {
      const files = await readdir(SERVICES_DIR);
      const services: Service[] = [];
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const data = await Bun.file(path.join(SERVICES_DIR, file)).json();
        services.push({
          id: file.replace('.json', ''),
          ...data,
        });
      }
      return services;
    } catch {
      return [];
    }
  },

  async create(service: Service): Promise<void> {
    if (USE_SQLITE) {
      await db.createService({
        id: service.id,
        name: service.name,
        description: service.description,
        unit: service.unit,
        unit_price: service.unitPrice,
        category: service.category,
      });
      return;
    }
    
    await mkdir(SERVICES_DIR, { recursive: true });
    const filePath = path.join(SERVICES_DIR, `${service.id}.json`);
    await Bun.write(filePath, JSON.stringify(service, null, 2));
  },

  async delete(id: string): Promise<boolean> {
    if (USE_SQLITE) {
      return db.deleteService(id);
    }
    
    try {
      const { unlink } = await import('fs/promises');
      const filePath = path.join(SERVICES_DIR, `${id}.json`);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Metadata Repository
// ============================================

export const metadataRepo = {
  async get(key: string): Promise<string | null> {
    if (USE_SQLITE) {
      return db.getMetadata(key);
    }
    
    try {
      const metadataPath = path.join(PROJECT_ROOT, '.metadata.json');
      const file = Bun.file(metadataPath);
      if (await file.exists()) {
        const data = await file.json();
        return data[key] || null;
      }
      return null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (USE_SQLITE) {
      await db.setMetadata(key, value);
      return;
    }
    
    const metadataPath = path.join(PROJECT_ROOT, '.metadata.json');
    let data = {};
    try {
      const file = Bun.file(metadataPath);
      if (await file.exists()) {
        data = await file.json();
      }
    } catch {}
    data = { ...data, [key]: value };
    await Bun.write(metadataPath, JSON.stringify(data, null, 2));
  },
};

// Initialize database on import (if using SQLite)
if (USE_SQLITE) {
  db.getDatabase().catch(console.error);
}
