import { create } from 'zustand';
import type { FormState, DocumentType, FreelancerConfig, Customer, DocumentData, LineItem, DocumentWithMeta, TaxConfig } from '@/types';

interface EditingState {
  isRevision: boolean;
  originalDocumentNumber: string | null;
  originalDocumentId: string | null;
}

interface LinkedState {
  isLinked: boolean;
  sourceDocumentId: string | null;
  sourceDocumentNumber: string | null;
  chainId: string | null;
  originalData: {
    profileId?: string;
    taxConfig?: TaxConfig;
    paymentTerms?: string[];
    notes?: string;
    items?: any[];
    discount?: any;
    partialPayment?: any;
  } | null;
}

interface InstallmentState {
  isInstallment: boolean;
  installmentNumber: number;
  totalContractAmount: number;
  paidToDate: number;
  remainingAmount: number;
  parentChainId: string | null;
  sourceDocument: DocumentWithMeta | null;
}

interface FormStore extends FormState {
  // Edit/Revision state
  editing: EditingState;
  
  // Linked document state (Document Chain)
  linked: LinkedState;
  
  // Installment state (for creating next installment from Archive)
  installment: InstallmentState;
  
  // Navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Document Type
  setDocumentType: (type: DocumentType) => void;
  
  // Freelancer
  setFreelancer: (freelancer: FreelancerConfig | null) => void;
  
  // Customer
  setCustomer: (customer: Customer | null) => void;
  
  // Document
  setDocument: (document: Partial<DocumentData>) => void;
  updateDocument: (updates: Partial<DocumentData>) => void;
  addItem: (item: LineItem) => void;
  updateItem: (index: number, item: LineItem) => void;
  removeItem: (index: number) => void;
  
  // Load from existing document (for edit/revision)
  loadFromDocument: (doc: any, customer: Customer | null) => void;
  
  // Load from linked document (for Document Chain: QT -> INV -> REC)
  loadFromLinkedDocument: (sourceDoc: DocumentWithMeta, targetType: DocumentType, linkedData: Partial<DocumentWithMeta>, customer: Customer | null) => void;
  
  loadFromInstallment: (data: { sourceDocument: DocumentWithMeta; installmentNumber: number; totalContractAmount: number; paidToDate: number; parentChainId: string }, customer: Customer | null) => void;
  
  reset: () => void;
}

const initialState: FormState & { editing: EditingState; linked: LinkedState; installment: InstallmentState } = {
  currentStep: 0,
  documentType: 'quotation',
  freelancer: null,
  customer: null,
  document: {
    documentNumber: 'auto',
    issueDate: new Date().toISOString().split('T')[0],
    items: [],
    taxRate: 0.03,
    taxType: 'withholding',
    taxLabel: 'หักภาษี ณ ที่จ่าย (3%)',
    paymentTerms: [],
    notes: '',
  },
  editing: {
    isRevision: false,
    originalDocumentNumber: null,
    originalDocumentId: null,
  },
  linked: {
    isLinked: false,
    sourceDocumentId: null,
    sourceDocumentNumber: null,
    chainId: null,
    originalData: null,
  },
  installment: {
    isInstallment: false,
    installmentNumber: 1,
    totalContractAmount: 0,
    paidToDate: 0,
    remainingAmount: 0,
    parentChainId: null,
    sourceDocument: null,
  },
};

// Types for data mismatch detection
export interface DataMismatch {
  field: string;
  label: string;
  details?: string;
}

