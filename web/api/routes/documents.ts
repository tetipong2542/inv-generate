import { Hono } from 'hono';
import { readdir, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { documentsRepo } from '../db/repository';

const app = new Hono();

const PROJECT_ROOT = process.cwd();
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples');

// Use /data in production (Railway volume), local path in development
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/data' : PROJECT_ROOT;
const OUTPUT_DIR = path.join(DATA_DIR, 'output');

// Use repository for data access (supports both JSON and SQLite)
const USE_REPO = process.env.USE_SQLITE === 'true' || process.env.RAILWAY_ENVIRONMENT;

// GET /api/documents - รายการเอกสารทั้งหมด (excludes archived by default)
app.get('/', async (c) => {
  try {
    const includeArchived = c.req.query('archived') === 'true';
    const onlyArchived = c.req.query('archived') === 'only';
    
    if (USE_REPO) {
      let documents = await documentsRepo.getAll();
      
      if (onlyArchived) {
        documents = documents.filter(d => d.archivedAt);
      } else if (!includeArchived) {
        documents = documents.filter(d => !d.archivedAt);
      }
      
      return c.json({ success: true, data: documents });
    }
    
    // Legacy JSON file handling
    const files = await readdir(EXAMPLES_DIR);
    const documents = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(EXAMPLES_DIR, file);
        const content = await Bun.file(filePath).json();
        
        // Determine document type from content or filename
        let type = 'unknown';
        if (file.includes('invoice') || content.dueDate) {
          type = 'invoice';
        } else if (file.includes('quotation') || content.validUntil) {
          type = 'quotation';
        } else if (file.includes('receipt') || content.paymentDate) {
          type = 'receipt';
        }

        documents.push({
          id: file.replace('.json', ''),
          filename: file,
          type,
          ...content,
        });
      }
    }

    return c.json({ success: true, data: documents });
  } catch (error) {
    return c.json({ success: false, error: 'ไม่สามารถอ่านรายการเอกสารได้' }, 500);
  }
});

// GET /api/documents/:id - ดึงข้อมูลเอกสาร
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (USE_REPO) {
    const doc = await documentsRepo.getById(id);
    if (!doc) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }
    return c.json({ success: true, data: doc });
  }
  
  const filePath = path.join(EXAMPLES_DIR, `${id}.json`);

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }

    const content = await file.json();
    return c.json({ success: true, data: { id, ...content } });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการอ่านเอกสาร' }, 500);
  }
});

// POST /api/documents - สร้างเอกสารใหม่
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, type, ...documentData } = body;

    if (!id || !type) {
      return c.json({ 
        success: false, 
        error: 'กรุณาระบุ id และ type ของเอกสาร' 
      }, 400);
    }

    if (USE_REPO) {
      // Check if exists
      const existing = await documentsRepo.getById(id);
      if (existing) {
        return c.json({ success: false, error: 'มีเอกสารรหัสนี้อยู่แล้ว' }, 409);
      }

      await documentsRepo.create({
        id,
        type,
        documentNumber: documentData.documentNumber || id,
        issueDate: documentData.issueDate || new Date().toISOString().split('T')[0],
        customerId: documentData.customerId,
        status: documentData.status || 'pending',
        ...documentData,
      });

      return c.json({ success: true, data: { id, type, ...documentData } }, 201);
    }

    // Legacy filesystem mode
    await mkdir(EXAMPLES_DIR, { recursive: true });

    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return c.json({ success: false, error: 'มีเอกสารรหัสนี้อยู่แล้ว' }, 409);
    }

    await Bun.write(filePath, JSON.stringify(documentData, null, 2));

    return c.json({ success: true, data: { id, type, ...documentData } }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างเอกสาร' }, 500);
  }
});

// PUT /api/documents/:id - แก้ไขเอกสาร
app.put('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { type, ...documentData } = body;

    if (USE_REPO) {
      const existing = await documentsRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
      }

      await documentsRepo.update(id, { ...documentData });

      return c.json({ success: true, data: { id, type, ...documentData } });
    }

    // Legacy filesystem mode
    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }

    await Bun.write(filePath, JSON.stringify(documentData, null, 2));

    return c.json({ success: true, data: { id, type, ...documentData } });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขเอกสาร' }, 500);
  }
});

