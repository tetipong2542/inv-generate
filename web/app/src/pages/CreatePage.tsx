import { useEffect } from 'react';
import { StepWizard } from '@/components/forms/StepWizard';
import { AIChatAgent } from '@/components/chat/AIChatAgent';
import { useDashboardStore } from '@/hooks/useDashboardStore';

export function CreatePage() {
  const { editMode, clearEdit } = useDashboardStore();
  
  // Clear edit mode when leaving the page
  useEffect(() => {
    return () => {
      // Don't clear on unmount - let it persist until form submission
    };
  }, []);

  const isEditing = editMode.isEditing && editMode.originalDocument;
  const originalDocNumber = editMode.originalDocument?.documentNumber;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 to-slate-100 overflow-x-hidden">
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {isEditing ? `แก้ไข ${originalDocNumber}` : 'สร้างเอกสารใหม่'}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {isEditing 
              ? 'แก้ไขและสร้าง Revision ใหม่'
              : 'กรอกข้อมูลตามขั้นตอน'
            }
          </p>
          {isEditing && (
            <button 
              onClick={clearEdit}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        <StepWizard />
      </main>

      {/* AI Chat Agent */}
      <AIChatAgent />
    </div>
  );
}
