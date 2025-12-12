'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { NotificationProvider } from '@/components/NotificationProvider';
import { authAPI, appointmentAPI } from '@/lib/api';
import { User, Appointment } from '@/lib/types';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPatients: 0,
    totalDoctors: 0,
    totalAppointments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await authAPI.getProfile();
      if (profileRes.success && profileRes.data?.user) {
        setUser(profileRes.data.user);
      } else {
        router.push('/login');
        return;
      }

      const usersRes = await authAPI.getAllUsers();
      if (usersRes.success && usersRes.data) {
        const allUsers = usersRes.data.users;
        setUsers(allUsers);
        setStats({
          totalUsers: allUsers.length,
          totalPatients: allUsers.filter((u) => u.role === 'PATIENT').length,
          totalDoctors: allUsers.filter((u) => u.role === 'DOCTOR').length,
          totalAppointments: 0,
        });
      }

      const appointmentsRes = await appointmentAPI.getAllAppointments();
      if (appointmentsRes.success && appointmentsRes.data) {
        const allAppointments = appointmentsRes.data.appointments;
        setAppointments(allAppointments);
        setStats((prev) => ({ ...prev, totalAppointments: allAppointments.length }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <NotificationProvider userId={user.id}>
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={user.email} userRole={user.role} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">System overview and management</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Patients</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalPatients}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Doctors</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalDoctors}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Appointments</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.totalAppointments}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/admin/users')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Manage Users
              </button>
              <button
                onClick={() => router.push('/admin/appointments')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                View All Appointments
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Users */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Recent Users</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {users.slice(0, 5).map((usr) => (
                  <div key={usr.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{usr.email}</p>
                        <p className="text-xs text-gray-500">{usr.role}</p>
                        {usr.specialization && (
                          <p className="text-xs text-indigo-600">{usr.specialization}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(usr.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Appointments */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Recent Appointments</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {appointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {(apt as any).patientName || apt.patientEmail || 'Unknown'} → Dr. {(apt as any).doctorName || apt.doctorEmail || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date((apt as any).date || apt.appointmentDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })} at {(apt as any).time || apt.appointmentTime}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          apt.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : apt.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : apt.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800'
                            : apt.status === 'REJECTED'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}
