import { useState } from 'react';
import { 
  ChevronDown, 
  FileDown, 
  GitBranch, 
  Pencil, 
  RefreshCw, 
  Plus,
  FileInput,
  Receipt,
  Check,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DocumentWithMeta, DocumentType } from '@/types';
import { cn } from '@/lib/utils';

interface DeletedLinkedDocument {
  id: string;
  documentNumber: string;
  deletedAt: string;
}

interface NextStepDropdownProps {
  doc: DocumentWithMeta;
  onViewPdf?: (doc: DocumentWithMeta) => void;
  onViewChain?: (doc: DocumentWithMeta) => void;
  onEdit?: (doc: DocumentWithMeta) => void;
  onCreateLinked?: (doc: DocumentWithMeta, targetType: 'invoice' | 'receipt') => void;
  findLinkedDocument?: (id: string) => DocumentWithMeta | undefined;
}

type NextStepState = 
  | 'can_create_invoice'      // QT -> สร้าง INV ได้
  | 'has_invoice'             // QT -> มี INV แล้ว
  | 'invoice_deleted'         // QT -> INV ถูกลบ สร้างใหม่ได้
  | 'can_create_receipt'      // INV (paid) -> สร้าง REC ได้
  | 'waiting_payment'         // INV (not paid) -> รอชำระ
  | 'has_receipt'             // INV -> มี REC แล้ว
  | 'receipt_deleted'         // INV -> REC ถูกลบ สร้างใหม่ได้
  | 'completed'               // REC -> เสร็จสมบูรณ์
  | 'cancelled'               // ยกเลิกแล้ว
  | 'none';                   // ไม่มี next step

function getNextStepState(doc: DocumentWithMeta): NextStepState {
  if (doc.status === 'cancelled') return 'cancelled';
  
  const invoiceId = doc.linkedDocuments?.invoiceId;
  const receiptId = doc.linkedDocuments?.receiptId;
  const deletedInvoice = (doc as any).deletedLinkedDocuments?.invoice;
  const deletedReceipt = (doc as any).deletedLinkedDocuments?.receipt;
  
  if (doc.type === 'quotation') {
    if (deletedInvoice) return 'invoice_deleted';
    if (invoiceId && invoiceId !== 'pending') return 'has_invoice';
    return 'can_create_invoice';
  }
  
  if (doc.type === 'invoice') {
    if (deletedReceipt) return 'receipt_deleted';
    if (receiptId && receiptId !== 'pending') return 'has_receipt';
    if (doc.status === 'paid') return 'can_create_receipt';
    return 'waiting_payment';
  }
  
  if (doc.type === 'receipt') {
    return 'completed';
  }
  
  return 'none';
}

const stateConfig: Record<NextStepState, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  icon: typeof Check;
  clickable: boolean;
}> = {
  can_create_invoice: {
    label: 'สร้างใบแจ้งหนี้',
    shortLabel: '+ INV',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    icon: Plus,
    clickable: true,
  },
  has_invoice: {
    label: 'มีใบแจ้งหนี้แล้ว',
    shortLabel: 'INV',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    icon: FileInput,
    clickable: true,
  },
  invoice_deleted: {
    label: 'สร้าง INV ใหม่',
    shortLabel: '🔄 INV',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    icon: RefreshCw,
    clickable: true,
  },
  can_create_receipt: {
    label: 'สร้างใบเสร็จ',
    shortLabel: '+ REC',
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
    icon: Plus,
    clickable: true,
  },
  waiting_payment: {
    label: 'รอชำระเงิน',
    shortLabel: 'รอชำระ',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: Clock,
    clickable: false,
  },
  has_receipt: {
    label: 'มีใบเสร็จแล้ว',
    shortLabel: 'REC',
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
    icon: Receipt,
    clickable: true,
  },
  receipt_deleted: {
    label: 'สร้าง REC ใหม่',
    shortLabel: '🔄 REC',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    icon: RefreshCw,
    clickable: true,
  },
  completed: {
    label: 'เสร็จสมบูรณ์',
    shortLabel: 'เสร็จ',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    icon: Check,
    clickable: false,
  },
  cancelled: {
    label: 'ยกเลิกแล้ว',
    shortLabel: 'ยกเลิก',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: AlertTriangle,
    clickable: false,
  },
  none: {
    label: '-',
    shortLabel: '-',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: Check,
    clickable: false,
  },
};

