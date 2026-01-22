import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Pause, X, FileText, Trash2, Search, FileDown, Pencil, GitBranch, FileCheck, Receipt, Link2, Clock, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/useApi';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { ChainFlowDiagram } from './ChainFlowDiagram';
import { NextStepDropdown } from './NextStepDropdown';
import type { DocumentWithMeta, DocumentStatus, DocumentType } from '@/types';
import { cn, formatNumber, formatDateThai, formatDateTimeThai } from '@/lib/utils';

const statusConfig: Record<DocumentStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'รอดำเนินการ', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  approved: { label: 'อนุมัติ', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  paid: { label: 'ชำระแล้ว', color: 'text-green-700', bgColor: 'bg-green-100' },
  hold: { label: 'ระงับ', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  cancelled: { label: 'ยกเลิก', color: 'text-red-700', bgColor: 'bg-red-100' },
  revised: { label: 'แก้ไขแล้ว', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const typeConfig: Record<DocumentType, { label: string; shortLabel: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  quotation: { label: 'ใบเสนอราคา', shortLabel: 'QT', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: <FileText className="w-3 h-3" /> },
  invoice: { label: 'ใบแจ้งหนี้', shortLabel: 'INV', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <FileCheck className="w-3 h-3" /> },
  receipt: { label: 'ใบเสร็จ', shortLabel: 'REC', color: 'text-green-700', bgColor: 'bg-green-100', icon: <Receipt className="w-3 h-3" /> },
};

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

interface OutputFile {
  filename: string;
  size: number;
  createdAt: string;
  url: string;
}

export function QuotationsSection() {
  const navigate = useNavigate();
  const { get, patch, del, post } = useApi();
  const { documents, setDocuments, setLoading, customers, selection, startEdit, startLinkedDocument } = useDashboardStore();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all' | 'archived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [pdfFiles, setPdfFiles] = useState<OutputFile[]>([]);
  const [archivedDocuments, setArchivedDocuments] = useState<DocumentWithMeta[]>([]);
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; doc: DocumentWithMeta | null }>({
    open: false,
    doc: null,
  });

  // Chain view dialog
  const [chainView, setChainView] = useState<{ open: boolean; chainId: string | null; documents: DocumentWithMeta[] }>({
    open: false,
    chainId: null,
    documents: [],
  });
  const [loadingChain, setLoadingChain] = useState(false);

  useEffect(() => {
    loadData();
    loadPdfFiles();
    loadArchivedDocuments();
  }, []);

  const loadData = async () => {
    setLoading('documents', true);
    const response = await get<DocumentWithMeta[]>('/documents');
    if (response?.success && response.data) {
      // Add default status if not present
      const docsWithStatus = response.data.map((doc) => ({
        ...doc,
        status: doc.status || 'pending',
      }));
      setDocuments(docsWithStatus);
    }
    setLoading('documents', false);
  };

  const loadPdfFiles = async () => {
    const response = await get<OutputFile[]>('/output');
    if (response?.success && response.data) {
      setPdfFiles(response.data);
    }
  };

  const loadArchivedDocuments = async () => {
    const response = await get<DocumentWithMeta[]>('/documents?archived=only');
    if (response?.success && response.data) {
      setArchivedDocuments(response.data);
    }
  };

  const handleArchiveChain = async (chainId: string) => {
    const response = await post(`/documents/chain/${chainId}/archive`, {});
    if (response?.success) {
      loadData();
      loadArchivedDocuments();
      setChainView({ open: false, chainId: null, documents: [] });
    } else {
      alert(response?.error || 'เกิดข้อผิดพลาดในการ Archive');
    }
  };

  const handleDeleteChain = async (chainId: string) => {
    const response = await del(`/documents/chain/${chainId}`);
    if (response?.success) {
      loadArchivedDocuments();
    } else {
      alert(response?.error || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const updateStatus = async (id: string, status: DocumentStatus) => {
    const response = await patch<DocumentWithMeta>(`/documents/${id}/status`, { status });
    if (response?.success) {
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.doc?.id) return;
    
    const response = await del(`/documents/${deleteConfirm.doc.id}`);
    if (response?.success) {
      loadData();
      loadPdfFiles(); // Reload PDF list after delete
    }
    setDeleteConfirm({ open: false, doc: null });
  };

  // Create linked document (Document Chain)
  const handleCreateLinked = async (doc: DocumentWithMeta, targetType: 'invoice' | 'receipt') => {
    if (!doc.id) return;
    
    const response = await post<{
      targetType: DocumentType;
      sourceId: string;
      linkedDocData: Partial<DocumentWithMeta>;
    }>(`/documents/${doc.id}/create-linked`, { targetType });
    
    if (response?.success && response.data) {
      // Store linked document data and navigate to create page
      startLinkedDocument(doc, targetType, response.data.linkedDocData);
      navigate('/create');
    } else {
      // Show error (could use toast here)
      alert(response?.error || 'เกิดข้อผิดพลาด');
    }
  };

  // Open chain view dialog
  const handleViewChain = async (doc: DocumentWithMeta) => {
    if (!doc.id) return;
    
    setLoadingChain(true);
    const response = await get<{ chainId: string | null; documents: DocumentWithMeta[] }>(`/documents/${doc.id}/chain`);
    setLoadingChain(false);
    
    if (response?.success && response.data) {
      setChainView({
        open: true,
        chainId: response.data.chainId,
        documents: response.data.documents,
      });
    }
  };

  // Handle chain actions from dialog
  const handleChainCreateLinked = (sourceDoc: DocumentWithMeta, targetType: 'invoice' | 'receipt') => {
    setChainView({ open: false, chainId: null, documents: [] });
    handleCreateLinked(sourceDoc, targetType);
  };

  const handleChainViewPdf = (doc: DocumentWithMeta) => {
    openPdf(doc);
  };

  // Check if document can create invoice (QT -> INV)
  // Note: 'pending' means user started but didn't complete - allow retry
  const canCreateInvoice = (doc: DocumentWithMeta): boolean => {
    const existingInvoiceId = doc.linkedDocuments?.invoiceId;
    return doc.type === 'quotation' && 
           doc.status !== 'cancelled' && 
           doc.status !== 'revised' &&
           (!existingInvoiceId || existingInvoiceId === 'pending');
  };

  // Check if document can create receipt (INV -> REC, must be paid)
  const canCreateReceipt = (doc: DocumentWithMeta): boolean => {
    const existingReceiptId = doc.linkedDocuments?.receiptId;
    return doc.type === 'invoice' && 
           doc.status === 'paid' &&
           (!existingReceiptId || existingReceiptId === 'pending');
  };

  // Check if document has a real linked invoice (not pending)
  const hasRealLinkedInvoice = (doc: DocumentWithMeta): boolean => {
    const invoiceId = doc.linkedDocuments?.invoiceId;
    return !!(invoiceId && invoiceId !== 'pending');
  };

  // Check if document has a real linked receipt (not pending)
  const hasRealLinkedReceipt = (doc: DocumentWithMeta): boolean => {
    const receiptId = doc.linkedDocuments?.receiptId;
    return !!(receiptId && receiptId !== 'pending');
  };

  // Get chain info for document
  const getChainInfo = (doc: DocumentWithMeta): string | null => {
    if (doc.sourceDocumentNumber) {
      return `จาก ${doc.sourceDocumentNumber}`;
    }
    return null;
  };

  // Check if document has chain (either has chainId or real linkedDocuments)
  // Ignore 'pending' values as they represent incomplete attempts
  const hasChain = (doc: DocumentWithMeta): boolean => {
    const invoiceId = doc.linkedDocuments?.invoiceId;
    const receiptId = doc.linkedDocuments?.receiptId;
    const quotationId = doc.linkedDocuments?.quotationId;
    
    const hasRealInvoice = invoiceId && invoiceId !== 'pending';
    const hasRealReceipt = receiptId && receiptId !== 'pending';
    const hasRealQuotation = quotationId && quotationId !== 'pending';
    
    return !!(doc.chainId || hasRealQuotation || hasRealInvoice || hasRealReceipt || doc.sourceDocumentId);
  };

  // Find matching PDF for a document
  const findPdf = (doc: DocumentWithMeta): OutputFile | undefined => {
    const docNumber = doc.documentNumber || doc.id || '';
    const docType = doc.type || '';
    
    // Try to find PDF that matches document number
    return pdfFiles.find(pdf => {
      const pdfName = pdf.filename.toLowerCase();
      const docNumLower = docNumber.toLowerCase();
      
      // Match patterns like "quotation-QT-202601-001.pdf" or "receipt-REC-2024-TEST.pdf"
      return pdfName.includes(docNumLower) || 
             (docType && pdfName.includes(docType) && pdfName.includes(docNumLower.replace(/[^a-z0-9]/gi, '')));
    });
  };

  const openPdf = (doc: DocumentWithMeta) => {
    const pdf = findPdf(doc);
    if (pdf) {
      window.open(`${API_BASE}${pdf.url}`, '_blank');
    }
  };

  // Find a document by ID (for NextStepDropdown)
  const findDocumentById = (id: string): DocumentWithMeta | undefined => {
    return documents.find(d => d.id === id);
  };

  // Handle edit from dropdown
  const handleEditDocument = (doc: DocumentWithMeta) => {
    startEdit(doc);
    navigate('/create');
  };

  // Get customer name by ID
  const getCustomerName = (customerId?: string): string => {
    if (!customerId) return '-';
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '-';
  };

  // Get customer taxId by ID
  const getCustomerTaxId = (customerId?: string): string => {
    if (!customerId) return '';
    const customer = customers.find(c => c.id === customerId);
    return customer?.taxId || '';
  };

  const filteredDocuments = useMemo(() => {
    if (typeFilter === 'archived') return [];
    
    return documents.filter((doc) => {
      if (selection.customerId && doc.customerId !== selection.customerId) {
        return false;
      }
      
      if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
      
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const docNumber = (doc.documentNumber || doc.id || '').toLowerCase();
        const itemDescriptions = (doc.items || []).map(i => i.description.toLowerCase()).join(' ');
        const customerName = getCustomerName(doc.customerId).toLowerCase();
        const customerTaxId = getCustomerTaxId(doc.customerId).toLowerCase();
        
        if (!docNumber.includes(searchLower) && 
            !itemDescriptions.includes(searchLower) &&
            !customerName.includes(searchLower) &&
            !customerTaxId.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }, [documents, typeFilter, statusFilter, searchTerm, selection.customerId, customers]);

  const groupedArchivedChains = useMemo(() => {
    const groups = new Map<string, DocumentWithMeta[]>();
    archivedDocuments.forEach(doc => {
      const chainId = doc.chainId || doc.id || 'unknown';
      if (!groups.has(chainId)) {
        groups.set(chainId, []);
      }
      groups.get(chainId)!.push(doc);
    });
    
    const sortByType = (docs: DocumentWithMeta[]) => {
      const order = { quotation: 1, invoice: 2, receipt: 3 };
      return docs.sort((a, b) => (order[a.type!] || 99) - (order[b.type!] || 99));
    };
    
    return Array.from(groups.entries()).map(([chainId, docs]) => ({
      chainId,
      documents: sortByType(docs),
      quotation: docs.find(d => d.type === 'quotation'),
      archivedAt: docs[0]?.archivedAt,
    }));
  }, [archivedDocuments]);

  const calculateTotal = (doc: DocumentWithMeta) => {
    // If document has pre-calculated taxBreakdown, use it
    if (doc.taxBreakdown?.total !== undefined) {
      return doc.taxBreakdown.total;
    }

    const subtotal = (doc.items || []).reduce(
      (sum, item) => sum + (item?.quantity ?? 0) * (item?.unitPrice ?? 0),
      0
    );

    // Check if using new taxConfig with grossUp
    if (doc.taxConfig) {
      const { vat, withholding, grossUp } = doc.taxConfig;
      let total = subtotal;

      if (grossUp && withholding.enabled) {
        // Gross-up: total = subtotal / (1 - whtRate)
        // Customer pays more so that after withholding, freelancer gets subtotal
        total = subtotal / (1 - withholding.rate);
      } else if (withholding.enabled) {
        // Normal withholding: total = subtotal - (subtotal * whtRate)
        total = subtotal - (subtotal * withholding.rate);
      }

      if (vat.enabled) {
        // Add VAT on top
        total = total + (subtotal * vat.rate);
      }

      return total;
    }

    // Fallback to legacy calculation
    const taxAmount = subtotal * (doc.taxRate || 0);
    return doc.taxType === 'withholding' ? subtotal - taxAmount : subtotal + taxAmount;
  };

  // Get selected customer name for display
  const selectedCustomerName = useMemo(() => {
    if (!selection.customerId) return null;
    const customer = customers.find(c => c.id === selection.customerId);
    return customer?.name;
  }, [selection.customerId, customers]);

  return (
    <Card className="col-span-full min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-3 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">ใบเสนอราคา/เอกสาร</span>
            <span className="sm:hidden">เอกสาร</span>
            <span className="text-xs sm:text-sm font-normal text-gray-500">({filteredDocuments.length})</span>
            {selectedCustomerName && (
              <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[100px] sm:max-w-none">
                {selectedCustomerName}
              </span>
            )}
          </CardTitle>
        </div>
        
        {/* Filters Row - Stacked on mobile */}
        <div className="flex flex-col gap-2">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          
          {/* Type + Status Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <div className="flex gap-1 items-center overflow-x-auto pb-1 sm:pb-0 flex-shrink-0">
              <Button
                size="sm"
                variant={typeFilter === 'all' ? 'default' : 'ghost'}
                className="h-7 text-xs px-2 flex-shrink-0"
                onClick={() => setTypeFilter('all')}
              >
                ทั้งหมด
              </Button>
              {(['quotation', 'invoice', 'receipt'] as const).map((t) => {
                const config = typeConfig[t];
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant={typeFilter === t ? 'default' : 'ghost'}
                    className={cn(
                      "h-7 text-xs gap-1 px-2 flex-shrink-0",
                      typeFilter === t ? '' : `hover:${config.bgColor}`
                    )}
                    onClick={() => setTypeFilter(t)}
                  >
                    {config.icon}
                    <span className="hidden sm:inline">{config.shortLabel}</span>
                  </Button>
                );
              })}
              <Button
                size="sm"
                variant={typeFilter === 'archived' ? 'default' : 'ghost'}
                className={cn(
                  "h-7 text-xs gap-1 px-2 flex-shrink-0",
                  typeFilter === 'archived' ? '' : 'hover:bg-gray-100'
                )}
                onClick={() => setTypeFilter('archived')}
              >
                <Archive className="w-3 h-3" />
                <span className="hidden sm:inline">คลัง</span>
                {archivedDocuments.length > 0 && (
                  <span className="text-xs text-gray-500">({groupedArchivedChains.length})</span>
                )}
              </Button>
            </div>
            
            {/* Status Filter */}
            <div className="flex gap-1 items-center overflow-x-auto pb-1 sm:pb-0 flex-shrink-0">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocumentStatus | 'all')}>
                <SelectTrigger className="w-24 sm:w-28 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">สถานะ: ทั้งหมด</SelectItem>
                  {(['pending', 'approved', 'paid', 'hold', 'cancelled'] as const).map((s) => (
                    <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {typeFilter === 'archived' ? (
          <div className="max-h-80 overflow-auto touch-scroll p-4">
            {groupedArchivedChains.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ไม่มีเอกสารในคลัง
              </div>
            ) : (
              <div className="space-y-3">
                {groupedArchivedChains.map((chain) => {
                  const qt = chain.quotation;
                  const customerName = qt ? getCustomerName(qt.customerId) : '-';
                  const total = qt ? calculateTotal(qt) : 0;
                  
                  return (
                    <div key={chain.chainId} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {qt?.documentNumber || chain.chainId}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({chain.documents.length} เอกสาร)
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {customerName} • ฿{formatNumber(total)}
                          </div>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {chain.documents.map(doc => {
                              const tConfig = doc.type ? typeConfig[doc.type] : null;
                              return (
                                <button
                                  key={doc.id}
                                  onClick={() => openPdf(doc)}
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                    tConfig?.bgColor,
                                    tConfig?.color,
                                    "hover:opacity-80"
                                  )}
                                >
                                  <FileDown className="h-3 w-3" />
                                  {tConfig?.shortLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`ลบ Chain ${qt?.documentNumber || chain.chainId} และเอกสารทั้งหมด?`)) {
                              handleDeleteChain(chain.chainId);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {chain.archivedAt && (
                        <div className="text-xs text-gray-400 mt-2">
                          Archived: {formatDateTimeThai(chain.archivedAt)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <div className="max-h-80 overflow-auto touch-scroll">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2 w-24 sm:w-32">เลขเอกสาร</th>
                <th className="text-left p-2 hidden sm:table-cell w-16">ประเภท</th>
                <th className="text-left p-2 hidden lg:table-cell w-28">ลูกค้า</th>
                <th className="text-left p-2 hidden md:table-cell w-20">วันที่</th>
                <th className="text-right p-2 w-20">ยอดรวม</th>
                <th className="text-center p-2 hidden sm:table-cell w-16">สถานะ</th>
                <th className="text-center p-2 hidden md:table-cell w-20">Next</th>
                <th className="text-center p-2 w-16 sm:w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {selection.customerId ? 'ไม่พบเอกสารของลูกค้านี้' : 'ไม่พบเอกสาร'}
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const status = doc.status || 'pending';
                  const config = statusConfig[status];
                  const customerName = getCustomerName(doc.customerId);
                  const hasPdf = !!findPdf(doc);
                  const chainInfo = getChainInfo(doc);
                  
                  return (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        <div className="font-medium">{doc.documentNumber || doc.id}</div>
                        {chainInfo && (
                          <button
                            onClick={() => handleViewChain(doc)}
                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 hover:underline"
                          >
                            <Link2 className="h-3 w-3" />
                            {chainInfo}
                          </button>
                        )}
                        {!chainInfo && hasChain(doc) && (
                          <button
                            onClick={() => handleViewChain(doc)}
                            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"
                          >
                            <GitBranch className="h-3 w-3" />
                            ดู Chain
                          </button>
                        )}
                      </td>
                      <td className="p-2 hidden sm:table-cell">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          doc.type === 'quotation' && 'bg-purple-100 text-purple-700',
                          doc.type === 'invoice' && 'bg-blue-100 text-blue-700',
                          doc.type === 'receipt' && 'bg-green-100 text-green-700',
                          !doc.type && 'bg-gray-100'
                        )}>
                          {doc.type === 'quotation' && 'ใบเสนอราคา'}
                          {doc.type === 'invoice' && 'ใบแจ้งหนี้'}
                          {doc.type === 'receipt' && 'ใบเสร็จ'}
                          {!doc.type && 'เอกสาร'}
                        </span>
                      </td>
                      <td className="p-2 hidden lg:table-cell">
                        <span className="text-gray-600 truncate max-w-[150px] block">
                          {customerName}
                        </span>
                      </td>
                      <td className="p-2 hidden md:table-cell text-gray-600 text-xs">
                        {(doc as any).createdAt 
                          ? formatDateTimeThai((doc as any).createdAt)
                          : doc.issueDate 
                            ? formatDateThai(doc.issueDate) 
                            : '-'
                        }
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatNumber(calculateTotal(doc))}
                      </td>
                      <td className="p-2 text-center hidden sm:table-cell">
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded",
                            config.bgColor,
                            config.color
                          )}
                        >
                          {config.label}
                        </span>
                      </td>
                      {/* Next Step Column - Interactive Dropdown */}
                      <td className="p-2 text-center hidden md:table-cell">
                        <NextStepDropdown
                          doc={doc}
                          onViewPdf={openPdf}
                          onViewChain={handleViewChain}
                          onEdit={handleEditDocument}
                          onCreateLinked={handleCreateLinked}
                          findLinkedDocument={findDocumentById}
                        />
                      </td>
                      <td className="p-2">
                        {/* Mobile: Show only essential actions */}
                        <div className="flex gap-1 justify-center">
                          {/* View PDF - always important */}
                          {hasPdf && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 sm:h-7 sm:w-7 text-blue-600"
                              title="ดู PDF"
                              onClick={() => openPdf(doc)}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Status buttons - hidden on mobile */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600 hidden sm:flex"
                            title="ชำระแล้ว"
                            onClick={() => updateStatus(doc.id || '', 'paid')}
                            disabled={status === 'paid'}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-yellow-600 hidden sm:flex"
                            title="รอดำเนินการ"
                            onClick={() => updateStatus(doc.id || '', 'pending')}
                            disabled={status === 'pending'}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-gray-600 hidden sm:flex"
                            title="ยกเลิก"
                            onClick={() => updateStatus(doc.id || '', 'cancelled')}
                            disabled={status === 'cancelled'}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          {/* Edit - important, show on mobile */}
                          {status !== 'cancelled' && status !== 'revised' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 sm:h-7 sm:w-7 text-purple-600"
                              title="แก้ไข"
                              onClick={() => {
                                startEdit(doc);
                                navigate('/create');
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Delete - show on mobile but smaller */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 sm:h-7 sm:w-7 text-red-600"
                            title="ลบ"
                            onClick={() => setDeleteConfirm({ open: true, doc })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, doc: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบเอกสาร</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบเอกสาร <strong>{deleteConfirm.doc?.documentNumber || deleteConfirm.doc?.id}</strong> หรือไม่?
              <br />
              <span className="text-red-600">การดำเนินการนี้จะลบไฟล์ PDF ที่เกี่ยวข้องด้วย และไม่สามารถย้อนกลับได้</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              ลบเอกสาร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chain View Dialog */}
      <Dialog open={chainView.open} onOpenChange={(open) => !open && setChainView({ open: false, chainId: null, documents: [] })}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-blue-600" />
              Document Chain View
            </DialogTitle>
          </DialogHeader>
          
          {loadingChain ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              กำลังโหลด...
            </div>
          ) : (
            <ChainFlowDiagram
              chainId={chainView.chainId}
              documents={chainView.documents}
              onCreateLinked={handleChainCreateLinked}
              onViewPdf={handleChainViewPdf}
              onViewDocument={(doc) => {
                setChainView({ open: false, chainId: null, documents: [] });
              }}
              onEditDocument={(doc) => {
                setChainView({ open: false, chainId: null, documents: [] });
                handleEditDocument(doc);
              }}
              onArchiveChain={chainView.chainId ? handleArchiveChain : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
