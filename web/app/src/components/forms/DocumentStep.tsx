import React, { useEffect, useState, useMemo } from 'react';
import { useFormStore, getLinkedDataMismatches } from '@/hooks/useFormStore';
import { useApi } from '@/hooks/useApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, FileText, Receipt, FileCheck, Sparkles, Wand2, Package, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { AIItemGeneratorModal } from '@/components/ai/AIItemGeneratorModal';
import { AISettingsModal } from '@/components/ai/AISettingsModal';
import { DocumentProfileSelector, DEFAULT_PROFILES, calculateTaxBreakdown } from './DocumentProfileSelector';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LineItem, DocumentType, ServicePackage, DocumentProfile, TaxConfig } from '@/types';

interface AddItemData {
  description: string;
  details?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

const documentTypes: { value: DocumentType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'quotation', label: 'ใบเสนอราคา', icon: <FileText className="w-5 h-5" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'invoice', label: 'ใบแจ้งหนี้', icon: <FileCheck className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'receipt', label: 'ใบเสร็จรับเงิน', icon: <Receipt className="w-5 h-5" />, color: 'bg-green-100 text-green-700 border-green-200' },
];

// Payment term options with checkboxes
const paymentTermGroups = [
  {
    title: '1. การชำระครั้งเดียว',
    terms: [
      { label: 'ชำระเต็มจำนวน', value: 'ชำระเต็มจำนวนก่อนเริ่มงาน' },
      { label: 'ชำระภายใน 7 วัน', value: 'ชำระภายใน 7 วันหลังได้รับใบแจ้งหนี้' },
      { label: 'ชำระภายใน 15 วัน', value: 'ชำระภายใน 15 วันหลังได้รับใบแจ้งหนี้' },
      { label: 'ชำระภายใน 30 วัน', value: 'ชำระภายใน 30 วันหลังได้รับใบแจ้งหนี้' },
    ],
  },
  {
    title: '2. การแบ่งงวด',
    terms: [
      { label: '1.มัดจำ 60% งวดที่ 1/2', value: 'มัดจำ 60% งวดที่ 1/2 ก่อนเริ่มงาน, ส่วนที่เหลือชำระเมื่อส่งมอบ' },
      { label: '2.มัดจำ 40% งวดที่ 2/2', value: 'มัดจำ 40% งวดที่ 2/2 ส่งมอบงาน' },
      { label: 'งวด 30/70', value: 'งวดที่ 1: 30% เมื่อเริ่มงาน | งวดที่ 2: 70% เมื่อส่งมอบ' },
      { label: 'งวด 50/50', value: 'งวดที่ 1: 50% เมื่อเริ่มงาน | งวดที่ 2: 50% เมื่อส่งมอบ' },
      { label: '3 งวด (30/30/40)', value: 'งวด 1: 30% เริ่มงาน | งวด 2: 30% ระหว่างทำ | งวด 3: 40% ส่งมอบ' },
    ],
  },
  {
    title: '3. รายเดือน/ต่อเนื่อง',
    terms: [
      { label: 'รายเดือน (วันที่ 5)', value: 'ชำระรายเดือน ภายในวันที่ 5 ของเดือนถัดไป' },
      { label: 'ล่วงหน้าต้นเดือน', value: 'ชำระล่วงหน้าทุกต้นเดือนก่อนเริ่มงาน' },
      { label: 'รายสัปดาห์', value: 'ชำระรายสัปดาห์ ทุกวันจันทร์' },
      { label: 'รายไตรมาส', value: 'ชำระรายไตรมาส ภายในวันที่ 5 ของเดือนแรก' },
    ],
  },
  {
    title: '4. เงื่อนไขพิเศษ',
    terms: [
      { label: 'หลังตรวจรับงาน', value: 'ชำระภายใน 7 วันหลังตรวจรับงานเรียบร้อย' },
      { label: 'หลังส่งมอบ 3 วัน', value: 'ชำระเต็มจำนวนภายใน 3 วันทำการหลังส่งมอบงาน' },
      { label: 'ก่อนรับไฟล์งาน', value: 'ชำระเต็มจำนวนก่อนรับไฟล์งานต้นฉบับ' },
      { label: 'เมื่อ Approve', value: 'ชำระเมื่อลูกค้า Approve งานขั้นสุดท้าย' },
    ],
  },
];

