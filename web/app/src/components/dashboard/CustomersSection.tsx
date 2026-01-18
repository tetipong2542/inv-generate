import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, Search, Phone, Building2 } from 'lucide-react';
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
import type { Customer } from '@/types';
import { cn } from '@/lib/utils';

const emptyCustomer: Customer = {
  id: '',
  name: '',
  company: '',
  address: '',
  taxId: '',
  phone: '',
};

export function CustomersSection() {
  const { get, post, put, del } = useApi();
  const { customers, setCustomers, selection, selectCustomer, setLoading } = useDashboardStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [formData, setFormData] = useState(emptyCustomer);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(item =>
      item.name?.toLowerCase().includes(term) ||
      item.company?.toLowerCase().includes(term) ||
      item.taxId?.includes(term) ||
      item.phone?.includes(term)
    );
  }, [customers, searchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading('customers', true);
    const response = await get<Customer[]>('/customers');
    if (response?.success && response.data) {
      setCustomers(response.data);
    }
    setLoading('customers', false);
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ ...emptyCustomer, id: `customer-${Date.now()}` });
    setIsModalOpen(true);
  };

  const openEdit = (item: Customer) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editingItem) {
      await put(`/customers/${editingItem.id}`, formData);
    } else {
      await post('/customers', formData);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('ยืนยันการลบ?')) {
      await del(`/customers/${id}`);
      if (selection.customerId === id) {
        selectCustomer(null);
      }
      loadData();
    }
  };

  const handleSelect = (id: string) => {
    selectCustomer(selection.customerId === id ? null : id);
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-2 py-3">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm sm:text-base">ลูกค้า</CardTitle>
          <Button size="sm" onClick={openCreate} className="h-8 text-xs sm:text-sm">
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">เพิ่ม</span>
          </Button>
        </div>
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาชื่อ, บริษัท, เลขภาษี..."
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
                <th className="text-left p-2 hidden sm:table-cell" style={{ width: '140px' }}>เลขผู้เสียภาษี</th>
                <th className="w-16 sm:w-20 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-t hover:bg-gray-50 cursor-pointer",
                      selection.customerId === item.id && "bg-green-50"
                    )}
                    onClick={() => handleSelect(item.id || '')}
                  >
                    <td className="p-2 text-center">
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          selection.customerId === item.id
                            ? "bg-green-600 border-green-600"
                            : "border-gray-300"
                        )}
                      >
                        {selection.customerId === item.id && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{item.name}</div>
                      {item.company && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{item.company}</span>
                        </div>
                      )}
                      {item.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                      {/* Show taxId on mobile only */}
                      {item.taxId && (
                        <div className="text-xs text-gray-400 sm:hidden mt-0.5">
                          Tax: {item.taxId}
                        </div>
                      )}
                    </td>
                    <td className="p-2 hidden sm:table-cell text-gray-600 font-mono text-xs">
                      {item.taxId}
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
              {editingItem ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>ชื่อ *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <Label>บริษัท</Label>
              <Input
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>เลขประจำตัวผู้เสียภาษี *</Label>
                <Input
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
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
              <Label>ที่อยู่ *</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.taxId || !formData.address}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
