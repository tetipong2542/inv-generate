import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/useApi';
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Wand2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface AIItemGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsGenerated: (items: LineItem[]) => void;
  onOpenSettings: () => void;
}

export function AIItemGeneratorModal({ 
  open, 
  onOpenChange, 
  onItemsGenerated,
  onOpenSettings 
}: AIItemGeneratorModalProps) {
  const { loading, error, post, setError } = useApi();
  const [description, setDescription] = useState('');
  const [count, setCount] = useState(3);
  const [generatedItems, setGeneratedItems] = useState<LineItem[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('กรุณาระบุรายละเอียดงาน');
      return;
    }

    const response = await post<{ items: LineItem[]; model: string }>('/ai/generate-items', {
      description: description.trim(),
      count,
    });

    if (response.success && response.data) {
      setGeneratedItems(response.data.items);
      setStep('preview');
    }
  };

  const handleConfirm = () => {
    onItemsGenerated(generatedItems);
    handleClose();
  };

  const handleClose = () => {
    setDescription('');
    setCount(3);
    setGeneratedItems([]);
    setStep('input');
    setError(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('input');
    setGeneratedItems([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            สร้างรายการด้วย AI
          </DialogTitle>
          <DialogDescription>
            {step === 'input' 
              ? 'อธิบายงานหรือบริการ แล้ว AI จะช่วยสร้างรายการให้'
              : 'ตรวจสอบรายการที่ AI สร้าง แล้วกด "เพิ่มรายการ"'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <>
            <div className="space-y-4 py-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                  {error.includes('API Key') && (
                    <Button variant="link" size="sm" className="ml-auto" onClick={onOpenSettings}>
                      ตั้งค่า API Key
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">รายละเอียดงาน/บริการ</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น: พัฒนาเว็บไซต์ e-commerce ด้วย React และ Node.js รวมถึงการออกแบบ UI/UX และระบบ backend"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  ยิ่งอธิบายละเอียด AI จะสร้างรายการได้ตรงความต้องการมากขึ้น
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">จำนวนรายการที่ต้องการ</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">รายการ (1-10)</span>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-purple-800">AI จะสร้าง:</p>
                    <ul className="text-purple-700 mt-1 space-y-0.5">
                      <li>• รายละเอียดสินค้า/บริการ</li>
                      <li>• หน่วยที่เหมาะสม</li>
                    </ul>
                    <p className="text-purple-600 mt-1 text-xs">
                      * จำนวน และ ราคา คุณสามารถใส่เองได้ภายหลัง
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="w-4 h-4 mr-1" />
                ตั้งค่า AI
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button onClick={handleGenerate} disabled={loading || !description.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    สร้างรายการ
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>AI สร้างรายการสำเร็จ {generatedItems.length} รายการ</span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {generatedItems.map((item, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "p-3 border rounded-lg bg-muted/30",
                      "animate-fade-in"
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          หน่วย: {item.unit}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>จำนวน: {item.quantity}</p>
                        <p>ราคา: รอกรอก</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                หลังเพิ่มรายการแล้ว คุณสามารถแก้ไขจำนวนและราคาได้ในฟอร์ม
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                สร้างใหม่
              </Button>
              <Button onClick={handleConfirm}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                เพิ่มรายการทั้งหมด
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
