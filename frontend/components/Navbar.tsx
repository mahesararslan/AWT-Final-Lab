'use client';

import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  userEmail: string;
  userRole: string;
}

export default function Navbar({ userEmail, userRole }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await authAPI.logout();
    router.push('/login');
  };

  const getDashboardLinks = () => {
    switch (userRole) {
      case 'ADMIN':
        return [
          { name: 'Dashboard', href: '/admin/dashboard' },
          { name: 'Users', href: '/admin/users' },
          { name: 'Appointments', href: '/admin/appointments' },
        ];
      case 'DOCTOR':
        return [
          { name: 'Dashboard', href: '/doctor/dashboard' },
          { name: 'Appointments', href: '/doctor/appointments' },
        ];
      case 'PATIENT':
        return [
          { name: 'Dashboard', href: '/patient/dashboard' },
          { name: 'Book Appointment', href: '/patient/book-appointment' },
          { name: 'My Appointments', href: '/patient/appointments' },
        ];
      default:
        return [];
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-indigo-600">Healthcare</span>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {getDashboardLinks().map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationBell />
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                <p className="text-xs text-gray-500">{userRole}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
