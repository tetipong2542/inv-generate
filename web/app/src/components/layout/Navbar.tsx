import { Link } from 'react-router-dom';
import { FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 border-b bg-white z-50 flex items-center justify-between px-4">
      <Link to="/" className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-blue-600" />
        <span className="font-semibold text-lg">P.DEV-INV</span>
      </Link>
      
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
