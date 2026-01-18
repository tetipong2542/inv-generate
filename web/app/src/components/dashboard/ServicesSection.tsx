import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, Package, ChevronDown, ChevronRight, FileText } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApi } from '@/hooks/useApi';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import type { ServicePackage, LineItem, ServiceType } from '@/types';
import { cn, formatNumber } from '@/lib/utils';

const emptyItem: LineItem = {
  description: '',
  quantity: 1,
  unit: 'รายการ',
  unitPrice: 0,
};

const emptyService: ServicePackage = {
  type: 'item',
  name: '',
  description: '',
  items: [{ ...emptyItem }],
  category: '',
  isActive: true,
};

type FilterType = 'all' | 'item' | 'package';

export function ServicesSection() {
  const { get, post, put, del } = useApi();
  const { services, setServices, selection, toggleService, setLoading } = useDashboardStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServicePackage | null>(null);
  const [formData, setFormData] = useState<ServicePackage>(emptyService);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading('services', true);
    const response = await get<ServicePackage[]>('/services');
    if (response?.success && response.data) {
      setServices(response.data);
    }
    setLoading('services', false);
  };

  const filteredServices = services.filter((s) => {
    if (filter === 'all') return true;
    return s.type === filter;
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const openCreate = (type: ServiceType = 'item') => {
    setEditingItem(null);
    setFormData({ 
      ...emptyService, 
      type,
      items: type === 'item' ? [{ ...emptyItem }] : [{ ...emptyItem }] 
    });
    setIsModalOpen(true);
  };

  const openEdit = (item: ServicePackage) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editingItem?.id) {
      await put(`/services/${editingItem.id}`, formData);
    } else {
      await post('/services', formData);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('ยืนยันการลบ?')) {
      await del(`/services/${id}`);
      loadData();
    }
  };

  const handleSelect = (id: string) => {
    toggleService(id);
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { ...emptyItem }],
    });
  };

  const removeItemRow = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItemRow = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = (items: LineItem[]) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const qty = item?.quantity ?? 0;
      const price = item?.unitPrice ?? 0;
      return sum + qty * price;
    }, 0);
  };

  const itemCount = services.filter(s => s.type === 'item').length;
  const packageCount = services.filter(s => s.type === 'package').length;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">รายการ/แพ็คเกจบริการ</span>
          <span className="sm:hidden">บริการ</span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {/* Filter */}
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <SelectTrigger className="w-24 sm:w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด ({services.length})</SelectItem>
              <SelectItem value="item">รายการ ({itemCount})</SelectItem>
              <SelectItem value="package">แพ็คเกจ ({packageCount})</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Add buttons */}
          <Button size="sm" variant="outline" onClick={() => openCreate('item')} className="h-8 text-xs px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">รายการ</span>
          </Button>
          <Button size="sm" onClick={() => openCreate('package')} className="h-8 text-xs px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">แพ็คเกจ</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-72 overflow-auto touch-scroll">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-8 p-2 hidden sm:table-cell"></th>
                <th className="w-8 sm:w-10 p-2"></th>
                <th className="text-left p-2">ชื่อ</th>
                <th className="text-center p-2 w-14 sm:w-20 hidden sm:table-cell">ประเภท</th>
                <th className="text-right p-2 hidden md:table-cell w-20">รายการ</th>
                <th className="text-right p-2 w-20 sm:w-24">ราคา</th>
                <th className="w-14 sm:w-20 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    ยังไม่มีรายการบริการ
                  </td>
                </tr>
              ) : (
                filteredServices.map((item) => {
                  const isSelected = selection.serviceIds.includes(item.id || '');
                  const isPackage = item.type === 'package' || (item.items?.length || 0) > 1;
                  const isExpanded = expandedIds.has(item.id || '');
                  
                  return (
                    <>
                      <tr
                        key={item.id}
                        className={cn(
                          "border-t hover:bg-gray-50 cursor-pointer",
                          isSelected && "bg-purple-50"
                        )}
                        onClick={() => handleSelect(item.id || '')}
                      >
                        {/* Expand button for packages */}
                        <td className="p-2 text-center hidden sm:table-cell">
                          {isPackage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.id || '');
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </td>
                        
                        {/* Checkbox */}
                        <td className="p-2 text-center">
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center",
                              isSelected
                                ? "bg-purple-600 border-purple-600"
                                : "border-gray-300"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </td>
                        
                        {/* Name */}
                        <td className="p-2">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">
                              {item.description}
                            </div>
                          )}
                        </td>
                        
                        {/* Type badge */}
                        <td className="p-2 text-center hidden sm:table-cell">
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded",
                              isPackage
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {isPackage ? 'แพ็คเกจ' : 'รายการ'}
                          </span>
                        </td>
                        
                        {/* Items count */}
                        <td className="p-2 text-right hidden md:table-cell text-gray-600">
                          {item.items?.length || 0} รายการ
                        </td>
                        
                        {/* Total */}
                        <td className="p-2 text-right font-medium">
                          {formatNumber(calculateTotal(item.items || []))}
                        </td>
                        
                        {/* Actions */}
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
                      
                      {/* Expanded items (for packages) */}
                      {isPackage && isExpanded && (
                        <tr key={`${item.id}-items`} className="bg-gray-50">
                          <td colSpan={7} className="p-0">
                            <div className="p-3 pl-12 border-l-4 border-purple-200">
                              <div className="text-xs text-gray-500 mb-2">รายการในแพ็คเกจ:</div>
                              <div className="space-y-1">
                                {(item.items || []).map((subItem, idx) => (
                                  <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded">
                                    <span className="flex-1">{subItem?.description ?? ''}</span>
                                    <span className="text-gray-500 mx-4">
                                      {subItem?.quantity ?? 0} {subItem?.unit ?? ''}
                                    </span>
                                    <span className="font-medium w-24 text-right">
                                      {formatNumber((subItem?.quantity ?? 0) * (subItem?.unitPrice ?? 0))} บาท
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'แก้ไข' : 'เพิ่ม'}
              {formData.type === 'package' ? 'แพ็คเกจ' : 'รายการ'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.type === 'item' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, type: 'item' })}
              >
                <FileText className="h-4 w-4 mr-1" />
                รายการเดี่ยว
              </Button>
              <Button
                type="button"
                variant={formData.type === 'package' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, type: 'package' })}
              >
                <Package className="h-4 w-4 mr-1" />
                แพ็คเกจ
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ชื่อ{formData.type === 'package' ? 'แพ็คเกจ' : 'บริการ'} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={formData.type === 'package' ? 'เช่น แพ็คเกจเว็บไซต์ Basic' : 'เช่น ออกแบบ Logo'}
                />
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Input
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="เช่น Website, Design, SEO"
                />
              </div>
            </div>
            
            {/* Show description textarea only for packages */}
            {formData.type === 'package' && (
              <div>
                <Label>รายละเอียดแพ็คเกจ</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="อธิบายภาพรวมของแพ็คเกจนี้"
                />
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">
                  {formData.type === 'package' ? 'รายการในแพ็คเกจ' : 'รายละเอียดบริการ'}
                </h4>
                {formData.type === 'package' && (
                  <Button size="sm" variant="outline" onClick={addItemRow}>
                    <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="รายละเอียด"
                        value={item.description}
                        onChange={(e) => updateItemRow(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-16">
                      <Input
                        type="number"
                        placeholder="จำนวน"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(index, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        placeholder="หน่วย"
                        value={item.unit}
                        onChange={(e) => updateItemRow(index, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        placeholder="ราคา/หน่วย"
                        value={item.unitPrice}
                        onChange={(e) => updateItemRow(index, 'unitPrice', Number(e.target.value))}
                      />
                    </div>
                    {formData.type === 'package' && formData.items.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-red-500"
                        onClick={() => removeItemRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 text-right">
                <span className="text-sm text-gray-600">รวมทั้งหมด: </span>
                <span className="font-bold text-lg">
                  {formatNumber(calculateTotal(formData.items))} บาท
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || formData.items.length === 0}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
