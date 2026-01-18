import React, { useEffect } from 'react';
import { useFormStore } from '@/hooks/useFormStore';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { useApi } from '@/hooks/useApi';
import { StepIndicator } from './StepIndicator';
import { FreelancerStep } from './FreelancerStep';
import { CustomerStep } from './CustomerStep';
import { DocumentStep } from './DocumentStep';
import { PreviewStep } from './PreviewStep';
import type { Customer } from '@/types';

const steps = [
  { id: 1, title: 'ผู้ออกเอกสาร', description: 'ข้อมูลของคุณ' },
  { id: 2, title: 'ลูกค้า', description: 'เลือกลูกค้า' },
  { id: 3, title: 'รายละเอียด', description: 'สินค้า/บริการ' },
  { id: 4, title: 'ยืนยัน', description: 'สร้าง PDF' },
];

export function StepWizard() {
  const { currentStep, setCurrentStep, loadFromDocument, loadFromLinkedDocument, setCustomer } = useFormStore();
  const { editMode, clearEdit, linkedMode, clearLinkedDocument, customers } = useDashboardStore();
  const { get } = useApi();

  // Handle edit mode - load document data into form
  useEffect(() => {
    if (editMode.isEditing && editMode.originalDocument) {
      const doc = editMode.originalDocument;
      
      // Find customer from dashboard store or fetch it
      let customer: Customer | null = null;
      if (doc.customerId) {
        customer = customers.find(c => c.id === doc.customerId) || null;
      }
      
      // Load document data into form
      loadFromDocument(doc, customer);
      
      // Clear edit mode after loading (so it doesn't reload on re-render)
      clearEdit();
    }
  }, [editMode.isEditing, editMode.originalDocument]);

  // Handle linked document mode (Document Chain: QT -> INV -> REC)
  useEffect(() => {
    if (linkedMode.isCreatingLinked && linkedMode.sourceDocument && linkedMode.targetType && linkedMode.linkedDocData) {
      const sourceDoc = linkedMode.sourceDocument;
      
      // Find customer from dashboard store
      let customer: Customer | null = null;
      if (sourceDoc.customerId) {
        customer = customers.find(c => c.id === sourceDoc.customerId) || null;
      }
      
      // Load linked document data into form
      loadFromLinkedDocument(
        sourceDoc,
        linkedMode.targetType,
        linkedMode.linkedDocData,
        customer
      );
      
      // Clear linked mode after loading
      clearLinkedDocument();
    }
  }, [linkedMode.isCreatingLinked, linkedMode.sourceDocument, linkedMode.targetType, linkedMode.linkedDocData]);

  const handleStepClick = (step: number) => {
    // Only allow going back to previous steps
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <FreelancerStep />;
      case 1:
        return <CustomerStep />;
      case 2:
        return <DocumentStep />;
      case 3:
        return <PreviewStep />;
      default:
        return <FreelancerStep />;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      <StepIndicator 
        steps={steps} 
        currentStep={currentStep} 
        onStepClick={handleStepClick}
      />
      <div className="animate-fade-in min-w-0 overflow-x-hidden">
        {renderStep()}
      </div>
    </div>
  );
}
