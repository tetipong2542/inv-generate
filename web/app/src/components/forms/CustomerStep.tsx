import React, { useEffect, useState, useCallback } from 'react';
import { useFormStore } from '@/hooks/useFormStore';
import { useApi } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, User, Building2, Check, Pencil, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Customer } from '@/types';

type FormMode = 'list' | 'create' | 'edit';

interface AutofillData {
  name: string;
  company: string;
  address: string;
  taxId: string;
  phone: string;
  email?: string;
}

export function CustomerStep() {
  const { customer, setCustomer, nextStep, prevStep, setCurrentStep } = useFormStore();
  const { loading, error, get, post, put, del, setError } = useApi();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(customer?.id || null);
  const [formMode, setFormMode] = useState<FormMode>('list');
  const [editingCustomer, setEditingCustomer] = useState<Customer>({
    name: '',
    company: '',
    address: '',
    taxId: '',
    phone: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);

  // Listen for autofill events from chat
  useEffect(() => {
    const handleAutofill = (event: CustomEvent<{ customerData: AutofillData }>) => {
      const { customerData } = event.detail;
      
      if (customerData) {
        // Switch to create mode and fill the form
        setFormMode('create');
        setEditingCustomer({
          name: customerData.name || '',
          company: customerData.company || '',
          address: customerData.address || '',
          taxId: customerData.taxId || '',
          phone: customerData.phone || '',
        });
        setAutofillNotice('ข้อมูลถูก autofill จาก AI Chat');
        
        // Clear notice after 5 seconds
        setTimeout(() => {
          setAutofillNotice(null);
        }, 5000);

        // Also refresh customer list in case a new one was created
        loadCustomers();
      }
    };

    window.addEventListener('pacioli:autofill', handleAutofill as EventListener);
    
    return () => {
      window.removeEventListener('pacioli:autofill', handleAutofill as EventListener);
    };
  }, []);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const response = await get<Customer[]>('/customers');
    if (response.success && response.data) {
      setCustomers(response.data);
    }
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedId(c.id || null);
    setCustomer(c);
    setFormMode('list');
    setDeleteConfirm(null);
  };

  const handleStartCreate = () => {
    setEditingCustomer({
      name: '',
      company: '',
      address: '',
      taxId: '',
      phone: '',
    });
    setFormMode('create');
    setError(null);
    setAutofillNotice(null);
  };

  const handleStartEdit = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setEditingCustomer({ ...c });
    setFormMode('edit');
    setError(null);
    setAutofillNotice(null);
  };

  const handleCreateCustomer = async () => {
    // Generate ID from name/company
    const id = (editingCustomer.company || editingCustomer.name)
      .toLowerCase()
      .replace(/บริษัท|จำกัด|\(สำนักงานใหญ่\)|\(มหาชน\)/gi, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9ก-๙-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || `customer-${Date.now()}`;

    const response = await post<Customer>('/customers', { id, ...editingCustomer });
    if (response.success && response.data) {
      await loadCustomers();
      handleSelectCustomer({ ...response.data, id });
      setFormMode('list');
      setAutofillNotice(null);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer.id) return;

    const response = await put<Customer>(`/customers/${editingCustomer.id}`, editingCustomer);
    if (response.success && response.data) {
      await loadCustomers();
      if (selectedId === editingCustomer.id) {
        setCustomer({ ...editingCustomer });
      }
      setFormMode('list');
    }
  };

  const handleDeleteCustomer = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    const response = await del(`/customers/${id}`);
    if (response.success) {
      await loadCustomers();
      if (selectedId === id) {
        setSelectedId(null);
        setCustomer(null);
      }
      setDeleteConfirm(null);
    }
  };

  const handleCancelForm = () => {
    setFormMode('list');
    setError(null);
    setAutofillNotice(null);
  };

  const handleNext = () => {
    if (customer) {
      nextStep();
    }
  };

  const isFormValid = editingCustomer.name && editingCustomer.address && editingCustomer.taxId;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">เลือกลูกค้า</CardTitle>
        <CardDescription className="text-sm">
          เลือกลูกค้าจากรายชื่อที่มีอยู่ หรือใช้ AI Chat เพื่อ auto-detect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Autofill Notice */}
        {autofillNotice && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm animate-fade-in">
            <Sparkles className="w-4 h-4" />
            <span>{autofillNotice}</span>
            <span className="text-xs text-blue-600">- กรุณาตรวจสอบและแก้ไขตามต้องการ</span>
          </div>
        )}

        {/* Customer List */}
        {formMode === 'list' && (
          <div className="space-y-3">
            {customers.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <p>ยังไม่มีลูกค้าในระบบ</p>
                <p className="text-sm mt-2">
                  ลอง AI Chat (ปุ่ม 💬 มุมขวาล่าง) พิมพ์ข้อมูลบริษัท<br/>
                  ระบบจะ detect อัตโนมัติ
                </p>
              </div>
            )}

            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectCustomer(c)}
                className={cn(
                  "w-full p-4 rounded-lg border text-left transition-all duration-200 cursor-pointer",
                  "hover:border-primary/50 hover:bg-primary/5",
                  selectedId === c.id 
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      selectedId === c.id ? "bg-primary text-white" : "bg-muted"
                    )}>
                      {c.company ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.company && c.company !== c.name && (
                        <p className="text-sm text-muted-foreground">{c.company}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Tax ID: {c.taxId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => handleStartEdit(e, c)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        deleteConfirm === c.id 
                          ? "text-white bg-destructive hover:bg-destructive/90" 
                          : "text-muted-foreground hover:text-destructive"
                      )}
                      onClick={(e) => handleDeleteCustomer(e, c.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    {selectedId === c.id && (
                      <Check className="w-5 h-5 text-primary ml-2" />
                    )}
                  </div>
                </div>
                
                {deleteConfirm === c.id && (
                  <p className="text-xs text-destructive mt-2">
                    คลิกปุ่มลบอีกครั้งเพื่อยืนยัน
                  </p>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleStartCreate}
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มลูกค้าใหม่ (Manual)
            </Button>
          </div>
        )}

        {/* Create/Edit Customer Form */}
        {(formMode === 'create' || formMode === 'edit') && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {formMode === 'create' ? 'เพิ่มลูกค้าใหม่' : `แก้ไขลูกค้า: ${editingCustomer.name}`}
              </h4>
              {autofillNotice && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Auto-detected
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">ชื่อลูกค้า *</Label>
                <Input
                  id="customerName"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="นาย/นาง ชื่อ นามสกุล หรือ ชื่อบริษัท"
                  className={cn(autofillNotice && editingCustomer.name && "border-blue-300")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerCompany">บริษัท</Label>
                <Input
                  id="customerCompany"
                  value={editingCustomer.company || ''}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="บริษัท ABC จำกัด"
                  className={cn(autofillNotice && editingCustomer.company && "border-blue-300")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerAddress">ที่อยู่ *</Label>
              <Textarea
                id="customerAddress"
                value={editingCustomer.address}
                onChange={(e) => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                placeholder="ที่อยู่สำหรับออกเอกสาร"
                rows={3}
                className={cn(autofillNotice && editingCustomer.address && "border-blue-300")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerTaxId">เลขประจำตัวผู้เสียภาษี *</Label>
                <Input
                  id="customerTaxId"
                  value={editingCustomer.taxId}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, taxId: e.target.value }))}
                  placeholder="0-1234-56789-01-2 หรือ 13 หลัก"
                  className={cn(autofillNotice && editingCustomer.taxId && "border-blue-300")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">เบอร์โทรศัพท์</Label>
                <Input
                  id="customerPhone"
                  value={editingCustomer.phone || ''}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="02-xxx-xxxx"
                  className={cn(autofillNotice && editingCustomer.phone && "border-blue-300")}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancelForm}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={formMode === 'create' ? handleCreateCustomer : handleUpdateCustomer}
                disabled={!isFormValid || loading}
              >
                {loading ? 'กำลังบันทึก...' : (formMode === 'create' ? 'บันทึกลูกค้า' : 'อัปเดตข้อมูล')}
              </Button>
            </div>
          </div>
        )}

        {/* Selected Customer Preview */}
        {customer && formMode === 'list' && (
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-green-800 font-medium">ลูกค้าที่เลือก:</p>
                <p className="text-green-900">{customer.name}</p>
                {customer.company && customer.company !== customer.name && (
                  <p className="text-sm text-green-700">{customer.company}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-700 hover:text-green-900 hover:bg-green-100"
                onClick={(e) => handleStartEdit(e, customer)}
              >
                <Pencil className="w-4 h-4 mr-1" />
                แก้ไข
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={prevStep}>
            ย้อนกลับ
          </Button>
          <Button onClick={handleNext} disabled={!customer}>
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
