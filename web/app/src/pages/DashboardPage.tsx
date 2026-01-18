import {
  FreelancersSection,
  CustomersSection,
  ServicesSection,
  QuotationsSection,
  QuickActionPanel,
} from '@/components/dashboard';

export function DashboardPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600">จัดการข้อมูลและสร้างเอกสารอย่างรวดเร็ว</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {/* Left side - 3 columns */}
        <div className="lg:col-span-3 space-y-3 sm:space-y-4 md:space-y-6 min-w-0">
          {/* Row 1: Freelancers & Customers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            <FreelancersSection />
            <CustomersSection />
          </div>

          {/* Row 2: Services */}
          <ServicesSection />

          {/* Row 3: Quotations with Search & Filter */}
          <QuotationsSection />
        </div>

        {/* Right side - Quick Action Panel (sticky on lg, fixed bottom on mobile) */}
        <div className="lg:col-span-1 min-w-0">
          {/* On mobile: Show as horizontal bar above footer */}
          <div className="lg:sticky lg:top-20">
            <QuickActionPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