// Helper function to compare linked data
export function getLinkedDataMismatches(
  document: Partial<DocumentData>,
  originalData: LinkedState['originalData'],
  freelancer: FreelancerConfig | null
): DataMismatch[] {
  if (!originalData) return [];
  
  const mismatches: DataMismatch[] = [];
  
  // Compare profileId (tax profile)
  const currentProfileId = (document as any).profileId;
  if (originalData.profileId && currentProfileId && originalData.profileId !== currentProfileId) {
    mismatches.push({
      field: 'profileId',
      label: 'โปรไฟล์ภาษี',
    });
  }
  
  // Compare tax config (using new TaxConfig structure with vat/withholding)
  if (originalData.taxConfig) {
    const currentTaxConfig = (document as any).taxConfig as TaxConfig | undefined;
    if (currentTaxConfig) {
      // Compare new-style tax configs
      const vatChanged = 
        originalData.taxConfig.vat.enabled !== currentTaxConfig.vat.enabled ||
        originalData.taxConfig.vat.rate !== currentTaxConfig.vat.rate;
      const whtChanged = 
        originalData.taxConfig.withholding.enabled !== currentTaxConfig.withholding.enabled ||
        originalData.taxConfig.withholding.rate !== currentTaxConfig.withholding.rate;
      const grossUpChanged = originalData.taxConfig.grossUp !== currentTaxConfig.grossUp;
      
      if (vatChanged || whtChanged || grossUpChanged) {
        const changes: string[] = [];
        if (vatChanged) changes.push('VAT');
        if (whtChanged) changes.push('หัก ณ ที่จ่าย');
        if (grossUpChanged) changes.push('Gross-up');
        
        mismatches.push({
          field: 'taxConfig',
          label: 'การคำนวณภาษี',
          details: changes.join(', '),
        });
      }
    }
  }
  
  // Compare payment terms
  const originalTerms = originalData.paymentTerms || [];
  const currentTerms = document.paymentTerms || [];
  if (JSON.stringify(originalTerms) !== JSON.stringify(currentTerms)) {
    const added = currentTerms.filter(t => !originalTerms.includes(t)).length;
    const removed = originalTerms.filter(t => !currentTerms.includes(t)).length;
    let details = '';
    if (added > 0 && removed > 0) {
      details = `เพิ่ม ${added} รายการ, ลบ ${removed} รายการ`;
    } else if (added > 0) {
      details = `เพิ่ม ${added} รายการ`;
    } else if (removed > 0) {
      details = `ลบ ${removed} รายการ`;
    } else {
      details = 'เปลี่ยนลำดับ';
    }
    mismatches.push({
      field: 'paymentTerms',
      label: 'เงื่อนไขการชำระเงิน',
      details,
    });
  }
  
  // Compare notes
  if ((originalData.notes || '') !== (document.notes || '')) {
    mismatches.push({
      field: 'notes',
      label: 'หมายเหตุ',
    });
  }
  
  // Compare items (basic comparison)
  const originalItems = originalData.items || [];
  const currentItems = document.items || [];
  if (JSON.stringify(originalItems) !== JSON.stringify(currentItems)) {
    const countDiff = currentItems.length - originalItems.length;
    let details = '';
    if (countDiff > 0) {
      details = `เพิ่ม ${countDiff} รายการ`;
    } else if (countDiff < 0) {
      details = `ลบ ${Math.abs(countDiff)} รายการ`;
    } else {
      details = 'แก้ไขรายละเอียด';
    }
    mismatches.push({
      field: 'items',
      label: 'รายการสินค้า/บริการ',
      details,
    });
  }
  
  return mismatches;
}

