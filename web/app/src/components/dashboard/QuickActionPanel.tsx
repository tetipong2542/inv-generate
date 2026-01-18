import { useNavigate } from 'react-router-dom';
import { Zap, User, Building2, Package, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { useFormStore } from '@/hooks/useFormStore';
import { cn, formatNumber } from '@/lib/utils';

export function QuickActionPanel() {
  const navigate = useNavigate();
  const {
    selection,
    getSelectedFreelancer,
    getSelectedCustomer,
    getSelectedServices,
    getSelectedServiceItems,
    canQuickCreate,
    clearAllSelections,
  } = useDashboardStore();

  const { setFreelancer, setCustomer, setDocument, setCurrentStep } = useFormStore();

  const selectedFreelancer = getSelectedFreelancer();
  const selectedCustomer = getSelectedCustomer();
  const selectedServices = getSelectedServices();
  const selectedItems = getSelectedServiceItems();

  const totalAmount = selectedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const handleQuickCreate = () => {
    // Set freelancer
    if (selectedFreelancer) {
      setFreelancer(selectedFreelancer);
    }

    // Set customer
    if (selectedCustomer) {
      setCustomer(selectedCustomer);
    }

    // Set document with selected service items
    if (selectedItems.length > 0) {
      setDocument({
        items: selectedItems,
        documentNumber: 'auto',
        issueDate: new Date().toISOString().split('T')[0],
        taxRate: 0.03,
        taxType: 'withholding',
        taxLabel: 'หักภาษี ณ ที่จ่าย (3%)',
      });
    }

    // Navigate to step 2 (DocumentStep) to set payment terms, notes, tax profile
    // Even if services are selected, user should review and select tax profile
    if (selectedFreelancer && selectedCustomer) {
      setCurrentStep(2); // Go to Document step (Step 3 in UI, index 2)
    } else {
      setCurrentStep(0); // Start from beginning
    }

    navigate('/create');
  };

  const hasSelection = selection.freelancerId || selection.customerId || selection.serviceIds.length > 0;

  if (!hasSelection) {
    return (
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="py-6 sm:py-8 text-center text-gray-500">
          <Zap className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-xs sm:text-sm">เลือกผู้ออกเอกสาร + ลูกค้า</p>
          <p className="text-xs mt-1">เพื่อสร้างใบเสนอราคาอย่างรวดเร็ว</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="py-2 sm:py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Quick Create
        </CardTitle>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={clearAllSelections}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 pt-0">
        {/* Freelancer */}
        <div className="flex items-start gap-2">
          <User
            className={cn(
              "h-4 w-4 mt-0.5",
              selectedFreelancer ? "text-blue-600" : "text-gray-400"
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">ผู้ออกเอกสาร</p>
            {selectedFreelancer ? (
              <p className="text-sm font-medium truncate">{selectedFreelancer.name}</p>
            ) : (
              <p className="text-sm text-gray-400">ยังไม่ได้เลือก</p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-start gap-2">
          <Building2
            className={cn(
              "h-4 w-4 mt-0.5",
              selectedCustomer ? "text-green-600" : "text-gray-400"
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">ลูกค้า</p>
            {selectedCustomer ? (
              <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
            ) : (
              <p className="text-sm text-gray-400">ยังไม่ได้เลือก</p>
            )}
          </div>
        </div>

        {/* Services */}
        <div className="flex items-start gap-2">
          <Package
            className={cn(
              "h-4 w-4 mt-0.5",
              selectedServices.length > 0 ? "text-purple-600" : "text-gray-400"
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">แพ็คเกจบริการ</p>
            {selectedServices.length > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {selectedServices.length} แพ็คเกจ ({selectedItems.length} รายการ)
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  รวม: <span className="font-medium">{formatNumber(totalAmount)} บาท</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">ยังไม่ได้เลือก (ไม่จำเป็น)</p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="w-full mt-4"
          disabled={!canQuickCreate()}
          onClick={handleQuickCreate}
        >
          สร้างใบเสนอราคา
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>

        {!canQuickCreate() && (
          <p className="text-xs text-center text-gray-500">
            กรุณาเลือกผู้ออกเอกสารและลูกค้า
          </p>
        )}
      </CardContent>
    </Card>
  );
}
