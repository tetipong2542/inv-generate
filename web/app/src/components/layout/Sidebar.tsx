import { Link, useLocation } from 'react-router-dom';
import { Home, FilePlus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/create', icon: FilePlus, label: 'สร้างเอกสาร' },
  { path: '/settings', icon: Settings, label: 'ตั้งค่า' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-16 border-r bg-white flex-col items-center py-4 gap-2 hidden md:flex">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors",
              "hover:bg-gray-100",
              isActive && "bg-blue-50 text-blue-600"
            )}
            title={item.label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] mt-1">{item.label.slice(0, 6)}</span>
          </Link>
        );
      })}
    </aside>
  );
}
