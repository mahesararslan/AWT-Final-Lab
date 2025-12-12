'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { NotificationProvider } from '@/components/NotificationProvider';
import { ConfirmModal, InputModal } from '@/components/Modal';
import { authAPI, appointmentAPI } from '@/lib/api';
import { User, Appointment } from '@/lib/types';

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [cancelModal, setCancelModal] = useState<{ open: boolean; appointmentId: string | null }>({
    open: false,
    appointmentId: null,
  });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; appointmentId: string | null }>({
    open: false,
    appointmentId: null,
  });
  const [completeModal, setCompleteModal] = useState<{ open: boolean; appointmentId: string | null }>({
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

      const appointmentsRes = await appointmentAPI.getMyAppointments();
      if (appointmentsRes.success && appointmentsRes.data) {
        setAppointments(appointmentsRes.data.appointments);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const response = await appointmentAPI.approveAppointment(id);
    if (response.success) {
      loadData();
    }
  };

  const handleComplete = async (notes: string) => {
    if (!completeModal.appointmentId) return;
    const response = await appointmentAPI.completeAppointment(completeModal.appointmentId, notes || undefined);
    if (response.success) {
      loadData();
    }
  };

  const handleCancel = async () => {
    if (!cancelModal.appointmentId) return;
    const response = await appointmentAPI.cancelAppointment(cancelModal.appointmentId);
    if (response.success) {
      loadData();
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectModal.appointmentId) return;
    const response = await appointmentAPI.rejectAppointment(rejectModal.appointmentId, reason || undefined);
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
      if (cancelledBy === 'DOCTOR') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by you)</span>;
      } else if (cancelledBy === 'PATIENT') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by patient)</span>;
      } else if (cancelledBy === 'ADMIN') {
        return <span className="text-xs text-red-600 ml-2">(Cancelled by admin)</span>;
      }
    }
    if (appointment.status === 'REJECTED') {
      return <span className="text-xs text-orange-600 ml-2">(Rejected by you)</span>;
    }
    return null;
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'ALL') return true;
    return apt.status === filter;
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
            <h1 className="text-3xl font-bold text-gray-900">Manage Appointments</h1>
            <p className="text-gray-600 mt-2">View and manage all your appointments</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
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
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            Patient: {(appointment as any).patientName || appointment.patientEmail || 'Unknown'}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                          {getCancellationContext(appointment)}
                        </div>
                        <div className="space-y-2">
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
                              Booked on {new Date(appointment.createdAt || (appointment as any).created_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-6 flex flex-col space-y-2">
                        {appointment.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(appointment.id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal({ open: true, appointmentId: appointment.id })}
                              className="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 border border-orange-600 rounded-md hover:bg-orange-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {appointment.status === 'APPROVED' && (
                          <>
                            <button
                              onClick={() => setCompleteModal({ open: true, appointmentId: appointment.id })}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                            >
                              Mark Complete
                            </button>
                            <button
                              onClick={() => setCancelModal({ open: true, appointmentId: appointment.id })}
                              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-600 rounded-md hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </>
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
          onConfirm={handleCancel}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment? This action cannot be undone."
          confirmText="Cancel Appointment"
          variant="danger"
        />

        {/* Reject Modal with Reason */}
        <InputModal
          isOpen={rejectModal.open}
          onClose={() => setRejectModal({ open: false, appointmentId: null })}
          onSubmit={handleReject}
          title="Reject Appointment"
          message="Please provide a reason for rejecting this appointment (optional):"
          placeholder="Enter rejection reason..."
          submitText="Reject Appointment"
        />

        {/* Complete Modal with Notes */}
        <InputModal
          isOpen={completeModal.open}
          onClose={() => setCompleteModal({ open: false, appointmentId: null })}
          onSubmit={handleComplete}
          title="Complete Appointment"
          message="Add any notes for this appointment (optional):"
          placeholder="Enter completion notes..."
          submitText="Mark Complete"
        />
      </div>
    </NotificationProvider>
  );
}
