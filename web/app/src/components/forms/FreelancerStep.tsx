import React, { useEffect, useState } from 'react';
import { useFormStore } from '@/hooks/useFormStore';
import { useApi } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, User, Check, Pencil, Trash2, AlertCircle, Image, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FreelancerConfig } from '@/types';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

type FormMode = 'list' | 'create' | 'edit';

interface LogoImage {
  filename: string;
  url: string;
  path: string;
}

const emptyFreelancer: FreelancerConfig & { id?: string } = {
  id: '',
  name: '',
  title: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  bankInfo: {
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
  },
};

export function FreelancerStep() {
  const { freelancer, setFreelancer, nextStep } = useFormStore();
  const { loading, error, get, post, put, del, setError } = useApi();
  
  const [freelancers, setFreelancers] = useState<(FreelancerConfig & { id?: string })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('list');
  const [editingFreelancer, setEditingFreelancer] = useState<FreelancerConfig & { id?: string }>(emptyFreelancer);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showLogoGallery, setShowLogoGallery] = useState(false);
  const [logoImages, setLogoImages] = useState<LogoImage[]>([]);

  useEffect(() => {
    loadFreelancers();
  }, []);

  const loadFreelancers = async () => {
    const response = await get<(FreelancerConfig & { id?: string })[]>('/freelancers');
    if (response.success && response.data) {
      setFreelancers(response.data);
      
      if (freelancer?.id) {
        const found = response.data.find(f => f.id === freelancer.id);
        if (found) {
          setSelectedId(found.id || null);
          setFreelancer(found);
        }
      } else if (response.data.length === 1) {
        handleSelectFreelancer(response.data[0]);
      }
    }
  };

  const handleSelectFreelancer = (f: FreelancerConfig & { id?: string }) => {
    setSelectedId(f.id || null);
    setFreelancer(f);
    setFormMode('list');
    setDeleteConfirm(null);
  };

  const handleStartCreate = () => {
    setEditingFreelancer({ ...emptyFreelancer, id: `freelancer-${Date.now()}` });
    setLogoPreview(null);
    setShowLogoGallery(false);
    setFormMode('create');
    setError(null);
  };

  const handleStartEdit = (e: React.MouseEvent, f: FreelancerConfig & { id?: string }) => {
    e.stopPropagation();
    setEditingFreelancer({ ...f });
    if (f.logo) {
      setLogoPreview(`/api/logos/file/${f.logo.replace('logos/', '')}`);
    } else {
      setLogoPreview(null);
    }
    setShowLogoGallery(false);
    setFormMode('edit');
    setError(null);
  };

  const handleCreateFreelancer = async () => {
    const response = await post<FreelancerConfig & { id?: string }>('/freelancers', editingFreelancer);
    if (response.success && response.data) {
      await loadFreelancers();
      handleSelectFreelancer({ ...response.data });
      setFormMode('list');
    }
  };

  const handleUpdateFreelancer = async () => {
    if (!editingFreelancer.id) return;

    const response = await put<FreelancerConfig & { id?: string }>(`/freelancers/${editingFreelancer.id}`, editingFreelancer);
    if (response.success && response.data) {
      await loadFreelancers();
      if (selectedId === editingFreelancer.id) {
        setFreelancer({ ...editingFreelancer });
      }
      setFormMode('list');
    }
  };

  const handleDeleteFreelancer = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    const response = await del(`/freelancers/${id}`);
    if (response.success) {
      await loadFreelancers();
      if (selectedId === id) {
        setSelectedId(null);
        setFreelancer(null);
      }
      setDeleteConfirm(null);
    }
  };

  const handleCancelForm = () => {
    setFormMode('list');
    setError(null);
    setLogoPreview(null);
    setShowLogoGallery(false);
  };

  const handleNext = () => {
    if (freelancer) {
      nextStep();
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('logo', file);

      const response = await fetch(`${API_BASE}/logos/upload`, {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await response.json();
      if (data.success) {
        setEditingFreelancer({ ...editingFreelancer, logo: `logos/${data.data.filename}` });
        setLogoPreview(data.data.url);
      } else {
        alert(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setUploadingLogo(false);
    }
  };

  const loadLogoGallery = async () => {
    try {
      const response = await fetch(`${API_BASE}/logos`);
      const data = await response.json();
      if (data.success) {
        setLogoImages(data.data);
      }
    } catch (err) {
      console.error('Failed to load logo gallery:', err);
    }
  };

  const handleSelectLogo = (logo: LogoImage) => {
    setEditingFreelancer({ ...editingFreelancer, logo: `logos/${logo.filename}` });
    setLogoPreview(logo.url);
    setShowLogoGallery(false);
  };

  const handleDeleteLogo = () => {
    setEditingFreelancer({ ...editingFreelancer, logo: undefined });
    setLogoPreview(null);
  };

  const handleDeleteLogoFromGallery = async (filename: string) => {
    if (!confirm('ยืนยันการลบโลโก้นี้ออกจากระบบ?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/logos/${filename}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        await loadLogoGallery();
        if (editingFreelancer.logo?.includes(filename)) {
          setEditingFreelancer({ ...editingFreelancer, logo: undefined });
          setLogoPreview(null);
        }
      } else {
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Delete logo error:', err);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const isFormValid = editingFreelancer.name && editingFreelancer.email && 
                      editingFreelancer.address && editingFreelancer.taxId &&
                      editingFreelancer.bankInfo.bankName && editingFreelancer.bankInfo.accountNumber;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">เลือกผู้ออกเอกสาร</CardTitle>
        <CardDescription className="text-sm">
          เลือกผู้ออกเอกสารจากรายชื่อที่มีอยู่ หรือเพิ่มใหม่
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {formMode === 'list' && (
          <div className="space-y-3">
            {freelancers.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <p>ยังไม่มีผู้ออกเอกสารในระบบ</p>
                <p className="text-sm mt-2">
                  กดปุ่ม "เพิ่มผู้ออกเอกสารใหม่" เพื่อเริ่มต้น
                </p>
              </div>
            )}

            {freelancers.map((f) => (
              <div
                key={f.id}
                onClick={() => handleSelectFreelancer(f)}
                className={cn(
                  "w-full p-4 rounded-lg border text-left transition-all duration-200 cursor-pointer",
                  "hover:border-primary/50 hover:bg-primary/5",
                  selectedId === f.id 
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      selectedId === f.id ? "bg-primary text-white" : "bg-muted"
                    )}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{f.name}</p>
                      {f.title && (
                        <p className="text-sm text-muted-foreground">{f.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Tax ID: {f.taxId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => handleStartEdit(e, f)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        deleteConfirm === f.id 
                          ? "text-white bg-destructive hover:bg-destructive/90" 
                          : "text-muted-foreground hover:text-destructive"
                      )}
                      onClick={(e) => handleDeleteFreelancer(e, f.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    {selectedId === f.id && (
                      <Check className="w-5 h-5 text-primary ml-2" />
                    )}
                  </div>
                </div>
                
                {deleteConfirm === f.id && (
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
              เพิ่มผู้ออกเอกสารใหม่ (Manual)
            </Button>
          </div>
        )}

        {(formMode === 'create' || formMode === 'edit') && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {formMode === 'create' ? 'เพิ่มผู้ออกเอกสารใหม่' : `แก้ไข: ${editingFreelancer.name}`}
              </h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="freelancerName">ชื่อ-นามสกุล *</Label>
                <Input
                  id="freelancerName"
                  value={editingFreelancer.name}
                  onChange={(e) => setEditingFreelancer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="นาย ฐิติพงศ์ มานะจิตต์"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freelancerTitle">ตำแหน่ง/อาชีพ</Label>
                <Input
                  id="freelancerTitle"
                  value={editingFreelancer.title}
                  onChange={(e) => setEditingFreelancer(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Web Developer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="freelancerEmail">อีเมล *</Label>
                <Input
                  id="freelancerEmail"
                  type="email"
                  value={editingFreelancer.email}
                  onChange={(e) => setEditingFreelancer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freelancerPhone">เบอร์โทรศัพท์</Label>
                <Input
                  id="freelancerPhone"
                  value={editingFreelancer.phone || ''}
                  onChange={(e) => setEditingFreelancer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="08-xxxx-xxxx"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="freelancerAddress">ที่อยู่ *</Label>
              <Textarea
                id="freelancerAddress"
                value={editingFreelancer.address}
                onChange={(e) => setEditingFreelancer(prev => ({ ...prev, address: e.target.value }))}
                placeholder="เลขที่ 123 ซ.เพชรบุรี 45 เขตราชเทวี กรุงเทพมหานคร 10400"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="freelancerTaxId">เลขประจำตัวผู้เสียภาษี *</Label>
              <Input
                id="freelancerTaxId"
                value={editingFreelancer.taxId}
                onChange={(e) => setEditingFreelancer(prev => ({ ...prev, taxId: e.target.value }))}
                placeholder="1809900958692"
              />
            </div>

            <div className="border-t pt-4">
              <h5 className="font-medium mb-3">โลโก้</h5>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="cursor-pointer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setShowLogoGallery(!showLogoGallery);
                      if (!showLogoGallery) loadLogoGallery();
                    }}
                  >
                    <Image className="h-4 w-4 mr-1" />
                    เลือกจาก Gallery
                  </Button>
                  {uploadingLogo && (
                    <p className="text-sm text-gray-500">กำลังอัปโหลด...</p>
                  )}
                </div>
                {logoPreview && (
                  <div className="flex-shrink-0 relative group">
                    <img 
                      src={logoPreview} 
                      alt="Logo" 
                      className="w-20 h-20 object-contain border rounded p-1 bg-white"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleDeleteLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {showLogoGallery && (
                <div className="mt-3 p-3 border rounded bg-gray-50 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2">
                    {logoImages.map((logo) => (
                      <div
                        key={logo.filename}
                        className="relative group"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectLogo(logo)}
                          className="w-full border rounded p-1 hover:border-blue-500 transition-colors bg-white"
                        >
                          <img 
                            src={logo.url} 
                            alt={logo.filename}
                            className="w-full h-16 object-contain"
                          />
                        </button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLogoFromGallery(logo.filename);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {logoImages.length === 0 && (
                      <p className="col-span-4 text-center text-sm text-gray-500 py-4">
                        ยังไม่มีโลโก้
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h5 className="font-medium mb-3">ข้อมูลบัญชีธนาคาร</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">ชื่อธนาคาร *</Label>
                  <Input
                    id="bankName"
                    value={editingFreelancer.bankInfo.bankName}
                    onChange={(e) => setEditingFreelancer(prev => ({ 
                      ...prev, 
                      bankInfo: { ...prev.bankInfo, bankName: e.target.value } 
                    }))}
                    placeholder="ธนาคารกสิกร"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">เลขที่บัญชี *</Label>
                  <Input
                    id="accountNumber"
                    value={editingFreelancer.bankInfo.accountNumber}
                    onChange={(e) => setEditingFreelancer(prev => ({ 
                      ...prev, 
                      bankInfo: { ...prev.bankInfo, accountNumber: e.target.value } 
                    }))}
                    placeholder="1623852969"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="accountName">ชื่อบัญชี</Label>
                  <Input
                    id="accountName"
                    value={editingFreelancer.bankInfo.accountName}
                    onChange={(e) => setEditingFreelancer(prev => ({ 
                      ...prev, 
                      bankInfo: { ...prev.bankInfo, accountName: e.target.value } 
                    }))}
                    placeholder="นาย ฐิติพงศ์ มานะจิตต์"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">สาขา</Label>
                  <Input
                    id="branch"
                    value={editingFreelancer.bankInfo.branch || ''}
                    onChange={(e) => setEditingFreelancer(prev => ({ 
                      ...prev, 
                      bankInfo: { ...prev.bankInfo, branch: e.target.value } 
                    }))}
                    placeholder="สาขาสีลม"
                  />
                </div>
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
                onClick={formMode === 'create' ? handleCreateFreelancer : handleUpdateFreelancer}
                disabled={!isFormValid || loading}
              >
                {loading ? 'กำลังบันทึก...' : (formMode === 'create' ? 'บันทึก' : 'อัปเดตข้อมูล')}
              </Button>
            </div>
          </div>
        )}

        {freelancer && formMode === 'list' && (
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-green-800 font-medium">ผู้ออกเอกสารที่เลือก:</p>
                <p className="text-green-900">{freelancer.name}</p>
                {freelancer.title && (
                  <p className="text-sm text-green-700">{freelancer.title}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-700 hover:text-green-900 hover:bg-green-100"
                onClick={(e) => handleStartEdit(e, freelancer as FreelancerConfig & { id?: string })}
              >
                <Pencil className="w-4 h-4 mr-1" />
                แก้ไข
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleNext} disabled={!freelancer}>
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