export function DocumentStep() {
  const { 
    documentType, setDocumentType,
    document, updateDocument, addItem, updateItem, removeItem,
    nextStep, prevStep,
    linked, freelancer,
    installment
  } = useFormStore();
  const { get } = useApi();
  
  const [aiAddedNotice, setAiAddedNotice] = useState<string | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [showServices, setShowServices] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>((document as any).profileId || null);
  const [customPaymentTerm, setCustomPaymentTerm] = useState('');

  // Detect data mismatches for linked documents
  const dataMismatches = useMemo(() => {
    if (!linked.isLinked || !linked.originalData) return [];
    return getLinkedDataMismatches(document, linked.originalData, freelancer);
  }, [linked.isLinked, linked.originalData, document, freelancer]);

  // Auto-select profile from document (for linked documents)
  useEffect(() => {
    const docProfileId = (document as any).profileId;
    if (docProfileId && !selectedProfileId) {
      setSelectedProfileId(docProfileId);
    }
  }, [(document as any).profileId]);

  // Load service packages
  useEffect(() => {
    loadServicePackages();
  }, []);

  const loadServicePackages = async () => {
    const response = await get<ServicePackage[]>('/services');
    if (response?.success && response.data) {
      setServicePackages(response.data.filter(s => s.isActive !== false));
    }
  };

  const addServicePackage = (service: ServicePackage) => {
    service.items.forEach(item => {
      addItem({
        description: item.description,
        details: item.details || '',
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      });
    });
    setAiAddedNotice(`เพิ่ม ${service.items.length} รายการจากแพ็คเกจ "${service.name}"`);
    setTimeout(() => setAiAddedNotice(null), 5000);
    setShowServices(false);
  };

  // Listen for add item events from chat
  useEffect(() => {
    const handleAddItemEvent = (event: CustomEvent<{ itemData: AddItemData }>) => {
      const { itemData } = event.detail;
      
      if (itemData) {
        addItem({
          description: itemData.description,
          details: itemData.details || '',
          quantity: itemData.quantity,
          unit: itemData.unit,
          unitPrice: itemData.unitPrice,
        });
        
        setAiAddedNotice(`เพิ่มรายการ "${itemData.description}" แล้ว`);
        
        setTimeout(() => {
          setAiAddedNotice(null);
        }, 5000);
      }
    };

    window.addEventListener('pacioli:additem', handleAddItemEvent as EventListener);
    
    return () => {
      window.removeEventListener('pacioli:additem', handleAddItemEvent as EventListener);
    };
  }, [addItem]);

  const handleAddItem = () => {
    addItem({
      description: '',
      quantity: 1,
      unit: 'รายการ',
      unitPrice: 0,
    });
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const items = document.items || [];
    const item = { ...items[index], [field]: value };
    updateItem(index, item);
  };

  // Handle profile selection
  const handleProfileSelect = (profile: DocumentProfile) => {
    setSelectedProfileId(profile.id);
    
    // Update document with new tax config
    updateDocument({
      taxConfig: profile.taxConfig,
      profileId: profile.id,
      // Apply default payment terms if set
      ...(profile.defaultPaymentTerms && (document.paymentTerms || []).length === 0 
        ? { paymentTerms: profile.defaultPaymentTerms } 
        : {}),
      // Apply default notes if set
      ...(profile.defaultNotes && !document.notes 
        ? { notes: profile.defaultNotes } 
        : {}),
    } as any);
  };

  // Toggle payment term
  const togglePaymentTerm = (termValue: string) => {
    const currentTerms = document.paymentTerms || [];
    if (currentTerms.includes(termValue)) {
      updateDocument({ paymentTerms: currentTerms.filter(t => t !== termValue) } as any);
    } else {
      updateDocument({ paymentTerms: [...currentTerms, termValue] } as any);
    }
  };

  // Add custom payment term
  const addCustomPaymentTerm = () => {
    const value = customPaymentTerm.trim();
    if (value) {
      const currentTerms = document.paymentTerms || [];
      if (!currentTerms.includes(value)) {
        updateDocument({ paymentTerms: [...currentTerms, value] } as any);
      }
      setCustomPaymentTerm('');
    }
  };

  const calculateSubtotal = () => {
    return (document.items || []).reduce((sum, item) => {
      return sum + ((item?.quantity ?? 0) * (item?.unitPrice ?? 0));
    }, 0);
  };

  // Get current tax config
  const getCurrentTaxConfig = (): TaxConfig => {
    const docTaxConfig = (document as any).taxConfig;
    if (docTaxConfig) return docTaxConfig;
    
    // Fallback to profile or default
    const profile = DEFAULT_PROFILES.find(p => p.id === selectedProfileId);
    return profile?.taxConfig || {
      vat: { enabled: false, rate: 0 },
      withholding: { enabled: true, rate: 0.03 },
      grossUp: false,
    };
  };

  // Calculate tax breakdown
  const getTaxBreakdown = () => {
    const subtotal = calculateSubtotal();
    const taxConfig = getCurrentTaxConfig();
    return calculateTaxBreakdown(subtotal, taxConfig);
  };

  const items = document.items || [];
  const breakdown = getTaxBreakdown();
  
  // Validation
  const hasItems = items.length > 0 && items.every(item => 
    item.description && item.quantity > 0 && item.unitPrice >= 0
  );
  const hasProfile = selectedProfileId !== null;
  const hasValidUntil = documentType !== 'quotation' || !!(document as any).validUntil;
  
  const isValid = hasItems && hasProfile && hasValidUntil;

  const handleAIItemsGenerated = (newItems: AddItemData[]) => {
    newItems.forEach(item => {
      addItem(item);
    });
    setAiAddedNotice(`AI สร้าง ${newItems.length} รายการแล้ว`);
    setTimeout(() => setAiAddedNotice(null), 5000);
  };

  return (
    <>
      {/* AI Modals */}
      <AIItemGeneratorModal
        open={showAIGenerator}
        onOpenChange={setShowAIGenerator}
        onItemsGenerated={handleAIItemsGenerated}
        onOpenSettings={() => {
          setShowAIGenerator(false);
          setShowAISettings(true);
        }}
      />
      <AISettingsModal
        open={showAISettings}
        onOpenChange={setShowAISettings}
      />

      <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">รายละเอียดเอกสาร</CardTitle>
        <CardDescription className="text-sm">
          เลือกประเภทเอกสารและเพิ่มรายการสินค้า/บริการ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {/* Installment Info Banner */}
        {installment.isInstallment && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex-1">
              <div className="font-medium text-green-800">สร้างเอกสารงวดที่ {installment.installmentNumber}</div>
              <div className="text-sm text-green-600">
                ยอดชำระแล้ว: ฿{formatNumber(installment.paidToDate)} / ฿{formatNumber(installment.totalContractAmount)}
                <span className="ml-2 text-green-700 font-medium">
                  (คงเหลือ: ฿{formatNumber(installment.totalContractAmount - installment.paidToDate)})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* AI Added Notice */}
        {aiAddedNotice && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-800 rounded-lg text-sm animate-fade-in">
            <Sparkles className="w-4 h-4" />
            <span>{aiAddedNotice}</span>
          </div>
        )}

        {/* Document Type Selection */}
        <div className="space-y-2">
          <Label>ประเภทเอกสาร</Label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {documentTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setDocumentType(type.value)}
                className={cn(
                  "p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 text-center touch-manipulation",
                  documentType === type.value
                    ? type.color + " ring-2 ring-offset-2"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  {type.icon}
                  <span className="text-xs sm:text-sm font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Document Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="issueDate" className="flex items-center gap-1">วันที่ออกเอกสาร</Label>
            <Input
              id="issueDate"
              type="date"
              value={document.issueDate || ''}
              onChange={(e) => updateDocument({ issueDate: e.target.value })}
            />
          </div>

          {documentType === 'invoice' && (
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-1">วันครบกำหนดชำระ</Label>
              <Input
                id="dueDate"
                type="date"
                value={(document as any).dueDate || ''}
                onChange={(e) => updateDocument({ dueDate: e.target.value } as any)}
              />
            </div>
          )}

          {documentType === 'quotation' && (
            <div className="space-y-2">
              <Label htmlFor="validUntil" className="flex items-center gap-1">
                ใบเสนอราคาใช้ได้ถึง
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="validUntil"
                type="date"
                value={(document as any).validUntil || ''}
                onChange={(e) => updateDocument({ validUntil: e.target.value } as any)}
                className={cn(
                  !(document as any).validUntil && "border-red-300 focus:border-red-500"
                )}
              />
              {!(document as any).validUntil && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  กรุณาระบุวันหมดอายุใบเสนอราคา
                </p>
              )}
            </div>
          )}

          {documentType === 'receipt' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">วันที่ชำระเงิน</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={(document as any).paymentDate || ''}
                  onChange={(e) => updateDocument({ paymentDate: e.target.value } as any)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">วิธีการชำระเงิน</Label>
                <Input
                  id="paymentMethod"
                  value={(document as any).paymentMethod || ''}
                  onChange={(e) => updateDocument({ paymentMethod: e.target.value } as any)}
                  placeholder="โอนเงิน / เงินสด / เช็ค"
                />
              </div>
            </>
          )}
        </div>

        {/* Items */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label className="text-sm font-medium">รายการสินค้า/บริการ</Label>
            <div className="flex flex-wrap gap-2">
              {servicePackages.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowServices(!showServices)}
                  className="h-8 text-xs bg-gradient-to-r from-green-50 to-teal-50 border-green-200 hover:border-green-300 text-green-700"
                >
                  <Package className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">แพ็คเกจ ({servicePackages.length})</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAIGenerator(true)}
                className="h-8 text-xs bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:border-purple-300 text-purple-700"
              >
                <Wand2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">สร้างด้วย AI</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddItem} className="h-8 text-xs">
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">เพิ่มรายการ</span>
              </Button>
            </div>
          </div>

          {/* Service Packages Quick Select */}
          {showServices && servicePackages.length > 0 && (
            <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-green-800">เลือกแพ็คเกจบริการ</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowServices(false)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {servicePackages.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => addServicePackage(service)}
                    className="p-3 text-left border rounded-lg bg-white hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(service.items || []).length} รายการ • {formatNumber(
                        (service.items || []).reduce((sum, item) => sum + (item?.quantity ?? 0) * (item?.unitPrice ?? 0), 0)
                      )} บาท
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <Wand2 className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <p>ยังไม่มีรายการ</p>
              <p className="text-sm mt-1">
                คลิก "<span className="text-purple-600 font-medium">สร้างด้วย AI</span>" เพื่อให้ AI ช่วยสร้างรายการ
              </p>
              <p className="text-xs text-muted-foreground mt-1">หรือ "เพิ่มรายการ" เพื่อสร้างเอง</p>
            </div>
          )}

          {items.map((item, index) => (
            <div key={index} className="p-3 sm:p-4 border rounded-lg space-y-2 sm:space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  รายการที่ {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">ชื่อรายการ</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  placeholder="รายละเอียดสินค้าหรือบริการ"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs sm:text-sm text-gray-500">รายละเอียดเพิ่มเติม (ไม่บังคับ)</Label>
                <Textarea
                  value={item.details || ''}
                  onChange={(e) => handleItemChange(index, 'details', e.target.value)}
                  placeholder={"เช่น:\n- ออกแบบ UI/UX\n- พัฒนา Frontend\n- ทดสอบระบบ"}
                  rows={3}
                  className="text-sm text-gray-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">จำนวน</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">หน่วย</Label>
                  <Input
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    placeholder="ชิ้น"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ราคา/หน่วย</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="text-right text-xs sm:text-sm">
                รวม: <span className="font-semibold">{formatNumber(item.quantity * item.unitPrice)}</span> บาท
              </div>
            </div>
          ))}
        </div>

        {/* Tax Profile Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              โปรไฟล์ภาษี
              <span className="text-red-500">*</span>
            </Label>
            {!selectedProfileId && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                กรุณาเลือกโปรไฟล์ภาษี
              </span>
            )}
          </div>
          <DocumentProfileSelector
            selectedProfileId={selectedProfileId}
            onSelectProfile={handleProfileSelect}
            subtotal={calculateSubtotal()}
          />
        </div>

        {/* Discount & Partial Payment */}
        <div className="space-y-4 p-3 sm:p-4 border rounded-lg bg-muted/30">
          <Label className="text-sm font-medium flex items-center gap-2">
            ส่วนลด & แบ่งชำระ
            <span className="text-xs text-muted-foreground font-normal">(ไม่บังคับ)</span>
          </Label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Discount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">ส่วนลด</Label>
                <button
                  type="button"
                  onClick={() => {
                    const current = document.discount;
                    updateDocument({
                      discount: current?.enabled
                        ? { ...current, enabled: false }
                        : { enabled: true, type: 'percent', value: 0 }
                    });
                  }}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full transition-all",
                    document.discount?.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {document.discount?.enabled ? '✓ เปิด' : 'ปิด'}
                </button>
              </div>
              {document.discount?.enabled && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={document.discount?.value || ''}
                    onChange={(e) => updateDocument({
                      discount: { ...document.discount!, value: Number(e.target.value) }
                    })}
                    className="h-8 text-sm flex-1"
                  />
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateDocument({
                        discount: { ...document.discount!, type: 'percent' }
                      })}
                      className={cn(
                        "px-2 py-1 text-xs transition-all",
                        document.discount?.type === 'percent'
                          ? "bg-primary text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDocument({
                        discount: { ...document.discount!, type: 'fixed' }
                      })}
                      className={cn(
                        "px-2 py-1 text-xs transition-all",
                        document.discount?.type === 'fixed'
                          ? "bg-primary text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      ฿
                    </button>
                  </div>
                </div>
              )}
              {document.discount?.enabled && document.discount.value > 0 && (
                <p className="text-xs text-green-600">
                  ลด {document.discount.type === 'percent'
                    ? `${document.discount.value}% = ฿${formatNumber(calculateSubtotal() * document.discount.value / 100)}`
                    : `฿${formatNumber(document.discount.value)}`
                  }
                </p>
              )}
            </div>

            {/* Partial Payment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">แบ่งชำระ (งวดนี้)</Label>
                <button
                  type="button"
                  onClick={() => {
                    const current = document.partialPayment;
                    updateDocument({
                      partialPayment: current?.enabled
                        ? { ...current, enabled: false }
                        : { enabled: true, type: 'percent', value: 50 }
                    });
                  }}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full transition-all",
                    document.partialPayment?.enabled
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {document.partialPayment?.enabled ? '✓ เปิด' : 'ปิด'}
                </button>
              </div>
              {document.partialPayment?.enabled && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="50"
                    value={document.partialPayment?.value || ''}
                    onChange={(e) => updateDocument({
                      partialPayment: { ...document.partialPayment!, value: Number(e.target.value) }
                    })}
                    className="h-8 text-sm flex-1"
                  />
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateDocument({
                        partialPayment: { ...document.partialPayment!, type: 'percent' }
                      })}
                      className={cn(
                        "px-2 py-1 text-xs transition-all",
                        document.partialPayment?.type === 'percent'
                          ? "bg-primary text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDocument({
                        partialPayment: { ...document.partialPayment!, type: 'fixed' }
                      })}
                      className={cn(
                        "px-2 py-1 text-xs transition-all",
                        document.partialPayment?.type === 'fixed'
                          ? "bg-primary text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      ฿
                    </button>
                  </div>
                </div>
              )}
              {document.partialPayment?.enabled && document.partialPayment.value > 0 && (
                <p className="text-xs text-blue-600">
                  งวดนี้ชำระ {document.partialPayment.type === 'percent'
                    ? `${document.partialPayment.value}%`
                    : `฿${formatNumber(document.partialPayment.value)}`
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Terms - Checkbox Style */}
        <div className="space-y-3 p-3 sm:p-4 border rounded-lg bg-muted/30">
          <Label className="text-sm font-medium">เงื่อนไขการจ่ายเงิน (เลือกได้หลายข้อ)</Label>
          
          <div className="space-y-4">
            {paymentTermGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.terms.map((term) => {
                    const isChecked = (document.paymentTerms || []).includes(term.value);
                    return (
                      <button
                        key={term.value}
                        type="button"
                        onClick={() => togglePaymentTerm(term.value)}
                        className={cn(
                          "flex items-center gap-2 p-2 sm:p-2 text-left text-xs rounded-lg border transition-all touch-manipulation",
                          isChecked
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 sm:w-4 sm:h-4 rounded border flex items-center justify-center flex-shrink-0",
                          isChecked ? "bg-primary border-primary" : "border-gray-300"
                        )}>
                          {isChecked && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="flex-1">{term.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Payment Term Input */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">เพิ่มเงื่อนไขเอง:</p>
            <div className="flex gap-2">
              <Input
                value={customPaymentTerm}
                onChange={(e) => setCustomPaymentTerm(e.target.value)}
                placeholder="พิมพ์เงื่อนไขที่ต้องการ..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPaymentTerm();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomPaymentTerm}
                disabled={!customPaymentTerm.trim()}
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Selected Payment Terms Display */}
          {(document.paymentTerms || []).length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-green-700">เงื่อนไขที่เลือก ({(document.paymentTerms || []).length}):</p>
              <TooltipProvider>
                <div className="flex flex-wrap gap-1">
                  {(document.paymentTerms || []).map((term: string, index: number) => {
                    const isClipped = term.length > 30;
                    const displayText = isClipped ? term.substring(0, 30) + '...' : term;
                    
                    const badge = (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full cursor-default"
                      >
                        {displayText}
                        <button
                          type="button"
                          onClick={() => togglePaymentTerm(term)}
                          className="hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
                    
                    return badge;
                  })}
                </div>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">หมายเหตุ</Label>
          <Textarea
            id="notes"
            value={document.notes || ''}
            onChange={(e) => updateDocument({ notes: e.target.value })}
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            rows={2}
          />
        </div>

        {/* Summary with Multi-tax */}
        {items.length > 0 && selectedProfileId && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>รวมก่อนภาษี</span>
              <span>{formatNumber(breakdown.subtotal)} บาท</span>
            </div>
            
            {getCurrentTaxConfig().vat.enabled && (
              <div className="flex justify-between text-sm">
                <span>ภาษีมูลค่าเพิ่ม 7%</span>
                <span className="text-blue-600">+{formatNumber(breakdown.vatAmount)} บาท</span>
              </div>
            )}
            
            {getCurrentTaxConfig().withholding.enabled && (
              <div className="flex justify-between text-sm">
                <span>หักภาษี ณ ที่จ่าย {getCurrentTaxConfig().withholding.rate * 100}%</span>
                <span className="text-red-600">-{formatNumber(breakdown.withholdingAmount)} บาท</span>
              </div>
            )}
            
            {getCurrentTaxConfig().grossUp && breakdown.grossUpAmount && (
              <div className="flex justify-between text-sm text-orange-600 bg-orange-50 p-2 rounded -mx-2">
                <span>💡 Gross-up (บวกเพิ่มให้ลูกค้าจ่ายภาษี)</span>
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
              <span>{getCurrentTaxConfig().grossUp ? 'รับสุทธิ (ตามที่ตั้งไว้)' : 'รวมรับสุทธิ'}</span>
              <span className="text-primary">{formatNumber(breakdown.total)} บาท</span>
            </div>

            {document.partialPayment?.enabled && document.partialPayment.value > 0 && (() => {
              const isInst = installment.isInstallment && installment.totalContractAmount > 0;
              const contractTotal = installment.totalContractAmount || breakdown.total;
              const remaining = installment.remainingAmount || breakdown.total;

              let paymentAmount: number;
              let wasCapped = false;
              if (document.partialPayment.type === 'percent') {
                if (isInst && document.partialPayment.value === 100) {
                  // 100% = pay all remaining
                  paymentAmount = remaining;
                } else {
                  const base = isInst ? contractTotal : breakdown.total;
                  const calculated = base * document.partialPayment.value / 100;
                  wasCapped = isInst && calculated > remaining;
                  paymentAmount = isInst ? Math.min(calculated, remaining) : calculated;
                }
              } else {
                paymentAmount = document.partialPayment.value;
                wasCapped = isInst && paymentAmount > remaining;
                paymentAmount = isInst ? Math.min(paymentAmount, remaining) : paymentAmount;
              }
              paymentAmount = Math.round(paymentAmount * 100) / 100;
              return (
                <>
                <div className="flex justify-between text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded -mx-2">
                  <span>
                    งวดนี้ชำระ {document.partialPayment.type === 'percent' ? `${document.partialPayment.value}%` : ''}
                    {isInst && document.partialPayment.type === 'percent' && (
                      <span className="text-xs text-blue-400 ml-1">(ของ ฿{formatNumber(contractTotal)} ยอดสัญญา)</span>
                    )}
                  </span>
                  <span>{formatNumber(paymentAmount)} บาท</span>
                </div>
                {wasCapped && (
                  <div className="text-xs text-orange-500 bg-orange-50 p-1.5 rounded -mx-2 mt-1">
                    ⚠️ ปรับยอดเป็น ฿{formatNumber(remaining)} (คงเหลือจริง) เนื่องจากเกินยอดคงเหลือ
                  </div>
                )}
                </>
              );
            })()}
          </div>
        )}

        {/* Validation Summary */}
        {!isValid && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-amber-800 mb-1">กรุณาตรวจสอบ:</p>
            <ul className="text-xs text-amber-700 space-y-1">
              {!hasItems && <li>• เพิ่มอย่างน้อย 1 รายการ (พร้อมรายละเอียด ราคา จำนวน)</li>}
              {!hasProfile && <li>• เลือกโปรไฟล์ภาษี</li>}
              {documentType === 'quotation' && !hasValidUntil && <li>• ระบุวันหมดอายุใบเสนอราคา</li>}
            </ul>
          </div>
        )}

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
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={prevStep}>
            ย้อนกลับ
          </Button>
          <Button onClick={nextStep} disabled={!isValid}>
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