export function NextStepDropdown({
  doc,
  onViewPdf,
  onViewChain,
  onEdit,
  onCreateLinked,
  findLinkedDocument,
}: NextStepDropdownProps) {
  const state = getNextStepState(doc);
  const config = stateConfig[state];
  const Icon = config.icon;
  
  // Get linked document info
  const invoiceId = doc.linkedDocuments?.invoiceId;
  const receiptId = doc.linkedDocuments?.receiptId;
  const deletedInvoice = (doc as any).deletedLinkedDocuments?.invoice as DeletedLinkedDocument | undefined;
  const deletedReceipt = (doc as any).deletedLinkedDocuments?.receipt as DeletedLinkedDocument | undefined;
  
  // Find actual linked documents
  const linkedInvoice = invoiceId && invoiceId !== 'pending' && findLinkedDocument 
    ? findLinkedDocument(invoiceId) 
    : undefined;
  const linkedReceipt = receiptId && receiptId !== 'pending' && findLinkedDocument 
    ? findLinkedDocument(receiptId) 
    : undefined;

  // Non-clickable states - just show badge
  if (!config.clickable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-xs rounded border",
              config.bgColor,
              config.color
            )}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{config.shortLabel}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Clickable states - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs gap-1 border",
            config.bgColor,
            config.color
          )}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{config.shortLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Header showing linked document info */}
        {(state === 'has_invoice' || state === 'invoice_deleted') && (
          <div className="px-2 py-1.5 text-xs text-gray-500 border-b">
            {state === 'has_invoice' && linkedInvoice && (
              <span className="font-medium text-blue-600">
                📄 {linkedInvoice.documentNumber || invoiceId}
              </span>
            )}
            {state === 'invoice_deleted' && deletedInvoice && (
              <span className="font-medium text-orange-600">
                🗑️ {deletedInvoice.documentNumber} (ลบแล้ว)
              </span>
            )}
          </div>
        )}
        {(state === 'has_receipt' || state === 'receipt_deleted') && (
          <div className="px-2 py-1.5 text-xs text-gray-500 border-b">
            {state === 'has_receipt' && linkedReceipt && (
              <span className="font-medium text-green-600">
                📄 {linkedReceipt.documentNumber || receiptId}
              </span>
            )}
            {state === 'receipt_deleted' && deletedReceipt && (
              <span className="font-medium text-orange-600">
                🗑️ {deletedReceipt.documentNumber} (ลบแล้ว)
              </span>
            )}
          </div>
        )}

        {/* View PDF of linked document */}
        {state === 'has_invoice' && linkedInvoice && onViewPdf && (
          <DropdownMenuItem onClick={() => onViewPdf(linkedInvoice)}>
            <FileDown className="h-4 w-4 mr-2" />
            ดู PDF ใบแจ้งหนี้
          </DropdownMenuItem>
        )}
        {state === 'has_receipt' && linkedReceipt && onViewPdf && (
          <DropdownMenuItem onClick={() => onViewPdf(linkedReceipt)}>
            <FileDown className="h-4 w-4 mr-2" />
            ดู PDF ใบเสร็จ
          </DropdownMenuItem>
        )}

        {/* View Chain */}
        {onViewChain && (
          <DropdownMenuItem onClick={() => onViewChain(doc)}>
            <GitBranch className="h-4 w-4 mr-2" />
            ดู Document Chain
          </DropdownMenuItem>
        )}

        {/* Edit linked document */}
        {state === 'has_invoice' && linkedInvoice && onEdit && (
          <DropdownMenuItem onClick={() => onEdit(linkedInvoice)}>
            <Pencil className="h-4 w-4 mr-2" />
            แก้ไขใบแจ้งหนี้
          </DropdownMenuItem>
        )}
        {state === 'has_receipt' && linkedReceipt && onEdit && (
          <DropdownMenuItem onClick={() => onEdit(linkedReceipt)}>
            <Pencil className="h-4 w-4 mr-2" />
            แก้ไขใบเสร็จ
          </DropdownMenuItem>
        )}

        {/* Create new linked document */}
        {state === 'can_create_invoice' && onCreateLinked && (
          <DropdownMenuItem 
            onClick={() => onCreateLinked(doc, 'invoice')}
            className="text-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            สร้างใบแจ้งหนี้
          </DropdownMenuItem>
        )}
        {state === 'invoice_deleted' && onCreateLinked && (
          <DropdownMenuItem 
            onClick={() => onCreateLinked(doc, 'invoice')}
            className="text-orange-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            สร้างใบแจ้งหนี้ใหม่
          </DropdownMenuItem>
        )}
        {state === 'can_create_receipt' && onCreateLinked && (
          <DropdownMenuItem 
            onClick={() => onCreateLinked(doc, 'receipt')}
            className="text-green-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            สร้างใบเสร็จ
          </DropdownMenuItem>
        )}
        {state === 'receipt_deleted' && onCreateLinked && (
          <DropdownMenuItem 
            onClick={() => onCreateLinked(doc, 'receipt')}
            className="text-orange-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            สร้างใบเสร็จใหม่
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
