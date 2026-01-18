import React, { useEffect, useState } from 'react';
import { useFormStore } from '@/hooks/useFormStore';
import { useApi } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { FreelancerConfig } from '@/types';

export function FreelancerStep() {
  const { freelancer, setFreelancer, nextStep } = useFormStore();
  const { loading, error, get, put } = useApi();
  const [isExample, setIsExample] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState<FreelancerConfig>({
    name: '',
    title: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    signature: '',
    bankInfo: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      branch: '',
    },
  });

  useEffect(() => {
    loadFreelancer();
  }, []);

  const loadFreelancer = async () => {
    const response = await get<FreelancerConfig>('/config/freelancer');
    if (response.success && response.data) {
      setFormData(response.data);
      setFreelancer(response.data);
      setIsExample((response as any).isExample || false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      if (field.startsWith('bankInfo.')) {
        const bankField = field.replace('bankInfo.', '');
        return {
          ...prev,
          bankInfo: { ...prev.bankInfo, [bankField]: value },
        };
      }
      return { ...prev, [field]: value };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const response = await put('/config/freelancer', formData);
    if (response.success) {
      setFreelancer(formData);
      setSaved(true);
      setIsExample(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleNext = () => {
    setFreelancer(formData);
    nextStep();
  };

  const isValid = formData.name && formData.email && formData.address && 
                  formData.taxId && formData.bankInfo.bankName && 
                  formData.bankInfo.accountNumber;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">ข้อมูลผู้ออกเอกสาร</CardTitle>
        <CardDescription className="text-sm">
          ข้อมูลของคุณที่จะแสดงในเอกสาร
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {isExample && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>นี่คือข้อมูลตัวอย่าง กรุณาแก้ไขเป็นข้อมูลจริงของคุณ</span>
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>บันทึกข้อมูลเรียบร้อยแล้ว</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Personal Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="นาย ฐิติพงศ์ มานะจิตต์"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">ตำแหน่ง/อาชีพ</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Web Developer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="08-xxxx-xxxx"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">ที่อยู่ *</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="เลขที่ 123 ซ.เพชรบุรี 45 เขตราชเทวี กรุงเทพมหานคร 10400"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี *</Label>
          <Input
            id="taxId"
            value={formData.taxId}
            onChange={(e) => handleChange('taxId', e.target.value)}
            placeholder="1809900958692"
          />
        </div>

        {/* Bank Info */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-4">ข้อมูลบัญชีธนาคาร</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">ชื่อธนาคาร *</Label>
              <Input
                id="bankName"
                value={formData.bankInfo.bankName}
                onChange={(e) => handleChange('bankInfo.bankName', e.target.value)}
                placeholder="ธนาคารกสิกร"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">เลขที่บัญชี *</Label>
              <Input
                id="accountNumber"
                value={formData.bankInfo.accountNumber}
                onChange={(e) => handleChange('bankInfo.accountNumber', e.target.value)}
                placeholder="1623852969"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">ชื่อบัญชี</Label>
              <Input
                id="accountName"
                value={formData.bankInfo.accountName}
                onChange={(e) => handleChange('bankInfo.accountName', e.target.value)}
                placeholder="นาย ฐิติพงศ์ มานะจิตต์"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">สาขา</Label>
              <Input
                id="branch"
                value={formData.bankInfo.branch || ''}
                onChange={(e) => handleChange('bankInfo.branch', e.target.value)}
                placeholder="สาขาสีลม"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={handleSave}
            disabled={loading || !isValid}
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
          <Button 
            onClick={handleNext}
            disabled={!isValid}
          >
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
