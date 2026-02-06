/**
 * Migration script: Import existing JSON data into SQLite
 * Run this once to migrate from JSON files to SQLite database
 */

import { readdir } from 'fs/promises';
import path from 'path';
import {
  getDatabase,
  createDocument,
  createCustomer,
  createFreelancer,
  createService,
  getAllDocuments,
  getAllCustomers,
  getAllFreelancers,
} from './index';

const PROJECT_ROOT = process.cwd();

async function migrateDocuments() {
  const examplesDir = path.join(PROJECT_ROOT, 'examples');
  
  try {
    const files = await readdir(examplesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} document files to migrate`);
    
    for (const file of jsonFiles) {
      const filePath = path.join(examplesDir, file);
      const data = await Bun.file(filePath).json();
      
      const id = file.replace('.json', '');
      const type = data.type || 
        (data.validUntil ? 'quotation' : data.dueDate ? 'invoice' : data.paymentDate ? 'receipt' : 'unknown');
      
      try {
        await createDocument({
          id,
          type,
          document_number: data.documentNumber,
          issue_date: data.issueDate,
          customer_id: data.customerId,
          status: data.status || 'pending',
          data: data,
          chain_id: data.chainId,
          source_document_id: data.sourceDocumentId,
        });
        console.log(`  ✓ Migrated document: ${id}`);
      } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) {
          console.log(`  ⏭ Skipped (already exists): ${id}`);
        } else {
          console.error(`  ✗ Failed to migrate ${id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.log('No documents directory found or empty');
  }
}

async function migrateCustomers() {
  const customersDir = path.join(PROJECT_ROOT, 'customers');
  
  try {
    const files = await readdir(customersDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} customer files to migrate`);
    
    for (const file of jsonFiles) {
      const filePath = path.join(customersDir, file);
      const data = await Bun.file(filePath).json();
      
      const id = file.replace('.json', '');
      
      try {
        await createCustomer({
          id,
          name: data.name,
          company: data.company,
          address: data.address,
          tax_id: data.taxId,
          phone: data.phone,
          email: data.email,
        });
        console.log(`  ✓ Migrated customer: ${id}`);
      } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) {
          console.log(`  ⏭ Skipped (already exists): ${id}`);
        } else {
          console.error(`  ✗ Failed to migrate ${id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.log('No customers directory found or empty');
  }
}

async function migrateFreelancers() {
  const freelancersDir = path.join(PROJECT_ROOT, 'config/freelancers');
  
  try {
    const files = await readdir(freelancersDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} freelancer files to migrate`);
    
    for (const file of jsonFiles) {
      const filePath = path.join(freelancersDir, file);
      const data = await Bun.file(filePath).json();
      
      const id = file.replace('.json', '');
      
      try {
        await createFreelancer({
          id,
          name: data.name,
          title: data.title,
          email: data.email,
          phone: data.phone,
          address: data.address,
          tax_id: data.taxId,
          logo: data.logo,
          signature: data.signature,
          bank_info: data.bankInfo,
        });
        console.log(`  ✓ Migrated freelancer: ${id}`);
      } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) {
          console.log(`  ⏭ Skipped (already exists): ${id}`);
        } else {
          console.error(`  ✗ Failed to migrate ${id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.log('No freelancers directory found or empty');
  }
}

async function migrateServices() {
  const servicesDir = path.join(PROJECT_ROOT, 'config/services');
  
  try {
    const files = await readdir(servicesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} service files to migrate`);
    
    for (const file of jsonFiles) {
      const filePath = path.join(servicesDir, file);
      const data = await Bun.file(filePath).json();
      
      const id = file.replace('.json', '');
      
      try {
        await createService({
          id,
          name: data.name || data.description,
          description: data.description,
          unit: data.unit,
          unit_price: data.unitPrice,
          category: data.category,
        });
        console.log(`  ✓ Migrated service: ${id}`);
      } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) {
          console.log(`  ⏭ Skipped (already exists): ${id}`);
        } else {
          console.error(`  ✗ Failed to migrate ${id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.log('No services directory found or empty');
  }
}

async function showStats() {
  const docs = await getAllDocuments();
  const customers = await getAllCustomers();
  const freelancers = await getAllFreelancers();
  
  console.log('\n📊 Database Statistics:');
  console.log(`  Documents:   ${docs.length}`);
  console.log(`  Customers:   ${customers.length}`);
  console.log(`  Freelancers: ${freelancers.length}`);
}

async function main() {
  console.log('🚀 Starting migration from JSON to SQLite...\n');
  
  // Initialize database
  await getDatabase();
  
  console.log('\n📄 Migrating Documents...');
  await migrateDocuments();
  
  console.log('\n👥 Migrating Customers...');
  await migrateCustomers();
  
  console.log('\n👤 Migrating Freelancers...');
  await migrateFreelancers();
  
  console.log('\n📦 Migrating Services...');
  await migrateServices();
  
  await showStats();
  
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
