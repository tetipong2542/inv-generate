// Types for Pacioli Web App

export interface LineItem {
  description: string;
  details?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Customer {
  id?: string;
  name: string;
  company?: string;
  address: string;
  taxId: string;
  phone?: string;
}

export interface BankInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  swift?: string;
}

export interface FreelancerConfig {
  id?: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  address: string;
  taxId: string;
  signature?: string;
  bankInfo: BankInfo;
}

export interface BaseDocument {
  documentNumber: string;
  issueDate: string;
  items: LineItem[];
  taxRate: number;
  taxType: 'withholding' | 'vat';
  taxLabel: string;
  notes?: string;
  paymentTerms?: string[];
}

export interface InvoiceData extends BaseDocument {
  dueDate: string;
}

export interface QuotationData extends BaseDocument {
  validUntil: string;
}

export interface ReceiptData extends BaseDocument {
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  paidAmount: number;
}

export type DocumentType = 'invoice' | 'quotation' | 'receipt';
export type DocumentData = InvoiceData | QuotationData | ReceiptData;

export interface FormState {
  currentStep: number;
  documentType: DocumentType;
  freelancer: FreelancerConfig | null;
  customer: Customer | null;
  document: Partial<DocumentData>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Service/Package types
export type ServiceType = 'item' | 'package';

export interface ServicePackage {
  id?: string;
  type?: ServiceType;
  name: string;
  description: string;
  items: LineItem[];
  category?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Document status types
export type DocumentStatus = 'pending' | 'approved' | 'paid' | 'hold' | 'cancelled' | 'revised';

export interface DocumentWithMeta extends BaseDocument {
  id?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  statusUpdatedAt?: string;
  customerId?: string;
  freelancerId?: string;
  dueDate?: string;
  validUntil?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paidAmount?: number;
  // Revision tracking
  originalDocumentNumber?: string;  // e.g., "QT-202601-006" for revision "QT-202601-006-R1"
  revisionNumber?: number;          // 1, 2, 3...
  revisedAt?: string;
  // Document Chain - link related documents together
  chainId?: string;                 // Group documents in same chain (e.g., "chain-uuid")
  sourceDocumentId?: string;        // Which document this was created from (e.g., QT id for INV)
  sourceDocumentNumber?: string;    // Source document number for display
  linkedDocuments?: {
    quotationId?: string;           // Reference to quotation
    invoiceId?: string;             // Reference to invoice  
    receiptId?: string;             // Reference to receipt
  };
  // Tax config for multi-tax support
  taxConfig?: TaxConfig;
  taxBreakdown?: TaxBreakdown;
}

// Dashboard selection state
export interface DashboardSelection {
  freelancerId: string | null;
  customerId: string | null;
  serviceIds: string[];
}

// Tax Configuration Types
export interface TaxConfig {
  vat: {
    enabled: boolean;
    rate: number; // 0.07 = 7%
  };
  withholding: {
    enabled: boolean;
    rate: number; // 0.03 = 3%, 0.05 = 5%
  };
  grossUp: boolean; // true = ลูกค้าจ่ายภาษี (บวกราคาให้ลบได้ราคาจริง)
}

export interface DocumentProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'company' | 'individual' | 'overseas';
  taxConfig: TaxConfig;
  defaultPaymentTerms?: string[];
  defaultNotes?: string;
}

// Extended BaseDocument with multi-tax support
export interface TaxBreakdown {
  subtotal: number;        // ราคาก่อนภาษี
  vatAmount: number;       // VAT 7%
  withholdingAmount: number; // หัก ณ ที่จ่าย
  total: number;           // รวมสุทธิที่รับจริง
  grossUpAmount?: number;  // จำนวนที่บวกเพิ่มเพื่อให้ได้ราคาจริง
}

export interface MultiTaxDocument {
  taxConfig: TaxConfig;
  taxBreakdown?: TaxBreakdown;
  profileId?: string; // อ้างอิง DocumentProfile ที่ใช้
}
