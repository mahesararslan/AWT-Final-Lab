// User types
export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  specialization?: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
  };
}

// Appointment types
export enum AppointmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  cancelledBy?: string; // 'PATIENT' | 'DOCTOR' | 'ADMIN'
  cancelledById?: string; // user ID who cancelled
  createdAt: string;
  updatedAt: string;
  patientEmail?: string;
  doctorEmail?: string;
  doctorSpecialization?: string;
}

export interface CreateAppointmentData {
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
}

// Notification types
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

export enum NotificationType {
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_APPROVED = 'APPOINTMENT_APPROVED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_REJECTED = 'APPOINTMENT_REJECTED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',
  SYSTEM = 'SYSTEM',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  status: NotificationStatus | string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