// PATCH /api/documents/:id/status - อัพเดทสถานะเอกสาร
app.patch('/:id/status', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { status } = body;

    const validStatuses = ['pending', 'approved', 'paid', 'hold', 'cancelled', 'revised'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({ 
        success: false, 
        error: `สถานะไม่ถูกต้อง (${validStatuses.join(', ')})` 
      }, 400);
    }

    if (USE_REPO) {
      const existing = await documentsRepo.getById(id);
      if (!existing) {
        return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
      }

      await documentsRepo.update(id, { 
        status, 
        statusUpdatedAt: new Date().toISOString() 
      });

      return c.json({ success: true, data: { id, ...existing, status } });
    }

    // Legacy filesystem mode
    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }

    const existingData = await file.json();
    const updatedData = {
      ...existingData,
      status,
      statusUpdatedAt: new Date().toISOString(),
    };

    await Bun.write(filePath, JSON.stringify(updatedData, null, 2));

    return c.json({ success: true, data: { id, ...updatedData } });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการอัพเดทสถานะ' }, 500);
  }
});

// DELETE /api/documents/:id - ลบเอกสาร (พร้อมลบ PDF ถ้ามี และบันทึกประวัติ)
app.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    if (USE_REPO) {
      // SQLite mode
      const doc = await documentsRepo.getById(id);
      if (!doc) {
        return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
      }

      const documentNumber = doc.documentNumber || id;
      const chainId = doc.chainId;
      const sourceDocumentId = doc.sourceDocumentId;
      
      // Check if this is a revision document (has revisionNumber or documentNumber ends with -R*)
      const isRevision = (doc.revisionNumber && doc.revisionNumber > 0) || 
                         (documentNumber && /-R\d+$/.test(documentNumber));
      const originalDocumentId = (doc as any).originalDocumentId;

      // If this document was part of a chain, update the source document
      if (chainId && sourceDocumentId) {
        const sourceDoc = await documentsRepo.getById(sourceDocumentId);
        if (sourceDoc) {
          const docType = doc.type || 'unknown';
          const linkedDocuments = sourceDoc.linkedDocuments || {};
          const deletedLinkedDocuments = sourceDoc.deletedLinkedDocuments || {};
          
          if (docType === 'invoice') {
            deletedLinkedDocuments.invoice = {
              id: id,
              documentNumber: documentNumber,
              deletedAt: new Date().toISOString(),
            };
            delete linkedDocuments.invoiceId;
          } else if (docType === 'receipt') {
            deletedLinkedDocuments.receipt = {
              id: id,
              documentNumber: documentNumber,
              deletedAt: new Date().toISOString(),
            };
            delete linkedDocuments.receiptId;
          }
          
          await documentsRepo.update(sourceDocumentId, { 
            linkedDocuments, 
            deletedLinkedDocuments 
          });
        }
      }

      // If this is a revision, reset the original document status
      if (isRevision && originalDocumentId) {
        const originalDoc = await documentsRepo.getById(originalDocumentId);
        if (originalDoc && originalDoc.status === 'revised') {
          // Check if there are other revisions still existing
          const allDocs = await documentsRepo.getAll();
          const otherRevisions = allDocs.filter(d => 
            d.id !== id && 
            (d as any).originalDocumentId === originalDocumentId
          );
          
          // Only reset if no other revisions exist
          if (otherRevisions.length === 0) {
            // Reset to previous status (approved or pending based on document type)
            const previousStatus = originalDoc.type === 'quotation' ? 'approved' : 'pending';
            await documentsRepo.update(originalDocumentId, { 
              status: previousStatus,
              statusUpdatedAt: new Date().toISOString()
            });
          }
        }
      }

      // Delete document from SQLite
      const deleted = await documentsRepo.delete(id);
      if (!deleted) {
        return c.json({ success: false, error: 'ไม่สามารถลบเอกสารได้' }, 500);
      }

      // Try to delete associated PDF files
      const deletedPdfs: string[] = [];
      try {
        await mkdir(OUTPUT_DIR, { recursive: true });
        const outputFiles = await readdir(OUTPUT_DIR);
        for (const pdfFile of outputFiles) {
          if (pdfFile.endsWith('.pdf') && 
              (pdfFile.includes(documentNumber) || pdfFile.includes(id))) {
            const pdfPath = path.join(OUTPUT_DIR, pdfFile);
            await unlink(pdfPath);
            deletedPdfs.push(pdfFile);
          }
        }
      } catch (pdfError) {
        console.log('PDF deletion skipped:', pdfError);
      }

      return c.json({ 
        success: true, 
        message: 'ลบเอกสารเรียบร้อย',
        deletedPdfs 
      });
    }

    // Legacy JSON file mode
    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }

    // Read document to get info for tracking
    const docData = await file.json();
    const documentNumber = docData.documentNumber || id;
    const chainId = docData.chainId;
    const sourceDocumentId = docData.sourceDocumentId;
    
    // Check if this is a revision document
    const isRevision = (docData.revisionNumber && docData.revisionNumber > 0) || 
                       (documentNumber && /-R\d+$/.test(documentNumber));
    const originalDocumentId = docData.originalDocumentId;

    // If this document was part of a chain, update the source document
    // to mark this linked document as deleted (so user can recreate)
    if (chainId && sourceDocumentId) {
      const sourceFilePath = path.join(EXAMPLES_DIR, `${sourceDocumentId}.json`);
      const sourceFile = Bun.file(sourceFilePath);
      if (await sourceFile.exists()) {
        const sourceDoc = await sourceFile.json();
        sourceDoc.linkedDocuments = sourceDoc.linkedDocuments || {};
        sourceDoc.deletedLinkedDocuments = sourceDoc.deletedLinkedDocuments || {};
        
        // Determine which type was deleted and track it
        const docType = docData.type || 
          (docData.validUntil ? 'quotation' : docData.dueDate ? 'invoice' : docData.paymentDate ? 'receipt' : 'unknown');
        
        if (docType === 'invoice') {
          // Track deleted invoice
          sourceDoc.deletedLinkedDocuments.invoice = {
            id: id,
            documentNumber: documentNumber,
            deletedAt: new Date().toISOString(),
          };
          // Remove from active linkedDocuments
          delete sourceDoc.linkedDocuments.invoiceId;
        } else if (docType === 'receipt') {
          // Track deleted receipt
          sourceDoc.deletedLinkedDocuments.receipt = {
            id: id,
            documentNumber: documentNumber,
            deletedAt: new Date().toISOString(),
          };
          // Remove from active linkedDocuments
          delete sourceDoc.linkedDocuments.receiptId;
        }
        
        await Bun.write(sourceFilePath, JSON.stringify(sourceDoc, null, 2));
      }
    }

    // If this is a revision, reset the original document status
    if (isRevision && originalDocumentId) {
      const originalFilePath = path.join(EXAMPLES_DIR, `${originalDocumentId}.json`);
      const originalFile = Bun.file(originalFilePath);
      if (await originalFile.exists()) {
        const originalDoc = await originalFile.json();
        if (originalDoc.status === 'revised') {
          // Check if there are other revisions still existing
          const examplesFiles = await readdir(EXAMPLES_DIR);
          let hasOtherRevisions = false;
          
          for (const f of examplesFiles) {
            if (f.endsWith('.json') && f !== `${id}.json`) {
              const otherDoc = await Bun.file(path.join(EXAMPLES_DIR, f)).json();
              if (otherDoc.originalDocumentId === originalDocumentId) {
                hasOtherRevisions = true;
                break;
              }
            }
          }
          
          // Only reset if no other revisions exist
          if (!hasOtherRevisions) {
            const docType = originalDoc.type || 
              (originalDoc.validUntil ? 'quotation' : originalDoc.dueDate ? 'invoice' : 'receipt');
            originalDoc.status = docType === 'quotation' ? 'approved' : 'pending';
            originalDoc.statusUpdatedAt = new Date().toISOString();
            await Bun.write(originalFilePath, JSON.stringify(originalDoc, null, 2));
          }
        }
      }
    }

    // Delete JSON file
    await unlink(filePath);

    // Try to delete associated PDF files
    const deletedPdfs: string[] = [];
    try {
      const outputFiles = await readdir(OUTPUT_DIR);
      for (const pdfFile of outputFiles) {
        // Match PDF files that contain the document number or id
        if (pdfFile.endsWith('.pdf') && 
            (pdfFile.includes(documentNumber) || pdfFile.includes(id))) {
          const pdfPath = path.join(OUTPUT_DIR, pdfFile);
          await unlink(pdfPath);
          deletedPdfs.push(pdfFile);
        }
      }
    } catch (pdfError) {
      // Ignore PDF deletion errors (folder may not exist)
      console.log('PDF deletion skipped:', pdfError);
    }

    return c.json({ 
      success: true, 
      message: 'ลบเอกสารเรียบร้อย',
      deletedPdfs 
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบเอกสาร' }, 500);
  }
});

