import axios, { AxiosError } from 'axios';
import { AuthResponse, ApiResponse, User, Appointment, CreateAppointmentData, Notification } from './types';

const AUTH_SERVICE = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3001';
const APPOINTMENT_SERVICE = process.env.NEXT_PUBLIC_APPOINTMENT_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3003';

// Create axios instance with default config
const axiosInstance = axios.create({
  withCredentials: true, // Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to handle API calls with axios
async function fetchAPI<T>(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: any
): Promise<ApiResponse<T>> {
  try {
    const response = await axiosInstance({
      url,
      method,
      data,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      return {
        success: false,
        message: axiosError.response?.data?.message || 'An error occurred',
        error: axiosError.response?.data?.error || axiosError.message,
      };
    }
    return {
      success: false,
      message: 'Network error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Auth API
export const authAPI = {
  register: async (email: string, password: string, firstName: string, lastName: string, role: string, phone: string, specialization?: string) => {
    return fetchAPI<{ user: User }>(`${AUTH_SERVICE}/api/auth/register`, 'POST', { 
      email, password, firstName, lastName, role, phone, specialization 
    });
  },

  login: async (email: string, password: string) => {
    return fetchAPI<{ user: User }>(`${AUTH_SERVICE}/api/auth/login`, 'POST', { 
      email, password 
    });
  },

  logout: async () => {
    return fetchAPI(`${AUTH_SERVICE}/api/auth/logout`, 'POST');
  },

  getProfile: async () => {
    return fetchAPI<{ user: User }>(`${AUTH_SERVICE}/api/auth/me`, 'GET');
  },

  refreshToken: async () => {
    return fetchAPI(`${AUTH_SERVICE}/api/auth/refresh`, 'POST');
  },

  getAllUsers: async () => {
    return fetchAPI<{ users: User[] }>(`${AUTH_SERVICE}/api/auth/users`, 'GET');
  },

  getDoctors: async () => {
    return fetchAPI<{ doctors: User[] }>(`${AUTH_SERVICE}/api/auth/doctors`, 'GET');
  },
};

// Appointment API
export const appointmentAPI = {
  createAppointment: async (data: CreateAppointmentData) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments`, 'POST', data);
  },

  getMyAppointments: async () => {
    return fetchAPI<{ appointments: Appointment[] }>(`${APPOINTMENT_SERVICE}/api/appointments/my`, 'GET');
  },

  getAppointmentById: async (id: string) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments/${id}`, 'GET');
  },

  approveAppointment: async (id: string) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments/${id}/approve`, 'PATCH');
  },

  completeAppointment: async (id: string, notes?: string) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments/${id}/complete`, 'PATCH', { notes });
  },

  cancelAppointment: async (id: string) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments/${id}/cancel`, 'PATCH');
  },

  rejectAppointment: async (id: string, reason?: string) => {
    return fetchAPI<{ appointment: Appointment }>(`${APPOINTMENT_SERVICE}/api/appointments/${id}/reject`, 'PATCH', { reason });
  },

  getAllAppointments: async () => {
    return fetchAPI<{ appointments: Appointment[] }>(`${APPOINTMENT_SERVICE}/api/appointments`, 'GET');
  },
};

// Notification API
export const notificationAPI = {
  getMyNotifications: async () => {
    return fetchAPI<{ notifications: Notification[] }>(`${NOTIFICATION_SERVICE}/api/notifications/my`, 'GET');
  },

  markAsRead: async (id: string) => {
    return fetchAPI(`${NOTIFICATION_SERVICE}/api/notifications/${id}/read`, 'PATCH');
  },

  markAllAsRead: async () => {
    return fetchAPI(`${NOTIFICATION_SERVICE}/api/notifications/read-all`, 'PATCH');
  },

  deleteNotification: async (id: string) => {
    return fetchAPI(`${NOTIFICATION_SERVICE}/api/notifications/${id}`, 'DELETE');
  },
};
