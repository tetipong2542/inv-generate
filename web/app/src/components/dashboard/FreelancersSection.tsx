import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, Search, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/useApi';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import type { FreelancerConfig } from '@/types';
import { cn } from '@/lib/utils';

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
  },
};

export function FreelancersSection() {
  const { get, post, put, del, loading } = useApi();
  const { freelancers, setFreelancers, selection, selectFreelancer, setLoading } = useDashboardStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(FreelancerConfig & { id?: string }) | null>(null);
  const [formData, setFormData] = useState(emptyFreelancer);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter freelancers based on search
  const filteredFreelancers = useMemo(() => {
    if (!searchTerm.trim()) return freelancers;
    const term = searchTerm.toLowerCase();
    return freelancers.filter(item =>
      item.name?.toLowerCase().includes(term) ||
      item.email?.toLowerCase().includes(term) ||
      item.phone?.includes(term) ||
      item.taxId?.includes(term)
    );
  }, [freelancers, searchTerm]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading('freelancers', true);
    const response = await get<FreelancerConfig[]>('/freelancers');
    if (response?.success && response.data) {
      setFreelancers(response.data);
    }
    setLoading('freelancers', false);
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ ...emptyFreelancer, id: `freelancer-${Date.now()}` });
    setIsModalOpen(true);
  };

  const openEdit = (item: FreelancerConfig & { id?: string }) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editingItem) {
      await put(`/freelancers/${editingItem.id}`, formData);
    } else {
      await post('/freelancers', formData);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('ยืนยันการลบ?')) {
      await del(`/freelancers/${id}`);
      if (selection.freelancerId === id) {
        selectFreelancer(null);
      }
      loadData();
    }
  };

  const handleSelect = (id: string) => {
    selectFreelancer(selection.freelancerId === id ? null : id);
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-2 py-3">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm sm:text-base">ผู้ออกเอกสาร</CardTitle>
          <Button size="sm" onClick={openCreate} className="h-8 text-xs sm:text-sm">
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">เพิ่ม</span>
          </Button>
        </div>
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-48 sm:max-h-64 overflow-auto touch-scroll">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-8 sm:w-10 p-2"></th>
                <th className="text-left p-2">ชื่อ / ข้อมูลติดต่อ</th>
                <th className="w-16 sm:w-20 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredFreelancers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล'}
                  </td>
                </tr>
              ) : (
                filteredFreelancers.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-t hover:bg-gray-50 cursor-pointer",
                      selection.freelancerId === item.id && "bg-blue-50"
                    )}
                    onClick={() => handleSelect(item.id || '')}
                  >
                    <td className="p-2 text-center">
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          selection.freelancerId === item.id
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300"
                        )}
                      >
                        {selection.freelancerId === item.id && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{item.name}</div>
                      {item.title && (
                        <div className="text-xs text-gray-500">{item.title}</div>
                      )}
                      {item.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{item.email}</span>
                        </div>
                      )}
                      {item.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id || '');
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'แก้ไขผู้ออกเอกสาร' : 'เพิ่มผู้ออกเอกสาร'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ชื่อ *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>ตำแหน่ง</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>อีเมล *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>โทรศัพท์</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>เลขประจำตัวผู้เสียภาษี *</Label>
              <Input
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
            
            <div>
              <Label>ที่อยู่ *</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">ข้อมูลธนาคาร</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>ธนาคาร</Label>
                  <Input
                    value={formData.bankInfo.bankName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankInfo: { ...formData.bankInfo, bankName: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>ชื่อบัญชี</Label>
                  <Input
                    value={formData.bankInfo.accountName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankInfo: { ...formData.bankInfo, accountName: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>เลขบัญชี</Label>
                <Input
                  value={formData.bankInfo.accountNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankInfo: { ...formData.bankInfo, accountNumber: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.email}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
