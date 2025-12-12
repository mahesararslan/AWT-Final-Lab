'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { NotificationProvider } from '@/components/NotificationProvider';
import Modal, { ConfirmModal } from '@/components/Modal';
import { authAPI, appointmentAPI } from '@/lib/api';
import { User, CreateAppointmentData } from '@/lib/types';

export default function BookAppointmentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [formData, setFormData] = useState<CreateAppointmentData>({
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get user profile
      const profileRes = await authAPI.getProfile();
      if (profileRes.success && profileRes.data?.user) {
        setUser(profileRes.data.user);
      } else {
        router.push('/login');
        return;
      }

      // Get doctors list
      const doctorsRes = await authAPI.getDoctors();
      if (doctorsRes.success && doctorsRes.data) {
        setDoctors(doctorsRes.data.doctors);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!formData.doctorId || !formData.appointmentDate || !formData.appointmentTime || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (formData.reason.length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)');
      return;
    }
    
    // Show confirmation modal
    setConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await appointmentAPI.createAppointment(formData);

      if (response.success) {
        setSuccessModal(true);
        setFormData({
          doctorId: '',
          appointmentDate: '',
          appointmentTime: '',
          reason: '',
        });
      } else {
        setError(response.message || 'Failed to book appointment');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedDoctorDetails = () => {
    const doctor = doctors.find((d: any) => d.id === formData.doctorId) as any;
    if (!doctor) return null;
    return `Dr. ${doctor.first_name} ${doctor.last_name} (${doctor.specialization})`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <NotificationProvider userId={user.id}>
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={user.email} userRole={user.role} />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Book Appointment</h1>
            <p className="text-gray-600 mt-2">Schedule an appointment with a doctor</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div>
                <label htmlFor="doctor" className="block text-sm font-medium text-gray-700">
                  Select Doctor *
                </label>
                <select
                  id="doctor"
                  required
                  value={formData.doctorId}
                  onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose a doctor</option>
                  {doctors.map((doctor: any) => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.first_name} {doctor.last_name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Appointment Date *
                </label>
                <input
                  id="date"
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                  Appointment Time *
                </label>
                <select
                  id="time"
                  required
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose a time</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                  <option value="17:00">05:00 PM</option>
                </select>
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                  Reason * <span className="text-gray-400 text-xs">(min. 10 characters)</span>
                </label>
                <textarea
                  id="reason"
                  required
                  rows={4}
                  minLength={10}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Describe your symptoms or reason for consultation (at least 10 characters)"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {formData.reason.length}/10 characters minimum
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Booking...' : 'Book Appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/patient/dashboard')}
                  className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Confirmation Modal */}
        <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Appointment">
          <div className="space-y-4">
            <p className="text-gray-600">Please review your appointment details:</p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium text-gray-700">Doctor:</span>{' '}
                <span className="text-gray-900">{getSelectedDoctorDetails()}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">{formatDate(formData.appointmentDate)}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Time:</span>{' '}
                <span className="text-gray-900">{formatTime(formData.appointmentTime)}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Reason:</span>{' '}
                <span className="text-gray-900">{formData.reason}</span>
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setConfirmModal(false);
                  handleConfirmBooking();
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Success Modal */}
        <Modal isOpen={successModal} onClose={() => {}} title="🎉 Appointment Booked!">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600">
              Your appointment has been successfully booked and is pending approval from the doctor.
            </p>
            <button
              onClick={() => router.push('/patient/appointments')}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              View My Appointments
            </button>
          </div>
        </Modal>
      </div>
    </NotificationProvider>
  );
}
