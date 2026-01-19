import { FileText, FileInput, Receipt, Check, Clock, Pause, X, ChevronRight, FileDown, Plus, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DocumentWithMeta, DocumentStatus, DocumentType } from '@/types';
import { cn, formatNumber, formatDateThai } from '@/lib/utils';

interface DeletedDocument {
  id: string;
  documentNumber: string;
  deletedAt: string;
}

interface ChainDocument {
  id: string;
  type: DocumentType;
  documentNumber?: string;
  status?: DocumentStatus;
  total?: number;
  exists: boolean;
  deleted?: DeletedDocument; // Track deleted documents
}

interface ChainFlowDiagramProps {
  chainId: string | null;
  documents: DocumentWithMeta[];
  onCreateLinked?: (sourceDoc: DocumentWithMeta, targetType: 'invoice' | 'receipt') => void;
  onViewPdf?: (doc: DocumentWithMeta) => void;
  onViewDocument?: (doc: DocumentWithMeta) => void;
}

const statusConfig: Record<DocumentStatus, { label: string; color: string; bgColor: string; icon: typeof Check }> = {
  pending: { label: 'รอดำเนินการ', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  approved: { label: 'อนุมัติ', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Check },
  paid: { label: 'ชำระแล้ว', color: 'text-green-600', bgColor: 'bg-green-100', icon: Check },
  hold: { label: 'ระงับ', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Pause },
  cancelled: { label: 'ยกเลิก', color: 'text-red-600', bgColor: 'bg-red-100', icon: X },
  revised: { label: 'แก้ไขแล้ว', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: FileText },
};

const typeConfig: Record<DocumentType, { label: string; icon: typeof FileText; color: string; bgColor: string }> = {
  quotation: { label: 'ใบเสนอราคา', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  invoice: { label: 'ใบแจ้งหนี้', icon: FileInput, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  receipt: { label: 'ใบเสร็จ', icon: Receipt, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
};

export function ChainFlowDiagram({
  chainId,
  documents,
  onCreateLinked,
  onViewPdf,
  onViewDocument,
}: ChainFlowDiagramProps) {
  // Build chain structure
  const quotation = documents.find(d => d.type === 'quotation');
  const invoice = documents.find(d => d.type === 'invoice');
  const receipt = documents.find(d => d.type === 'receipt');

  // Get deleted documents info from source documents
  const deletedInvoice = (quotation as any)?.deletedLinkedDocuments?.invoice as DeletedDocument | undefined;
  const deletedReceipt = (invoice as any)?.deletedLinkedDocuments?.receipt as DeletedDocument | undefined;

  // Build node data
  const nodes: ChainDocument[] = [
    {
      id: quotation?.id || 'empty-qt',
      type: 'quotation',
      documentNumber: quotation?.documentNumber,
      status: quotation?.status,
      total: quotation ? calculateTotal(quotation) : undefined,
      exists: !!quotation,
    },
    {
      id: invoice?.id || 'empty-inv',
      type: 'invoice',
      documentNumber: invoice?.documentNumber || deletedInvoice?.documentNumber,
      status: invoice?.status,
      total: invoice ? calculateTotal(invoice) : undefined,
      exists: !!invoice,
      deleted: !invoice && deletedInvoice ? deletedInvoice : undefined,
    },
    {
      id: receipt?.id || 'empty-rec',
      type: 'receipt',
      documentNumber: receipt?.documentNumber || deletedReceipt?.documentNumber,
      status: receipt?.status,
      total: receipt ? calculateTotal(receipt) : undefined,
      exists: !!receipt,
      deleted: !receipt && deletedReceipt ? deletedReceipt : undefined,
    },
  ];

  // Calculate arrow states - allow recreation if deleted
  const qtToInvState = getArrowState(quotation, invoice, 'invoice', !!deletedInvoice);
  const invToRecState = getArrowState(invoice, receipt, 'receipt', !!deletedReceipt);

  function calculateTotal(doc: DocumentWithMeta): number {
    const subtotal = (doc.items || []).reduce(
      (sum, item) => sum + (item?.quantity ?? 0) * (item?.unitPrice ?? 0),
      0
    );
    const taxAmount = subtotal * (doc.taxRate || 0);
    return doc.taxType === 'withholding' ? subtotal - taxAmount : subtotal + taxAmount;
  }

  function getArrowState(
    source: DocumentWithMeta | undefined, 
    target: DocumentWithMeta | undefined,
    targetType: 'invoice' | 'receipt',
    wasDeleted: boolean = false
  ): 'completed' | 'ready' | 'recreate' | 'waiting' | 'blocked' {
    if (target) return 'completed';
    if (wasDeleted) return 'recreate'; // Can recreate deleted document
    if (!source) return 'blocked';
    if (source.status === 'cancelled' || source.status === 'revised') return 'blocked';
    if (targetType === 'receipt' && source.status !== 'paid') return 'waiting';
    return 'ready';
  }

  function getArrowColor(state: 'completed' | 'ready' | 'recreate' | 'waiting' | 'blocked') {
    switch (state) {
      case 'completed': return 'text-green-500';
      case 'ready': return 'text-blue-500';
      case 'recreate': return 'text-orange-500';
      case 'waiting': return 'text-yellow-500';
      case 'blocked': return 'text-gray-300';
    }
  }

  function handleCreateClick(sourceType: DocumentType, targetType: 'invoice' | 'receipt') {
    const sourceDoc = sourceType === 'quotation' ? quotation : invoice;
    if (sourceDoc && onCreateLinked) {
      onCreateLinked(sourceDoc, targetType);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-2 sm:p-4">
        {/* Chain ID Header */}
        {chainId && (
          <div className="text-xs text-gray-400 text-center mb-4">
            Chain ID: {chainId}
          </div>
        )}

        {/* Flow Diagram - Horizontal on desktop, can scroll on mobile */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto pb-2">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center flex-shrink-0">
              {/* Node */}
              <ChainNode
                node={node}
                originalDoc={
                  node.type === 'quotation' ? quotation :
                  node.type === 'invoice' ? invoice : receipt
                }
                onViewPdf={onViewPdf}
                onViewDocument={onViewDocument}
              />

              {/* Arrow */}
              {index < nodes.length - 1 && (
                <div className="flex flex-col items-center mx-1 sm:mx-2">
                  <ChevronRight 
                    className={cn(
                      "h-5 w-5 sm:h-6 sm:w-6",
                      index === 0 ? getArrowColor(qtToInvState) : getArrowColor(invToRecState)
                    )} 
                  />
                  {/* Arrow action button - Create new */}
                  {index === 0 && qtToInvState === 'ready' && onCreateLinked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-blue-600 hover:bg-blue-50 mt-1"
                          onClick={() => handleCreateClick('quotation', 'invoice')}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          INV
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>สร้างใบแจ้งหนี้</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Arrow action button - Recreate deleted invoice */}
                  {index === 0 && qtToInvState === 'recreate' && onCreateLinked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-orange-600 hover:bg-orange-50 mt-1"
                          onClick={() => handleCreateClick('quotation', 'invoice')}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          INV
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>สร้างใบแจ้งหนี้ใหม่ (แทนที่ที่ลบไป)</TooltipContent>
                    </Tooltip>
                  )}
                  {index === 1 && invToRecState === 'ready' && onCreateLinked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-green-600 hover:bg-green-50 mt-1"
                          onClick={() => handleCreateClick('invoice', 'receipt')}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          REC
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>สร้างใบเสร็จ</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Arrow action button - Recreate deleted receipt */}
                  {index === 1 && invToRecState === 'recreate' && onCreateLinked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-orange-600 hover:bg-orange-50 mt-1"
                          onClick={() => handleCreateClick('invoice', 'receipt')}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          REC
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>สร้างใบเสร็จใหม่ (แทนที่ที่ลบไป)</TooltipContent>
                    </Tooltip>
                  )}
                  {index === 1 && invToRecState === 'waiting' && (
                    <span className="text-xs text-yellow-600 mt-1">รอชำระ</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chain Summary */}
        <div className="mt-6 pt-4 border-t text-center">
          <ChainSummary 
            quotation={quotation} 
            invoice={invoice} 
            receipt={receipt} 
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Chain Node Component
interface ChainNodeProps {
  node: ChainDocument;
  originalDoc?: DocumentWithMeta;
  onViewPdf?: (doc: DocumentWithMeta) => void;
  onViewDocument?: (doc: DocumentWithMeta) => void;
}

function ChainNode({ node, originalDoc, onViewPdf, onViewDocument }: ChainNodeProps) {
  const config = typeConfig[node.type];
  const StatusIcon = node.status ? statusConfig[node.status].icon : Clock;
  const Icon = config.icon;

  // Deleted document placeholder
  if (!node.exists && node.deleted) {
    return (
      <div className="w-28 h-28 sm:w-36 sm:h-32 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 flex flex-col items-center justify-center p-2">
        <div className="relative">
          <Icon className="h-6 w-6 text-orange-400 mb-1" />
          <Trash2 className="h-3 w-3 text-orange-500 absolute -top-1 -right-1" />
        </div>
        <span className="text-xs font-medium text-orange-600">{config.label}</span>
        <span className="text-xs text-orange-500 font-mono truncate max-w-full px-1">
          {node.documentNumber?.split('-').slice(-2).join('-') || ''}
        </span>
        <span className="text-xs text-orange-400 mt-0.5">ลบแล้ว</span>
      </div>
    );
  }

  if (!node.exists) {
    // Empty placeholder node
    return (
      <div className="w-28 h-28 sm:w-36 sm:h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-2">
        <Icon className="h-6 w-6 text-gray-300 mb-1" />
        <span className="text-xs font-medium text-gray-400">{config.label}</span>
        <span className="text-xs text-gray-300">ยังไม่มี</span>
      </div>
    );
  }

  const statusCfg = node.status ? statusConfig[node.status] : statusConfig.pending;

  return (
    <div 
      className={cn(
        "w-28 h-28 sm:w-36 sm:h-32 rounded-lg border-2 flex flex-col items-center justify-between p-2 transition-all hover:shadow-md",
        config.bgColor
      )}
    >
      {/* Header with icon and type */}
      <div className="flex items-center gap-1">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-xs font-medium", config.color)}>
          {node.type === 'quotation' && 'QT'}
          {node.type === 'invoice' && 'INV'}
          {node.type === 'receipt' && 'REC'}
        </span>
      </div>

      {/* Document Number */}
      <div className="text-xs font-mono text-gray-700 truncate max-w-full px-1">
        {node.documentNumber?.split('-').slice(-2).join('-') || node.id}
      </div>

      {/* Amount - Make it prominent */}
      {node.total !== undefined && (
        <div className="text-sm sm:text-base font-bold text-gray-800">
          ฿{formatNumber(node.total)}
        </div>
      )}

      {/* Status Badge */}
      <div className={cn(
        "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
        statusCfg.bgColor,
        statusCfg.color
      )}>
        <StatusIcon className="h-3 w-3" />
        <span>{statusCfg.label}</span>
      </div>

      {/* Action Buttons */}
      {originalDoc && (onViewPdf || onViewDocument) && (
        <div className="flex gap-1 mt-1">
          {onViewDocument && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onViewDocument(originalDoc)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>ดูรายละเอียด</TooltipContent>
            </Tooltip>
          )}
          {onViewPdf && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => onViewPdf(originalDoc)}
                >
                  <FileDown className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>ดู PDF</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

// Chain Summary Component
interface ChainSummaryProps {
  quotation?: DocumentWithMeta;
  invoice?: DocumentWithMeta;
  receipt?: DocumentWithMeta;
}

function ChainSummary({ quotation, invoice, receipt }: ChainSummaryProps) {
  // Determine what documents exist in this chain
  const hasQuotation = !!quotation && quotation.status !== 'cancelled';
  const hasInvoice = !!invoice;
  const hasReceipt = !!receipt;
  
  // Calculate total steps based on chain structure
  // A chain could be: QT only, QT->INV, QT->INV->REC, or INV only, INV->REC, etc.
  let totalSteps = 0;
  let completedSteps = 0;
  
  if (quotation || invoice || receipt) {
    // Determine the expected flow
    if (quotation) {
      totalSteps = 3; // QT -> INV -> REC
      if (hasQuotation) completedSteps++;
      if (hasInvoice) completedSteps++;
      if (hasReceipt) completedSteps++;
    } else if (invoice) {
      totalSteps = 2; // INV -> REC (started from invoice)
      if (hasInvoice) completedSteps++;
      if (hasReceipt) completedSteps++;
    } else if (receipt) {
      totalSteps = 1; // REC only
      completedSteps = 1;
    }
  }

  const getChainStatus = (): { label: string; color: string; icon: typeof Check } => {
    if (hasReceipt) {
      return { label: 'เสร็จสมบูรณ์', color: 'text-green-600', icon: Check };
    }
    if (hasInvoice) {
      if (invoice?.status === 'paid') {
        return { label: 'รอออกใบเสร็จ', color: 'text-blue-600', icon: Clock };
      }
      return { label: 'รอชำระเงิน', color: 'text-yellow-600', icon: Clock };
    }
    if (quotation) {
      if (quotation.status === 'cancelled') {
        return { label: 'ยกเลิก', color: 'text-red-600', icon: X };
      }
      return { label: 'รอสร้างใบแจ้งหนี้', color: 'text-purple-600', icon: Clock };
    }
    return { label: 'ไม่มีเอกสาร', color: 'text-gray-400', icon: X };
  };

  const status = getChainStatus();
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Progress Dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, step) => (
          <div
            key={step}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all",
              step < completedSteps ? "bg-green-500" : "bg-gray-200"
            )}
          />
        ))}
        <span className="text-xs text-gray-500 ml-2">
          {completedSteps}/{totalSteps} ขั้นตอน
        </span>
      </div>

      {/* Status */}
      <div className={cn("flex items-center gap-1 text-sm font-medium", status.color)}>
        <StatusIcon className="h-4 w-4" />
        <span>{status.label}</span>
      </div>
    </div>
  );
}