// POST /api/documents/:id/create-linked - สร้างเอกสารใหม่จากเอกสารต้นทาง (Document Chain)
// QT -> INV: ได้เลย (ไม่ต้องรอ approve)
// INV -> REC: ต้องสถานะ "paid" ก่อน
app.post('/:id/create-linked', async (c) => {
  const sourceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { targetType } = body; // 'invoice' | 'receipt'

    if (!targetType || !['invoice', 'receipt'].includes(targetType)) {
      return c.json({ 
        success: false, 
        error: 'กรุณาระบุ targetType เป็น invoice หรือ receipt' 
      }, 400);
    }

    // Helper function to process create-linked logic
    const processCreateLinked = async (
      sourceDoc: any,
      updateSourceDoc: (updates: any) => Promise<void>
    ) => {
      const sourceType = sourceDoc.type || 
        (sourceDoc.validUntil ? 'quotation' : sourceDoc.dueDate ? 'invoice' : 'unknown');

      // Validate workflow rules
      if (targetType === 'invoice') {
        if (sourceType !== 'quotation') {
          return c.json({ 
            success: false, 
            error: 'สามารถสร้างใบแจ้งหนี้ได้จากใบเสนอราคาเท่านั้น' 
          }, 400);
        }
      } else if (targetType === 'receipt') {
        if (sourceType !== 'invoice') {
          return c.json({ 
            success: false, 
            error: 'สามารถสร้างใบเสร็จได้จากใบแจ้งหนี้เท่านั้น' 
          }, 400);
        }
        if (sourceDoc.status !== 'paid') {
          return c.json({ 
            success: false, 
            error: 'ใบแจ้งหนี้ต้องมีสถานะ "ชำระแล้ว" ก่อนสร้างใบเสร็จ' 
          }, 400);
        }
      }

      // Check if linked document already exists
      const existingInvoiceId = sourceDoc.linkedDocuments?.invoiceId;
      const existingReceiptId = sourceDoc.linkedDocuments?.receiptId;
      const deletedInvoice = sourceDoc.deletedLinkedDocuments?.invoice;
      const deletedReceipt = sourceDoc.deletedLinkedDocuments?.receipt;
      
      if (targetType === 'invoice' && existingInvoiceId && existingInvoiceId !== 'pending') {
        return c.json({ 
          success: false, 
          error: `มีใบแจ้งหนี้ที่สร้างจากใบเสนอราคานี้แล้ว: ${existingInvoiceId}` 
        }, 400);
      }
      if (targetType === 'receipt' && existingReceiptId && existingReceiptId !== 'pending') {
        return c.json({ 
          success: false, 
          error: `มีใบเสร็จที่สร้างจากใบแจ้งหนี้นี้แล้ว: ${existingReceiptId}` 
        }, 400);
      }
      
      // Clean up stale pending/deleted state
      if ((targetType === 'invoice' && (existingInvoiceId === 'pending' || deletedInvoice)) ||
          (targetType === 'receipt' && (existingReceiptId === 'pending' || deletedReceipt))) {
        const linkedDocuments = { ...(sourceDoc.linkedDocuments || {}) };
        const deletedLinkedDocuments = { ...(sourceDoc.deletedLinkedDocuments || {}) };
        
        if (targetType === 'invoice') {
          delete linkedDocuments.invoiceId;
          delete deletedLinkedDocuments.invoice;
        } else if (targetType === 'receipt') {
          delete linkedDocuments.receiptId;
          delete deletedLinkedDocuments.receipt;
        }
        
        await updateSourceDoc({ linkedDocuments, deletedLinkedDocuments });
      }

      // Generate chain ID if not exists
      const chainId = sourceDoc.chainId || `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const subtotal = (sourceDoc.items || []).reduce(
        (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
        0
      );
      
      let total = subtotal;
      if (sourceDoc.taxBreakdown?.total !== undefined) {
        total = sourceDoc.taxBreakdown.total;
      } else if (sourceDoc.taxConfig) {
        const { vat, withholding, grossUp } = sourceDoc.taxConfig;
        if (grossUp && withholding?.enabled) {
          total = subtotal / (1 - (withholding.rate || 0));
        } else if (withholding?.enabled) {
          total = subtotal - (subtotal * (withholding.rate || 0));
        }
        if (vat?.enabled) {
          total = total + (subtotal * (vat.rate || 0));
        }
      } else {
        const taxAmount = subtotal * (sourceDoc.taxRate || 0);
        total = sourceDoc.taxType === 'withholding' ? subtotal - taxAmount : subtotal + taxAmount;
      }
      
      const partialPayment = sourceDoc.partialPayment;
      const installmentData = sourceDoc.installment;
      const baseAmount = installmentData?.remainingAmount || total;
      let actualPaidAmount = total;
      if (partialPayment?.enabled) {
        if (partialPayment.type === 'percent') {
          actualPaidAmount = baseAmount * (partialPayment.value / 100);
        } else if (partialPayment.type === 'fixed') {
          actualPaidAmount = partialPayment.value;
        }
      }

      // Prepare linked document data
      const linkedDocData = {
        items: sourceDoc.items,
        taxRate: sourceDoc.taxRate,
        taxType: sourceDoc.taxType,
        taxLabel: sourceDoc.taxLabel,
        taxConfig: sourceDoc.taxConfig,
        profileId: sourceDoc.profileId,
        freelancerId: sourceDoc.freelancerId,
        notes: sourceDoc.notes,
        paymentTerms: sourceDoc.paymentTerms,
        customerId: sourceDoc.customerId,
        chainId,
        sourceDocumentId: sourceId,
        sourceDocumentNumber: sourceDoc.documentNumber,
        partialPayment: sourceDoc.partialPayment,
        installment: sourceDoc.installment,
        ...(targetType === 'invoice' ? { dueDate: sourceDoc.validUntil || '' } : {}),
        ...(targetType === 'receipt' ? {
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'โอนเงิน',
          paidAmount: Math.round(actualPaidAmount * 100) / 100,
        } : {}),
      };

      return c.json({ 
        success: true, 
        data: {
          targetType,
          sourceId,
          sourceType,
          sourceDocumentNumber: sourceDoc.documentNumber,
          chainId,
          linkedDocData,
        },
        message: `พร้อมสร้าง${targetType === 'invoice' ? 'ใบแจ้งหนี้' : 'ใบเสร็จ'}จาก ${sourceDoc.documentNumber}`
      });
    };

    if (USE_REPO) {
      // SQLite mode
      const sourceDoc = await documentsRepo.getById(sourceId);
      if (!sourceDoc) {
        return c.json({ success: false, error: 'ไม่พบเอกสารต้นทาง' }, 404);
      }

      return processCreateLinked(sourceDoc, async (updates) => {
        await documentsRepo.update(sourceId, updates);
      });
    }

    // Legacy JSON file mode
    const sourceFilePath = path.join(EXAMPLES_DIR, `${sourceId}.json`);
    const sourceFile = Bun.file(sourceFilePath);
    if (!(await sourceFile.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสารต้นทาง' }, 404);
    }

    const sourceDoc = await sourceFile.json();
    return processCreateLinked(sourceDoc, async (updates) => {
      const updatedDoc = { ...sourceDoc, ...updates };
      await Bun.write(sourceFilePath, JSON.stringify(updatedDoc, null, 2));
    });
  } catch (error) {
    console.error('Create linked error:', error);
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการเตรียมข้อมูล' }, 500);
  }
});

// POST /api/documents/chain/:chainId/archive - Archive ทั้ง chain
app.post('/chain/:chainId/archive', async (c) => {
  const chainId = c.req.param('chainId');

  try {
    if (!USE_REPO) {
      return c.json({ success: false, error: 'Archive requires SQLite mode' }, 400);
    }

    const allDocs = await documentsRepo.getAll();
    const chainDocs = allDocs.filter(d => d.chainId === chainId);

    if (chainDocs.length === 0) {
      return c.json({ success: false, error: 'ไม่พบเอกสารใน chain นี้' }, 404);
    }

    const archivedAt = new Date().toISOString();
    for (const doc of chainDocs) {
      await documentsRepo.update(doc.id, { archived_at: archivedAt });
    }

    return c.json({ 
      success: true, 
      message: `Archive ${chainDocs.length} เอกสารเรียบร้อย`,
      data: { chainId, archivedAt, documentCount: chainDocs.length }
    });
  } catch (error) {
    console.error('Archive chain error:', error);
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการ Archive' }, 500);
  }
});

// DELETE /api/documents/chain/:chainId - Delete ทั้ง chain (สำหรับ archived)
app.delete('/chain/:chainId', async (c) => {
  const chainId = c.req.param('chainId');

  try {
    if (!USE_REPO) {
      return c.json({ success: false, error: 'Delete chain requires SQLite mode' }, 400);
    }

    const allDocs = await documentsRepo.getAll();
    const chainDocs = allDocs.filter(d => d.chainId === chainId);

    if (chainDocs.length === 0) {
      return c.json({ success: false, error: 'ไม่พบเอกสารใน chain นี้' }, 404);
    }

    const deletedIds: string[] = [];
    for (const doc of chainDocs) {
      await documentsRepo.delete(doc.id);
      deletedIds.push(doc.id);
    }

    return c.json({ 
      success: true, 
      message: `ลบ ${deletedIds.length} เอกสารเรียบร้อย`,
      data: { chainId, deletedIds }
    });
  } catch (error) {
    console.error('Delete chain error:', error);
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบ chain' }, 500);
  }
});

// GET /api/documents/:id/chain - ดูเอกสารทั้ง chain
app.get('/:id/chain', async (c) => {
  const id = c.req.param('id');

  try {
    // Helper to sort by document type order
    const sortByTypeOrder = (docs: any[]) => {
      const typeOrder = { quotation: 1, invoice: 2, receipt: 3 };
      return docs.sort((a, b) => {
        const orderA = typeOrder[a.type as keyof typeof typeOrder] || 99;
        const orderB = typeOrder[b.type as keyof typeof typeOrder] || 99;
        return orderA - orderB;
      });
    };

    // Helper to find all related documents by traversing relationships
    const findChainDocuments = (docs: any[], startDoc: any): any[] => {
      const chainDocs = new Map<string, any>();
      const visited = new Set<string>();
      
      const traverse = (doc: any) => {
        if (!doc || visited.has(doc.id)) return;
        visited.add(doc.id);
        chainDocs.set(doc.id, doc);
        
        // Find source document (parent)
        if (doc.sourceDocumentId) {
          const sourceDoc = docs.find(d => d.id === doc.sourceDocumentId);
          if (sourceDoc) traverse(sourceDoc);
        }
        
        // Find linked documents (children) - check linkedDocuments object
        const linkedInvoiceId = doc.linkedDocuments?.invoiceId;
        const linkedReceiptId = doc.linkedDocuments?.receiptId;
        
        if (linkedInvoiceId && linkedInvoiceId !== 'pending') {
          const linkedDoc = docs.find(d => d.id === linkedInvoiceId);
          if (linkedDoc) traverse(linkedDoc);
        }
        if (linkedReceiptId && linkedReceiptId !== 'pending') {
          const linkedDoc = docs.find(d => d.id === linkedReceiptId);
          if (linkedDoc) traverse(linkedDoc);
        }
        
        // Find documents that reference this document as source
        const childDocs = docs.filter(d => d.sourceDocumentId === doc.id);
        childDocs.forEach(traverse);
        
        // Find documents with same chainId
        if (doc.chainId) {
          const sameChainDocs = docs.filter(d => d.chainId === doc.chainId);
          sameChainDocs.forEach(traverse);
        }
      };
      
      traverse(startDoc);
      return Array.from(chainDocs.values());
    };

    if (USE_REPO) {
      // SQLite mode
      const doc = await documentsRepo.getById(id);
      if (!doc) {
        return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
      }

      // Get all documents and find related ones
      const allDocs = await documentsRepo.getAll();
      const chainDocs = findChainDocuments(allDocs, doc);
      
      // Determine chainId from any document in the chain
      const chainId = chainDocs.find(d => d.chainId)?.chainId || null;

      return c.json({ 
        success: true, 
        data: { chainId, documents: sortByTypeOrder(chainDocs) }
      });
    }

    // Legacy JSON file mode
    const filePath = path.join(EXAMPLES_DIR, `${id}.json`);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ success: false, error: 'ไม่พบเอกสาร' }, 404);
    }

    const doc = await file.json();
    doc.id = id;

    // Load all documents
    const files = await readdir(EXAMPLES_DIR);
    const allDocs = [];
    for (const f of files) {
      if (f.endsWith('.json')) {
        const docPath = path.join(EXAMPLES_DIR, f);
        const content = await Bun.file(docPath).json();
        allDocs.push({ id: f.replace('.json', ''), ...content });
      }
    }

    const chainDocs = findChainDocuments(allDocs, doc);
    const chainId = chainDocs.find(d => d.chainId)?.chainId || null;

    return c.json({ 
      success: true, 
      data: { chainId, documents: sortByTypeOrder(chainDocs) }
    });
  } catch (error) {
    return c.json({ success: false, error: 'เกิดข้อผิดพลาด' }, 500);
  }
});

export default app;
