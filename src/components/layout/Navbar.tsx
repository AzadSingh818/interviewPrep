import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface NavbarProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export function Navbar({ userName, userRole, onLogout }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl" />
          <span className="text-2xl font-display font-bold text-slate-900">
            InterviewPrep<span className="text-indigo-600">Live</span>
          </span>
        </Link>
        
        <div className="flex items-center gap-4">
          {userName && (
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              {userRole && (
                <p className="text-xs text-slate-500 capitalize">{userRole.toLowerCase()}</p>
              )}
            </div>
          )}
          {onLogout && (
            <Button onClick={onLogout} variant="ghost" size="sm">
              Logout
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}