export const useFormStore = create<FormStore>((set, get) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })),
  
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),

  setDocumentType: (documentType) => set({ documentType }),

  setFreelancer: (freelancer) => set({ freelancer }),

  setCustomer: (customer) => set({ customer }),

  setDocument: (document) => set({ document }),

  updateDocument: (updates) => set((state) => ({
    document: { ...state.document, ...updates },
  })),

  addItem: (item) => set((state) => ({
    document: {
      ...state.document,
      items: [...(state.document.items || []), item],
    },
  })),

  updateItem: (index, item) => set((state) => {
    const items = [...(state.document.items || [])];
    items[index] = item;
    return { document: { ...state.document, items } };
  }),

  removeItem: (index) => set((state) => ({
    document: {
      ...state.document,
      items: (state.document.items || []).filter((_, i) => i !== index),
    },
  })),

  reset: () => set(initialState),

  loadFromDocument: (doc, customer) => {
    // Determine tax option from rate and type
    const taxRateMap: Record<string, { rate: number; type: 'withholding' | 'vat'; label: string }> = {
      'withholding-3': { rate: 0.03, type: 'withholding', label: 'หักภาษี ณ ที่จ่าย 3%' },
      'withholding-5': { rate: 0.05, type: 'withholding', label: 'หักภาษี ณ ที่จ่าย 5%' },
      'vat-7': { rate: 0.07, type: 'vat', label: 'ภาษีมูลค่าเพิ่ม 7%' },
      'none': { rate: 0, type: 'withholding', label: 'ไม่มีภาษี' },
    };
    
    // Find matching tax label or use existing
    let taxLabel = doc.taxLabel || 'หักภาษี ณ ที่จ่าย 3%';
    const foundTax = Object.values(taxRateMap).find(
      t => t.rate === doc.taxRate && t.type === doc.taxType
    );
    if (foundTax) {
      taxLabel = foundTax.label;
    }

    // Determine document type
    let docType: DocumentType = 'quotation';
    if (doc.type === 'invoice' || doc.dueDate) {
      docType = 'invoice';
    } else if (doc.type === 'receipt' || doc.paymentDate) {
      docType = 'receipt';
    } else if (doc.type === 'quotation' || doc.validUntil) {
      docType = 'quotation';
    }

    set({
      currentStep: 2,
      documentType: docType,
      customer: customer,
      document: {
        documentNumber: 'auto',
        issueDate: new Date().toISOString().split('T')[0],
        items: doc.items || [],
        taxRate: doc.taxRate ?? 0.03,
        taxType: doc.taxType || 'withholding',
        taxLabel: taxLabel,
        paymentTerms: doc.paymentTerms || [],
        notes: doc.notes || '',
        validUntil: doc.validUntil,
        dueDate: doc.dueDate,
        paymentDate: doc.paymentDate,
        paymentMethod: doc.paymentMethod,
        ...(doc.discount ? { discount: doc.discount } : {}),
        ...(doc.partialPayment ? { partialPayment: doc.partialPayment } : {}),
        ...(doc.taxConfig ? { taxConfig: doc.taxConfig } : {}),
        ...(doc.profileId ? { profileId: doc.profileId } : {}),
      },
      editing: {
        isRevision: true,
        originalDocumentNumber: doc.documentNumber,
        originalDocumentId: doc.id || null,
      },
      linked: {
        isLinked: false,
        sourceDocumentId: null,
        sourceDocumentNumber: null,
        chainId: null,
        originalData: null,
      },
    });
  },

  loadFromLinkedDocument: (sourceDoc, targetType, linkedData, customer) => {
    // Calculate default dates
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get profileId from linkedData or sourceDoc
    const profileId = (linkedData as any).profileId || (sourceDoc as any).profileId || null;

    // Get discount and partialPayment from source
    const sourceDiscount = (linkedData as any).discount || (sourceDoc as any).discount;
    const sourcePartialPayment = (linkedData as any).partialPayment || (sourceDoc as any).partialPayment;

    set({
      currentStep: 2, // Go to Document step (to set due date for INV or review for REC)
      documentType: targetType,
      customer: customer,
      document: {
        documentNumber: 'auto', // Will auto-generate
        issueDate: today,
        items: linkedData.items || sourceDoc.items || [],
        taxRate: linkedData.taxRate ?? sourceDoc.taxRate ?? 0.03,
        taxType: linkedData.taxType || sourceDoc.taxType || 'withholding',
        taxLabel: linkedData.taxLabel || sourceDoc.taxLabel || 'หักภาษี ณ ที่จ่าย 3%',
        paymentTerms: linkedData.paymentTerms || sourceDoc.paymentTerms || [],
        notes: linkedData.notes || sourceDoc.notes || '',
        // Copy discount and partialPayment from source
        ...(sourceDiscount ? { discount: sourceDiscount } : {}),
        ...(sourcePartialPayment ? { partialPayment: sourcePartialPayment } : {}),
        // Type-specific fields for Invoice
        ...(targetType === 'invoice' ? {
          dueDate: thirtyDaysLater, // Default 30 days
        } : {}),
        // Type-specific fields for Receipt
        ...(targetType === 'receipt' ? {
          paymentDate: today,
          paymentMethod: linkedData.paymentMethod || 'โอนเงิน',
          paidAmount: linkedData.paidAmount || 0,
        } : {}),
        // Pass taxConfig and profileId if exists (for auto-select in form)
        ...(linkedData.taxConfig ? { taxConfig: linkedData.taxConfig, profileId } : {}),
        ...(profileId && !linkedData.taxConfig ? { profileId } : {}),
      },
      editing: {
        isRevision: false,
        originalDocumentNumber: null,
        originalDocumentId: null,
      },
      linked: {
        isLinked: true,
        sourceDocumentId: sourceDoc.id || null,
        sourceDocumentNumber: sourceDoc.documentNumber || null,
        chainId: linkedData.chainId || null,
        originalData: {
          profileId,
          taxConfig: linkedData.taxConfig || (sourceDoc as any).taxConfig,
          paymentTerms: linkedData.paymentTerms || sourceDoc.paymentTerms || [],
          notes: linkedData.notes || sourceDoc.notes || '',
          items: linkedData.items || sourceDoc.items || [],
          discount: sourceDiscount,
          partialPayment: sourcePartialPayment,
        },
      },
      installment: (linkedData as any).installment ? {
        isInstallment: true,
        installmentNumber: (linkedData as any).installment.installmentNumber || 1,
        totalContractAmount: (linkedData as any).installment.totalContractAmount || 0,
        paidToDate: (linkedData as any).installment.paidToDate || 0,
        remainingAmount: (linkedData as any).installment.remainingAmount || 0,
        parentChainId: (linkedData as any).installment.parentChainId || null,
        sourceDocument: sourceDoc,
      } : {
        isInstallment: false,
        installmentNumber: 1,
        totalContractAmount: 0,
        paidToDate: 0,
        remainingAmount: 0,
        parentChainId: null,
        sourceDocument: null,
      },
    });
  },

  loadFromInstallment: (data, customer) => {
    const { sourceDocument, installmentNumber, totalContractAmount, paidToDate, parentChainId } = data;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const profileId = (sourceDocument as any).profileId || null;
    const remaining = totalContractAmount - paidToDate;

    set({
      currentStep: 2,
      documentType: 'quotation',
      customer: customer,
      document: {
        documentNumber: 'auto',
        issueDate: today,
        items: sourceDocument.items || [],
        taxRate: sourceDocument.taxRate ?? 0.03,
        taxType: sourceDocument.taxType || 'withholding',
        taxLabel: sourceDocument.taxLabel || 'หักภาษี ณ ที่จ่าย 3%',
        paymentTerms: sourceDocument.paymentTerms || [],
        notes: `งวดที่ ${installmentNumber} | ยอดคงเหลือ: ฿${remaining.toLocaleString()}`,
        validUntil: thirtyDaysLater,
        partialPayment: {
          enabled: true,
          type: 'fixed',
          value: remaining,
          installmentNumber,
          totalInstallments: undefined,
        },
        ...(sourceDocument.taxConfig ? { taxConfig: sourceDocument.taxConfig, profileId } : {}),
        ...(profileId && !sourceDocument.taxConfig ? { profileId } : {}),
      },
      editing: {
        isRevision: false,
        originalDocumentNumber: null,
        originalDocumentId: null,
      },
      linked: {
        isLinked: false,
        sourceDocumentId: null,
        sourceDocumentNumber: null,
        chainId: null,
        originalData: null,
      },
      installment: {
        isInstallment: true,
        installmentNumber,
        totalContractAmount,
        paidToDate,
        remainingAmount: totalContractAmount - paidToDate,
        parentChainId,
        sourceDocument,
      },
    });
  },
}));
