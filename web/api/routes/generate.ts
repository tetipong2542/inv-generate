import { Hono } from 'hono';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readdir } from 'fs/promises';
import { freelancersRepo, customersRepo, documentsRepo } from '../db/repository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up from web/api/routes to project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples');

// Use repository for data access (supports both JSON and SQLite)
const USE_REPO = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

// Use /data in production (Railway volume), local path in development  
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : PROJECT_ROOT;
const OUTPUT_DIR = path.join(DATA_DIR, 'output');
const SIGNATURES_DIR = path.join(DATA_DIR, 'signatures');

const app = new Hono();

// Multi-tax calculation helper
interface TaxConfig {
  vat: { enabled: boolean; rate: number };
  withholding: { enabled: boolean; rate: number };
  grossUp: boolean;
}

interface TaxBreakdown {
  subtotal: number;
  vatAmount: number;
  withholdingAmount: number;
  total: number;
  grossUpAmount?: number;
}

function calculateMultiTax(itemsSubtotal: number, taxConfig: TaxConfig): TaxBreakdown {
  const { vat, withholding, grossUp } = taxConfig;
  
  if (grossUp) {
    // Gross-up: customer pays the tax, we receive the desired net amount
    let grossAmount = itemsSubtotal;
    let vatAmount = 0;
    let withholdingAmount = 0;
    
    if (vat.enabled && withholding.enabled) {
      // Company: VAT 7% + WHT 3%
      // net = gross * (1 + 0.07 - 0.03) = gross * 1.04
      grossAmount = itemsSubtotal / (1 + vat.rate - withholding.rate);
      vatAmount = grossAmount * vat.rate;
      withholdingAmount = grossAmount * withholding.rate;
    } else if (withholding.enabled && !vat.enabled) {
      // Individual: WHT only
      // net = gross * (1 - 0.03) = gross * 0.97
      grossAmount = itemsSubtotal / (1 - withholding.rate);
      withholdingAmount = grossAmount * withholding.rate;
    } else if (vat.enabled && !withholding.enabled) {
      // VAT only
      grossAmount = itemsSubtotal / (1 + vat.rate);
      vatAmount = grossAmount * vat.rate;
    }
    
    return {
      subtotal: Math.round(grossAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: itemsSubtotal, // Net amount = original price user set
      grossUpAmount: Math.round((grossAmount - itemsSubtotal) * 100) / 100,
    };
  } else {
    // Normal calculation
    const vatAmount = vat.enabled ? itemsSubtotal * vat.rate : 0;
    const withholdingAmount = withholding.enabled ? itemsSubtotal * withholding.rate : 0;
    const total = itemsSubtotal + vatAmount - withholdingAmount;
    
    return {
      subtotal: Math.round(itemsSubtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
}

// Convert multi-tax to legacy format for existing generator
function convertToLegacyTax(taxConfig: TaxConfig): { taxRate: number; taxType: 'vat' | 'withholding' } {
  // For PDF generation, we need to use the existing generator format
  // Priority: VAT > Withholding
  if (taxConfig.vat.enabled && taxConfig.withholding.enabled) {
    // Both: use VAT as primary (generator handles one tax at a time)
    // Note: The PDF will need to be updated later to support multi-tax display
    return { taxRate: taxConfig.vat.rate, taxType: 'vat' };
  } else if (taxConfig.vat.enabled) {
    return { taxRate: taxConfig.vat.rate, taxType: 'vat' };
  } else if (taxConfig.withholding.enabled) {
    return { taxRate: taxConfig.withholding.rate, taxType: 'withholding' };
  }
  return { taxRate: 0, taxType: 'withholding' };
}

// Helper function to get next revision number
async function getNextRevisionNumber(originalDocNumber: string): Promise<number> {
  try {
    if (USE_REPO) {
      // SQLite: Query documents for revisions
      const allDocs = await documentsRepo.getAll();
      let maxRevision = 0;
      
      for (const doc of allDocs) {
        const revisionMatch = doc.documentNumber?.match(new RegExp(`${originalDocNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-R(\\d+)$`));
        if (revisionMatch) {
          const revNum = parseInt(revisionMatch[1], 10);
          if (revNum > maxRevision) {
            maxRevision = revNum;
          }
        }
      }
      
      return maxRevision + 1;
    }
    
    // JSON fallback
    const files = await readdir(EXAMPLES_DIR);
    let maxRevision = 0;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        // Check for revisions like QT-202601-006-R1.json, QT-202601-006-R2.json
        const revisionMatch = file.match(new RegExp(`${originalDocNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-R(\\d+)\\.json$`));
        if (revisionMatch) {
          const revNum = parseInt(revisionMatch[1], 10);
          if (revNum > maxRevision) {
            maxRevision = revNum;
          }
        }
      }
    }
    
    return maxRevision + 1;
  } catch (error) {
    return 1;
  }
}

// Helper function to update original document status
async function updateOriginalDocumentStatus(docId: string, status: string): Promise<boolean> {
  try {
    if (USE_REPO) {
      // SQLite: Update via repository
      await documentsRepo.update(docId, { 
        status, 
        revisedAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
      });
      return true;
    }
    
    // JSON fallback
    const filePath = path.join(EXAMPLES_DIR, `${docId}.json`);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return false;
    }
    
    const data = await file.json();
    data.status = status;
    data.revisedAt = new Date().toISOString();
    data.statusUpdatedAt = new Date().toISOString();
    
    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error updating original document status:', error);
    return false;
  }
}

// Helper function to update source document's linkedDocuments (for Document Chain)
async function updateSourceDocumentLinks(sourceDocId: string, targetType: string, targetDocId: string): Promise<boolean> {
  try {
    if (USE_REPO) {
      // SQLite: Update via repository
      const sourceDoc = await documentsRepo.getById(sourceDocId);
      if (!sourceDoc) {
        return false;
      }
      
      const linkedDocuments = sourceDoc.linkedDocuments || {};
      if (targetType === 'invoice') {
        linkedDocuments.invoiceId = targetDocId;
      } else if (targetType === 'receipt') {
        linkedDocuments.receiptId = targetDocId;
      }
      
      await documentsRepo.update(sourceDocId, { linkedDocuments });
      return true;
    }
    
    // JSON fallback
    const filePath = path.join(EXAMPLES_DIR, `${sourceDocId}.json`);
    const file = Bun.file(filePath);
    
    if (!(await file.exists())) {
      return false;
    }
    
    const data = await file.json();
    data.linkedDocuments = data.linkedDocuments || {};
    
    if (targetType === 'invoice') {
      data.linkedDocuments.invoiceId = targetDocId;
    } else if (targetType === 'receipt') {
      data.linkedDocuments.receiptId = targetDocId;
    }
    
    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error updating source document links:', error);
    return false;
  }
}

// POST /api/generate - Generate PDF
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      type, 
      documentData, 
      customerId, 
      signaturePath, 
      isRevision, 
      originalDocumentNumber, 
      originalDocumentId,
      // Document Chain fields
      chainId,
      sourceDocumentId,
      sourceDocumentNumber,
    } = body;

    if (!type || !documentData) {
      return c.json({ 
        success: false, 
        error: 'กรุณาระบุประเภทเอกสารและข้อมูล' 
      }, 400);
    }

    // Validate type
    const validTypes = ['invoice', 'quotation', 'receipt'];
    if (!validTypes.includes(type)) {
      return c.json({ 
        success: false, 
        error: `ประเภทเอกสารไม่ถูกต้อง ต้องเป็น: ${validTypes.join(', ')}` 
      }, 400);
    }

    // Import existing generator
    const generatorPath = path.join(PROJECT_ROOT, 'src', 'generator.ts');
    const validatorPath = path.join(PROJECT_ROOT, 'src', 'validator.ts');
    const metadataPath = path.join(PROJECT_ROOT, 'src', 'metadata.ts');
    
    // Dynamic import of existing modules
    const { generatePDF } = await import(generatorPath);
    const { validateInvoice, validateQuotation, validateReceipt, validateCustomer, validateFreelancerConfig } = await import(validatorPath);
    const { getNextDocumentNumber, incrementDocumentCounter } = await import(metadataPath);

    // Load freelancer config - support both SQLite and JSON file
    let freelancerConfig: any;
    
    if (USE_REPO) {
      // Try to load from SQLite first
      const freelancers = await freelancersRepo.getAll();
      if (freelancers.length === 0) {
        return c.json({ 
          success: false, 
          error: 'ไม่พบข้อมูลผู้ออกเอกสาร กรุณาเพิ่มผู้ออกเอกสารก่อน' 
        }, 400);
      }
      // Use the first freelancer (or could use documentData.freelancerId)
      const freelancerId = documentData.freelancerId || freelancers[0].id;
      const freelancer = await freelancersRepo.getById(freelancerId);
      if (!freelancer) {
        return c.json({ 
          success: false, 
          error: 'ไม่พบข้อมูลผู้ออกเอกสาร' 
        }, 400);
      }
      freelancerConfig = freelancer;
    } else {
      // Legacy: Load from JSON file
      const configPath = path.join(PROJECT_ROOT, 'config', 'freelancer.json');
      const configFile = Bun.file(configPath);
      
      if (!(await configFile.exists())) {
        return c.json({ 
          success: false, 
          error: 'ไม่พบไฟล์ config/freelancer.json' 
        }, 400);
      }
      
      freelancerConfig = await configFile.json();
    }
    
    // Validate freelancer config
    const configValidation = validateFreelancerConfig(freelancerConfig);
    if (!configValidation.valid) {
      return c.json({ 
        success: false, 
        error: `ข้อมูล Freelancer ไม่ถูกต้อง: ${configValidation.errors.join(', ')}` 
      }, 400);
    }

    // If a signature path is provided, merge it with freelancer config
    if (signaturePath) {
      // Resolve the signature path relative to SIGNATURES_DIR (persistent volume in production)
      const fullSignaturePath = path.join(SIGNATURES_DIR, signaturePath);
      const signatureFile = Bun.file(fullSignaturePath);
      if (await signatureFile.exists()) {
        freelancerConfig.signature = fullSignaturePath;
      }
    }

    // Load customer data - support both SQLite and JSON file
    let customer = documentData.customer;
    if (!customer && customerId) {
      if (USE_REPO) {
        const customerData = await customersRepo.getById(customerId);
        if (!customerData) {
          return c.json({ 
            success: false, 
            error: 'ไม่พบข้อมูลลูกค้า' 
          }, 400);
        }
        customer = customerData;
      } else {
        const customerPath = path.join(PROJECT_ROOT, 'customers', `${customerId}.json`);
        const customerFile = Bun.file(customerPath);
        
        if (!(await customerFile.exists())) {
          return c.json({ 
            success: false, 
            error: 'ไม่พบข้อมูลลูกค้า' 
          }, 400);
        }
        
        customer = await customerFile.json();
      }
    }

    if (!customer) {
      return c.json({ 
        success: false, 
        error: 'กรุณาระบุข้อมูลลูกค้า' 
      }, 400);
    }

    // Validate customer
    const customerValidation = validateCustomer(customer);
    if (!customerValidation.valid) {
      return c.json({ 
        success: false, 
        error: `ข้อมูลลูกค้าไม่ถูกต้อง: ${customerValidation.errors.join(', ')}` 
      }, 400);
    }

    // Handle auto document number
    let finalDocumentData = { ...documentData };
    
    if (type === 'receipt' && sourceDocumentNumber && !finalDocumentData.referenceNumber) {
      finalDocumentData.referenceNumber = sourceDocumentNumber;
    }
    
    // Handle multi-tax config
    let taxBreakdown: TaxBreakdown | null = null;
    if (documentData.taxConfig) {
      const itemsSubtotal = (documentData.items || []).reduce(
        (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
        0
      );
      taxBreakdown = calculateMultiTax(itemsSubtotal, documentData.taxConfig);
      
      // Convert to legacy format for existing PDF generator
      const legacyTax = convertToLegacyTax(documentData.taxConfig);
      finalDocumentData.taxRate = legacyTax.taxRate;
      finalDocumentData.taxType = legacyTax.taxType;
      
      // Store full tax breakdown for future use
      finalDocumentData.taxBreakdown = taxBreakdown;
    }
    
    // Handle revision numbering
    if (isRevision && originalDocumentNumber) {
      // Generate revision number (e.g., QT-202601-006-R1)
      const revisionNumber = await getNextRevisionNumber(originalDocumentNumber);
      finalDocumentData.documentNumber = `${originalDocumentNumber}-R${revisionNumber}`;
      finalDocumentData.originalDocumentNumber = originalDocumentNumber;
      finalDocumentData.revisionNumber = revisionNumber;
    } else if (documentData.documentNumber === 'auto') {
      finalDocumentData.documentNumber = await getNextDocumentNumber(type);
    }

    // Validate document based on type
    let validation;
    switch (type) {
      case 'invoice':
        validation = validateInvoice(finalDocumentData);
        break;
      case 'quotation':
        validation = validateQuotation(finalDocumentData);
        break;
      case 'receipt':
        validation = validateReceipt(finalDocumentData);
        break;
    }

    if (!validation?.valid) {
      return c.json({ 
        success: false, 
        error: `ข้อมูลเอกสารไม่ถูกต้อง: ${validation?.errors.join(', ')}` 
      }, 400);
    }

    // Generate PDF - ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputFilename = `${type}-${finalDocumentData.documentNumber}.pdf`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    await generatePDF(type, finalDocumentData, customer, freelancerConfig, outputPath);

    // Update metadata counter if auto-numbering was used
    if (documentData.documentNumber === 'auto') {
      await incrementDocumentCounter(type, finalDocumentData.documentNumber);
    }

    // Save document to database for tracking
    try {
      const docId = `${type}-${finalDocumentData.documentNumber}`;
      const docToSave = {
        ...finalDocumentData,
        id: docId,
        documentNumber: finalDocumentData.documentNumber,
        issueDate: finalDocumentData.issueDate || new Date().toISOString().split('T')[0],
        customerId: customerId || null,
        type,
        createdAt: new Date().toISOString(),
        status: 'pending',
        // Revision tracking
        ...(isRevision && originalDocumentNumber ? {
          originalDocumentNumber: originalDocumentNumber,
          originalDocumentId: originalDocumentId || null,
          revisionNumber: finalDocumentData.revisionNumber,
        } : {}),
        // Document Chain tracking
        ...(chainId ? {
          chainId,
          sourceDocumentId,
          sourceDocumentNumber,
        } : {}),
      };
      
      if (USE_REPO) {
        // SQLite: Save via repository
        await documentsRepo.create(docToSave);
      } else {
        // JSON fallback
        await mkdir(EXAMPLES_DIR, { recursive: true });
        const docJsonPath = path.join(EXAMPLES_DIR, `${docId}.json`);
        await Bun.write(docJsonPath, JSON.stringify(docToSave, null, 2));
      }
      
      // Update original document status to 'revised' if this is a revision
      if (isRevision && originalDocumentId) {
        await updateOriginalDocumentStatus(originalDocumentId, 'revised');
      }
      
      // Update source document's linkedDocuments if this is a chain document
      if (sourceDocumentId && chainId) {
        await updateSourceDocumentLinks(sourceDocumentId, type, docId);
      }
    } catch (saveError) {
      console.error('Error saving document:', saveError);
      // Don't fail the request if save fails
    }

    return c.json({ 
      success: true, 
      data: {
        filename: outputFilename,
        path: outputPath,
        documentNumber: finalDocumentData.documentNumber,
        type,
      },
      message: `สร้าง PDF เรียบร้อย: ${outputFilename}`
    });
  } catch (error) {
    console.error('Generate error:', error);
    return c.json({ 
      success: false, 
      error: `เกิดข้อผิดพลาดในการสร้าง PDF: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, 500);
  }
});

// GET /api/generate/preview - Preview document data
app.post('/preview', async (c) => {
  try {
    const body = await c.req.json();
    const { type, documentData, customerId } = body;

    // Load customer if needed
    let customer = documentData.customer;
    if (!customer && customerId) {
      if (USE_REPO) {
        customer = await customersRepo.getById(customerId);
      } else {
        const customerPath = path.join(PROJECT_ROOT, 'customers', `${customerId}.json`);
        const customerFile = Bun.file(customerPath);
        
        if (await customerFile.exists()) {
          customer = await customerFile.json();
        }
      }
    }

    // Load freelancer config
    let freelancer = null;
    if (USE_REPO) {
      const freelancers = await freelancersRepo.getAll();
      if (freelancers.length > 0) {
        const freelancerId = documentData.freelancerId || freelancers[0].id;
        freelancer = await freelancersRepo.getById(freelancerId);
      }
    } else {
      const configPath = path.join(PROJECT_ROOT, 'config', 'freelancer.json');
      const configFile = Bun.file(configPath);
      
      if (await configFile.exists()) {
        freelancer = await configFile.json();
      }
    }

    // Calculate totals
    const { calculateTotals, formatNumber, formatDateThai } = await import(path.join(PROJECT_ROOT, 'src', 'utils.ts'));
    
    const { subtotal, taxAmount, total } = calculateTotals(
      documentData.items || [],
      documentData.taxRate || 0,
      documentData.taxType || 'withholding'
    );

    return c.json({
      success: true,
      data: {
        type,
        document: documentData,
        customer,
        freelancer,
        calculations: {
          subtotal: formatNumber(subtotal),
          taxAmount: formatNumber(taxAmount),
          total: formatNumber(total),
        },
      }
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการ preview' 
    }, 500);
  }
});

export default app;
