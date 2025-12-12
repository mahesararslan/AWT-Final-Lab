'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { NotificationProvider } from '@/components/NotificationProvider';
import { ConfirmModal } from '@/components/Modal';
import { authAPI, appointmentAPI } from '@/lib/api';
import { User, Appointment } from '@/lib/types';

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; appointmentId: string | null }>({
    open: false,
    appointmentId: null,
  });

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

      const appointmentsRes = await appointmentAPI.getAllAppointments();
      if (appointmentsRes.success && appointmentsRes.data) {
        setAppointments(appointmentsRes.data.appointments);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelModal.appointmentId) return;
    const response = await appointmentAPI.cancelAppointment(cancelModal.appointmentId);
    if (response.success) {
      loadData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'REJECTED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCancellationContext = (appointment: any) => {
    if (appointment.status === 'CANCELLED') {
      const cancelledBy = appointment.cancelledBy;
      if (cancelledBy === 'ADMIN') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by admin)</span>;
      } else if (cancelledBy === 'PATIENT') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by patient)</span>;
      } else if (cancelledBy === 'DOCTOR') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by doctor)</span>;
      }
    }
    if (appointment.status === 'REJECTED') {
      return <span className="text-xs text-orange-600 ml-2">(Rejected by doctor)</span>;
    }
    return null;
  };

  const filteredAppointments = appointments
    .filter((apt) => {
      if (filter === 'ALL') return true;
      return apt.status === filter;
    })
    .filter((apt) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return apt.patientEmail?.toLowerCase().includes(search) ||
             apt.doctorEmail?.toLowerCase().includes(search) ||
             (apt as any).patientName?.toLowerCase().includes(search) ||
             (apt as any).doctorName?.toLowerCase().includes(search);
    });

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
            <h1 className="text-3xl font-bold text-gray-900">All Appointments</h1>
            <p className="text-gray-600 mt-2">View and monitor all system appointments</p>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex flex-wrap gap-2">
                {['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === status
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{appointments.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Pending</h3>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {appointments.filter((a) => a.status === 'PENDING').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Approved</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {appointments.filter((a) => a.status === 'APPROVED').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Completed</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {appointments.filter((a) => a.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Rejected</h3>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {appointments.filter((a) => a.status === 'REJECTED').length}
              </p>
            </div>
          </div>

          {/* Appointments List */}
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y divide-gray-200">
              {filteredAppointments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No appointments found.</div>
              ) : (
                filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-3">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                          {getCancellationContext(appointment)}
                          <span className="text-xs text-gray-400">ID: {appointment.id.slice(0, 8)}...</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-1">👤 Patient</p>
                            <p className="text-sm text-gray-600">{(appointment as any).patientName || appointment.patientEmail || 'Unknown'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-1">👨‍⚕️ Doctor</p>
                            <p className="text-sm text-gray-600">Dr. {(appointment as any).doctorName || appointment.doctorEmail || 'Unknown'}</p>
                            {((appointment as any).doctorSpecialization || appointment.doctorSpecialization) && (
                              <p className="text-xs text-teal-600">{(appointment as any).doctorSpecialization || appointment.doctorSpecialization}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">📅 Date:</span>{' '}
                            {new Date((appointment as any).date || appointment.appointmentDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">🕐 Time:</span> {(appointment as any).time || appointment.appointmentTime}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">📋 Reason:</span> {appointment.reason}
                          </p>
                          {appointment.notes && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">📝 Notes:</span> {appointment.notes}
                            </p>
                          )}
                          {(appointment.createdAt || (appointment as any).created_at) && (
                            <p className="text-xs text-gray-400 mt-3">
                              Created: {new Date(appointment.createdAt || (appointment as any).created_at).toLocaleString()}
                              {(appointment.updatedAt || (appointment as any).updated_at) && (
                                <> | Updated: {new Date(appointment.updatedAt || (appointment as any).updated_at).toLocaleString()}</>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-6">
                        {(appointment.status === 'PENDING' || appointment.status === 'APPROVED') && (
                          <button
                            onClick={() => setCancelModal({ open: true, appointmentId: appointment.id })}
                            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-600 rounded-md hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        <ConfirmModal
          isOpen={cancelModal.open}
          onClose={() => setCancelModal({ open: false, appointmentId: null })}
          onConfirm={handleCancelAppointment}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment? This action cannot be undone."
          confirmText="Cancel Appointment"
          variant="danger"
        />
      </div>
    </NotificationProvider>
  );
}
