import { Database } from 'bun:sqlite';
import path from 'path';
import { mkdir } from 'fs/promises';

// Use /data in production (Railway volume), local path in development
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'pacioli.db');

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  // Ensure data directory exists
  await mkdir(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  
  // Enable WAL mode for better performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Initialize tables
  initializeTables(db);

  console.log(`SQLite database initialized at ${DB_PATH}`);
  return db;
}

function initializeTables(db: Database) {
  // Documents table (quotations, invoices, receipts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      customer_id TEXT,
      status TEXT DEFAULT 'pending',
      data TEXT NOT NULL,
      chain_id TEXT,
      source_document_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      address TEXT NOT NULL,
      tax_id TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Freelancers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS freelancers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT NOT NULL,
      tax_id TEXT NOT NULL,
      signature TEXT,
      bank_info TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Services table (saved service items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Metadata table (document counters, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_chain ON documents(chain_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id)`);
}

// Document operations
export interface DocumentRow {
  id: string;
  type: string;
  document_number: string;
  issue_date: string;
  customer_id: string | null;
  status: string;
  data: string;
  chain_id: string | null;
  source_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllDocuments(): Promise<DocumentRow[]> {
  const db = await getDatabase();
  return db.query('SELECT * FROM documents ORDER BY created_at DESC').all() as DocumentRow[];
}

export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const db = await getDatabase();
  return db.query('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | null;
}

export async function createDocument(doc: {
  id: string;
  type: string;
  document_number: string;
  issue_date: string;
  customer_id?: string;
  status?: string;
  data: object;
  chain_id?: string;
  source_document_id?: string;
}): Promise<void> {
  const db = await getDatabase();
  db.query(`
    INSERT INTO documents (id, type, document_number, issue_date, customer_id, status, data, chain_id, source_document_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    doc.id,
    doc.type,
    doc.document_number,
    doc.issue_date,
    doc.customer_id || null,
    doc.status || 'pending',
    JSON.stringify(doc.data),
    doc.chain_id || null,
    doc.source_document_id || null
  );
}

export async function updateDocument(id: string, updates: Partial<{
  status: string;
  data: object;
  chain_id: string;
}>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.data !== undefined) {
    sets.push('data = ?');
    values.push(JSON.stringify(updates.data));
  }
  if (updates.chain_id !== undefined) {
    sets.push('chain_id = ?');
    values.push(updates.chain_id);
  }

  values.push(id);
  db.query(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteDocument(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = db.query('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}

// Customer operations
export interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  address: string;
  tax_id: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllCustomers(): Promise<CustomerRow[]> {
  const db = await getDatabase();
  return db.query('SELECT * FROM customers ORDER BY name').all() as CustomerRow[];
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const db = await getDatabase();
  return db.query('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow | null;
}

export async function createCustomer(customer: {
  id: string;
  name: string;
  company?: string;
  address: string;
  tax_id: string;
  phone?: string;
  email?: string;
}): Promise<void> {
  const db = await getDatabase();
  db.query(`
    INSERT INTO customers (id, name, company, address, tax_id, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer.id,
    customer.name,
    customer.company || null,
    customer.address,
    customer.tax_id,
    customer.phone || null,
    customer.email || null
  );
}

export async function updateCustomer(id: string, customer: Partial<CustomerRow>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [];

  if (customer.name !== undefined) { sets.push('name = ?'); values.push(customer.name); }
  if (customer.company !== undefined) { sets.push('company = ?'); values.push(customer.company); }
  if (customer.address !== undefined) { sets.push('address = ?'); values.push(customer.address); }
  if (customer.tax_id !== undefined) { sets.push('tax_id = ?'); values.push(customer.tax_id); }
  if (customer.phone !== undefined) { sets.push('phone = ?'); values.push(customer.phone); }
  if (customer.email !== undefined) { sets.push('email = ?'); values.push(customer.email); }

  values.push(id);
  db.query(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = db.query('DELETE FROM customers WHERE id = ?').run(id);
  return result.changes > 0;
}

// Freelancer operations
export interface FreelancerRow {
  id: string;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  address: string;
  tax_id: string;
  signature: string | null;
  bank_info: string;
  created_at: string;
  updated_at: string;
}

export async function getAllFreelancers(): Promise<FreelancerRow[]> {
  const db = await getDatabase();
  return db.query('SELECT * FROM freelancers ORDER BY name').all() as FreelancerRow[];
}

export async function getFreelancerById(id: string): Promise<FreelancerRow | null> {
  const db = await getDatabase();
  return db.query('SELECT * FROM freelancers WHERE id = ?').get(id) as FreelancerRow | null;
}

export async function createFreelancer(freelancer: {
  id: string;
  name: string;
  title?: string;
  email: string;
  phone?: string;
  address: string;
  tax_id: string;
  signature?: string;
  bank_info: object;
}): Promise<void> {
  const db = await getDatabase();
  db.query(`
    INSERT INTO freelancers (id, name, title, email, phone, address, tax_id, signature, bank_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    freelancer.id,
    freelancer.name,
    freelancer.title || null,
    freelancer.email,
    freelancer.phone || null,
    freelancer.address,
    freelancer.tax_id,
    freelancer.signature || null,
    JSON.stringify(freelancer.bank_info)
  );
}

export async function updateFreelancer(id: string, freelancer: Partial<{
  name: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  signature: string;
  bank_info: object;
}>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [];

  if (freelancer.name !== undefined) { sets.push('name = ?'); values.push(freelancer.name); }
  if (freelancer.title !== undefined) { sets.push('title = ?'); values.push(freelancer.title); }
  if (freelancer.email !== undefined) { sets.push('email = ?'); values.push(freelancer.email); }
  if (freelancer.phone !== undefined) { sets.push('phone = ?'); values.push(freelancer.phone); }
  if (freelancer.address !== undefined) { sets.push('address = ?'); values.push(freelancer.address); }
  if (freelancer.tax_id !== undefined) { sets.push('tax_id = ?'); values.push(freelancer.tax_id); }
  if (freelancer.signature !== undefined) { sets.push('signature = ?'); values.push(freelancer.signature); }
  if (freelancer.bank_info !== undefined) { sets.push('bank_info = ?'); values.push(JSON.stringify(freelancer.bank_info)); }

  values.push(id);
  db.query(`UPDATE freelancers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

// Services operations
export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  unit_price: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllServices(): Promise<ServiceRow[]> {
  const db = await getDatabase();
  return db.query('SELECT * FROM services ORDER BY name').all() as ServiceRow[];
}

export async function createService(service: {
  id: string;
  name: string;
  description?: string;
  unit: string;
  unit_price: number;
  category?: string;
}): Promise<void> {
  const db = await getDatabase();
  db.query(`
    INSERT INTO services (id, name, description, unit, unit_price, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    service.id,
    service.name,
    service.description || null,
    service.unit,
    service.unit_price,
    service.category || null
  );
}

export async function deleteService(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = db.query('DELETE FROM services WHERE id = ?').run(id);
  return result.changes > 0;
}

// Metadata operations
export async function getMetadata(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = db.query('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | null;
  return row?.value || null;
}

export async function setMetadata(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  db.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

// Helper to convert document row to API format
export function documentRowToApi(row: DocumentRow): any {
  const data = JSON.parse(row.data);
  return {
    id: row.id,
    type: row.type,
    documentNumber: row.document_number,
    issueDate: row.issue_date,
    customerId: row.customer_id,
    status: row.status,
    chainId: row.chain_id,
    sourceDocumentId: row.source_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...data,
  };
}

// Helper to convert customer row to API format
export function customerRowToApi(row: CustomerRow): any {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    address: row.address,
    taxId: row.tax_id,
    phone: row.phone,
    email: row.email,
  };
}

// Helper to convert freelancer row to API format
export function freelancerRowToApi(row: FreelancerRow): any {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    address: row.address,
    taxId: row.tax_id,
    signature: row.signature,
    bankInfo: JSON.parse(row.bank_info),
  };
}
