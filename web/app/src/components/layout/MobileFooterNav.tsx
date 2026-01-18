import { Link, useLocation } from 'react-router-dom';
import { Home, FilePlus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'หน้าหลัก' },
  { path: '/create', icon: FilePlus, label: 'สร้างเอกสาร' },
  { path: '/settings', icon: Settings, label: 'ตั้งค่า' },
];

export function MobileFooterNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg md:hidden">
      <div className="flex items-center justify-around h-16 px-2 safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors",
                "active:bg-gray-100 touch-manipulation",
                isActive 
                  ? "text-blue-600" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className={cn(
                "h-6 w-6 mb-1",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-xs font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
