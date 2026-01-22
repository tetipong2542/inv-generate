import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFormStore, getLinkedDataMismatches } from '@/hooks/useFormStore';
import { useApi } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, User, Building2, CheckCircle2, Download, Loader2, AlertCircle, ExternalLink, Eye, Upload, Pen, Trash2, Image, Calculator, Check, AlertTriangle } from 'lucide-react';
import { formatNumber, formatDateThai } from '@/lib/utils';
import { calculateTaxBreakdown, DEFAULT_PROFILES } from './DocumentProfileSelector';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DocumentType, TaxConfig } from '@/types';

const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

const typeLabels: Record<DocumentType, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

interface Signature {
  filename: string;
  path: string;
  url: string;
  size: number;
  createdAt: string;
}

export function PreviewStep() {
  const { documentType, freelancer, customer, document, editing, linked, installment, prevStep, reset } = useFormStore();
  const { loading, error, post, get } = useApi();
  const [result, setResult] = useState<{ filename: string; documentNumber: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Signature states
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  const [skipSignature, setSkipSignature] = useState(false); // Allow bypass signature
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect data mismatches for linked documents
  const dataMismatches = useMemo(() => {
    if (!linked.isLinked || !linked.originalData) return [];
    return getLinkedDataMismatches(document, linked.originalData, freelancer);
  }, [linked.isLinked, linked.originalData, document, freelancer]);

  // Load signatures on mount
  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    setLoadingSignatures(true);
    try {
      const response = await fetch(`${API_URL}/api/signatures`);
      const data = await response.json();
      if (data.success) {
        setSignatures(data.data);
      }
    } catch (error) {
      console.error('Failed to load signatures:', error);
    } finally {
      setLoadingSignatures(false);
    }
  };

  const handleUploadSignature = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('signature', file);

      const response = await fetch(`${API_URL}/api/signatures/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await loadSignatures();
        setSelectedSignature(data.data.filename);
      } else {
        alert(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteSignature = async (filename: string) => {
    if (!confirm('ต้องการลบลายเซ็นนี้หรือไม่?')) return;

    try {
      const response = await fetch(`${API_URL}/api/signatures/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await loadSignatures();
        if (selectedSignature === filename) {
          setSelectedSignature(null);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const calculateSubtotal = () => {
    return (document.items || []).reduce((sum, item) => {
      return sum + ((item?.quantity ?? 0) * (item?.unitPrice ?? 0));
    }, 0);
  };

  // Get tax config from document or profile
  const getTaxConfig = (): TaxConfig | null => {
    const docTaxConfig = (document as any).taxConfig;
    if (docTaxConfig) return docTaxConfig;
    
    const profileId = (document as any).profileId;
    if (profileId) {
      const profile = DEFAULT_PROFILES.find(p => p.id === profileId);
      return profile?.taxConfig || null;
    }
    
    return null;
  };

  // Get tax breakdown using multi-tax calculation
  const getTaxBreakdown = () => {
    const subtotal = calculateSubtotal();
    const taxConfig = getTaxConfig();
    
    if (taxConfig) {
      return calculateTaxBreakdown(subtotal, taxConfig);
    }
    
    // Fallback to legacy calculation
    const taxAmount = subtotal * (document.taxRate || 0);
    const total = document.taxType === 'withholding' 
      ? subtotal - taxAmount 
      : subtotal + taxAmount;
    
    return {
      subtotal,
      vatAmount: document.taxType === 'vat' ? taxAmount : 0,
      withholdingAmount: document.taxType === 'withholding' ? taxAmount : 0,
      total,
    };
  };

  const taxConfig = getTaxConfig();
  const breakdown = getTaxBreakdown();

  const handleGenerate = async () => {
    let documentDataWithBase = { ...document };
    if (document.partialPayment?.enabled && document.partialPayment.type === 'percent') {
      const baseAmount = installment.isInstallment && installment.remainingAmount > 0 
        ? installment.remainingAmount 
        : breakdown.total;
      documentDataWithBase = {
        ...document,
        partialPayment: {
          ...document.partialPayment,
          baseAmount,
        },
      };
    }

    const response = await post<{ filename: string; documentNumber: string }>('/generate', {
      type: documentType,
      documentData: documentDataWithBase,
      customerId: customer?.id,
      signaturePath: selectedSignature,
      isRevision: editing.isRevision,
      originalDocumentNumber: editing.originalDocumentNumber,
      originalDocumentId: editing.originalDocumentId,
      chainId: linked.chainId,
      sourceDocumentId: linked.sourceDocumentId,
      sourceDocumentNumber: linked.sourceDocumentNumber,
      ...(installment.isInstallment ? {
        installment: {
          isInstallment: true,
          installmentNumber: installment.installmentNumber,
          totalContractAmount: installment.totalContractAmount,
          paidToDate: installment.paidToDate,
          remainingAmount: installment.remainingAmount,
          parentChainId: installment.parentChainId,
          baseDocumentNumber: installment.baseDocumentNumber,
        },
      } : {}),
    });

    if (response.success && response.data) {
      setResult(response.data);
    }
  };

  const handleNewDocument = () => {
    reset();
  };

  if (result) {
    const pdfUrl = `${API_URL}/output/${result.filename}`;
    
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="py-8 sm:py-12 px-4 sm:px-6">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-green-800">สร้างเอกสารสำเร็จ!</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              {typeLabels[documentType]} เลขที่ <span className="font-mono font-semibold">{result.documentNumber}</span>
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground break-all">
              ไฟล์: <code className="bg-muted px-2 py-1 rounded">{result.filename}</code>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-4">
              <Button variant="outline" onClick={handleNewDocument} className="w-full sm:w-auto">
                <FileText className="w-4 h-4 mr-2" />
                สร้างเอกสารใหม่
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="w-full sm:w-auto">
                <Eye className="w-4 h-4 mr-2" />
                {showPreview ? 'ซ่อน Preview' : 'ดู Preview'}
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  เปิด PDF
                </a>
              </Button>
            </div>
            
            {/* PDF Preview */}
            {showPreview && (
              <div className="mt-6 border rounded-lg overflow-hidden bg-gray-100">
                <iframe 
                  src={pdfUrl}
                  className="w-full h-[400px] sm:h-[600px]"
                  title="PDF Preview"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">ตรวจสอบและยืนยัน</CardTitle>
        <CardDescription className="text-sm">
          ตรวจสอบข้อมูลก่อนสร้าง {typeLabels[documentType]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Document Type */}
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <p className="font-semibold text-primary">{typeLabels[documentType]}</p>
              <p className="text-sm text-muted-foreground">
                เลขที่: {document.documentNumber === 'auto' ? 'สร้างอัตโนมัติ' : document.documentNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Freelancer Info */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">ผู้ออกเอกสาร</span>
          </div>
          <p className="font-medium">{freelancer?.name}</p>
          <p className="text-sm text-muted-foreground">{freelancer?.title}</p>
          <p className="text-sm text-muted-foreground">{freelancer?.email}</p>
        </div>

        {/* Customer Info */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">ลูกค้า</span>
          </div>
          <p className="font-medium">{customer?.name}</p>
          {customer?.company && (
            <p className="text-sm text-muted-foreground">{customer.company}</p>
          )}
          <p className="text-sm text-muted-foreground">{customer?.address}</p>
          <p className="text-sm text-muted-foreground">Tax ID: {customer?.taxId}</p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">วันที่ออก</p>
            <p className="font-medium text-sm sm:text-base">{formatDateThai(document.issueDate || '')}</p>
          </div>
          {documentType === 'invoice' && (document as any).dueDate && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">ครบกำหนด</p>
              <p className="font-medium text-sm sm:text-base">{formatDateThai((document as any).dueDate)}</p>
            </div>
          )}
          {documentType === 'quotation' && (document as any).validUntil && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">ใช้ได้ถึง</p>
              <p className="font-medium text-sm sm:text-base">{formatDateThai((document as any).validUntil)}</p>
            </div>
          )}
          {documentType === 'receipt' && (document as any).paymentDate && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">วันที่ชำระ</p>
              <p className="font-medium text-sm sm:text-base">{formatDateThai((document as any).paymentDate)}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 text-sm font-medium">
            รายการสินค้า/บริการ ({document.items?.length || 0} รายการ)
          </div>
          <div className="divide-y">
            {document.items?.map((item, index) => (
              <div key={index} className="px-4 py-3 flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit} x {formatNumber(item.unitPrice)} บาท
                  </p>
                </div>
                <p className="font-medium">
                  {formatNumber(item.quantity * item.unitPrice)} บาท
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary with Multi-Tax */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>รวมก่อนภาษี</span>
            <span>{formatNumber(breakdown.subtotal)} บาท</span>
          </div>
          
          {taxConfig?.vat.enabled && breakdown.vatAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span>ภาษีมูลค่าเพิ่ม 7%</span>
              <span className="text-blue-600">+{formatNumber(breakdown.vatAmount)} บาท</span>
            </div>
          )}
          
          {taxConfig?.withholding.enabled && breakdown.withholdingAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span>หักภาษี ณ ที่จ่าย {(taxConfig.withholding.rate * 100)}%</span>
              <span className="text-red-600">-{formatNumber(breakdown.withholdingAmount)} บาท</span>
            </div>
          )}
          
          {/* Fallback for legacy tax display */}
          {!taxConfig && document.taxRate !== 0 && (
            <div className="flex justify-between text-sm">
              <span>{document.taxLabel}</span>
              <span className={document.taxType === 'withholding' ? 'text-red-600' : 'text-blue-600'}>
                {document.taxType === 'withholding' ? '-' : '+'}
                {formatNumber(calculateSubtotal() * (document.taxRate || 0))} บาท
              </span>
            </div>
          )}
          
          {taxConfig?.grossUp && breakdown.grossUpAmount && (
            <div className="flex justify-between text-sm text-orange-600 bg-orange-50 p-2 rounded -mx-2">
              <span className="flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                Gross-up (ลูกค้าจ่ายภาษี)
              </span>
              <span>+{formatNumber(breakdown.grossUpAmount)} บาท</span>
            </div>
          )}

          {document.discount?.enabled && document.discount.value > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>ส่วนลด {document.discount.type === 'percent' ? `${document.discount.value}%` : ''}</span>
              <span>-{formatNumber(
                document.discount.type === 'percent' 
                  ? breakdown.subtotal * document.discount.value / 100 
                  : document.discount.value
              )} บาท</span>
            </div>
          )}
          
          <div className="flex justify-between font-semibold text-lg pt-2 border-t">
            <span>{taxConfig?.grossUp ? 'รับสุทธิ (ตามที่ตั้งไว้)' : 'รวมรับสุทธิ'}</span>
            <span className="text-primary">{formatNumber(breakdown.total)} บาท</span>
          </div>

          {document.partialPayment?.enabled && document.partialPayment.value > 0 && (() => {
            const baseAmount = installment.isInstallment && installment.remainingAmount > 0 
              ? installment.remainingAmount 
              : breakdown.total;
            const paymentAmount = document.partialPayment.type === 'percent'
              ? baseAmount * document.partialPayment.value / 100
              : document.partialPayment.value;
            return (
              <div className="flex justify-between text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded -mx-2">
                <span>
                  งวดนี้ชำระ {document.partialPayment.type === 'percent' ? `${document.partialPayment.value}%` : ''}
                  {installment.isInstallment && document.partialPayment.type === 'percent' && (
                    <span className="text-xs text-blue-400 ml-1">(ของ ฿{formatNumber(baseAmount)} คงเหลือ)</span>
                  )}
                </span>
                <span>{formatNumber(paymentAmount)} บาท</span>
              </div>
            );
          })()}
        </div>

        {/* Notes */}
        {document.notes && (
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">หมายเหตุ</p>
            <p className="text-sm text-amber-900">{document.notes}</p>
          </div>
        )}

        {/* Payment Terms */}
        {(document.paymentTerms || []).length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-2">เงื่อนไขการชำระเงิน ({(document.paymentTerms || []).length})</p>
            <TooltipProvider>
              <div className="flex flex-wrap gap-1">
                {(document.paymentTerms || []).map((term: string, index: number) => {
                  const isClipped = term.length > 35;
                  const displayText = isClipped ? term.substring(0, 35) + '...' : term;
                  
                  const badge = (
                    <span
                      className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded cursor-default"
                    >
                      {displayText}
                    </span>
                  );
                  
                  if (isClipped) {
                    return (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          {badge}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">{term}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  
                  return <span key={index}>{badge}</span>;
                })}
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Signature Section */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">ลายเซ็น</span>
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadSignature}
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" />
                    อัปโหลด
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {loadingSignatures ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Image className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">ยังไม่มีลายเซ็น</p>
              <p className="text-xs">กดปุ่มอัปโหลดเพื่อเพิ่มลายเซ็น</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {signatures.map((sig) => (
                <div 
                  key={sig.filename}
                  className={`relative group cursor-pointer rounded-lg border-2 p-2 transition-all ${
                    selectedSignature === sig.filename 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedSignature(
                    selectedSignature === sig.filename ? null : sig.filename
                  )}
                >
                  <img 
                    src={`${API_URL}${sig.url}`}
                    alt="Signature"
                    className="w-full h-16 object-contain"
                  />
                  {selectedSignature === sig.filename && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSignature(sig.filename);
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {selectedSignature && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              เลือกลายเซ็นแล้ว - จะถูกแปะในเอกสาร PDF
            </p>
          )}

          {/* Skip Signature Checkbox */}
          {!selectedSignature && (
            <div className="mt-3 pt-3 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setSkipSignature(!skipSignature)}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    skipSignature 
                      ? 'bg-orange-500 border-orange-500' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {skipSignature && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-sm text-gray-600">
                  อนุญาตไม่ต้องใส่ลายเซ็นชั่วคราว
                </span>
              </label>
              {skipSignature && (
                <p className="text-xs text-orange-600 mt-1 ml-6">
                  เอกสารจะถูกสร้างโดยไม่มีลายเซ็น
                </p>
              )}
            </div>
          )}

          {/* Signature Required Warning */}
          {!selectedSignature && !skipSignature && (
            <div className="mt-3 p-2 bg-amber-50 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                กรุณาเลือกลายเซ็น หรือติ๊ก "อนุญาตไม่ต้องใส่ลายเซ็นชั่วคราว"
              </p>
            </div>
          )}
        </div>

        {/* Data Mismatch Warning for Linked Documents */}
        {linked.isLinked && dataMismatches.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <p className="font-medium mb-1">
                ข้อมูลต่อไปนี้ถูกเปลี่ยนจากเอกสารต้นทาง ({linked.sourceDocumentNumber}):
              </p>
              <ul className="text-sm space-y-0.5">
                {dataMismatches.map((mismatch, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <span>•</span>
                    <span>{mismatch.label}</span>
                    {mismatch.details && (
                      <span className="text-orange-600 text-xs">({mismatch.details})</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-2 text-orange-600">
                หากต้องการให้ตรงกับต้นฉบับ กด "ย้อนกลับ" เพื่อแก้ไข
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={prevStep} disabled={loading}>
            ย้อนกลับ
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={loading || (!selectedSignature && !skipSignature)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง PDF...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                สร้าง PDF
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
