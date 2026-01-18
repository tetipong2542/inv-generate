import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileFooterNav } from './MobileFooterNav';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Navbar />
      <Sidebar />
      <MobileFooterNav />
      {/* Main content: no left padding on mobile, with padding on md+ */}
      {/* Bottom padding on mobile for footer nav */}
      <main className="pt-14 pl-0 md:pl-16 pb-20 md:pb-0 overflow-x-hidden">
        <div className="w-full max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
