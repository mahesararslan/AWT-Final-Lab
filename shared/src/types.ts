// User roles
export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN'
}

// Appointment status
export enum AppointmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

// Notification types
export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP'
}

// Event types
export enum EventType {
  APPOINTMENT_CREATED = 'appointment.created',
  APPOINTMENT_APPROVED = 'appointment.approved',
  APPOINTMENT_CANCELLED = 'appointment.cancelled',
  APPOINTMENT_COMPLETED = 'appointment.completed',
  USER_REGISTERED = 'user.registered'
}

// User interface
export interface User {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  specialization?: string; // For doctors
  createdAt: Date;
  updatedAt: Date;
}

// Appointment interface
export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: Date;
  time: string;
  reason: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  sentAt?: Date;
  createdAt: Date;
}

// Event payload interfaces
export interface AppointmentCreatedEvent {
  type: EventType.APPOINTMENT_CREATED;
  data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    date: Date;
    time: string;
    patientEmail: string;
    doctorEmail: string;
    patientName: string;
    doctorName: string;
  };
}

export interface AppointmentApprovedEvent {
  type: EventType.APPOINTMENT_APPROVED;
  data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    date: Date;
    time: string;
    patientEmail: string;
    doctorEmail: string;
  };
}

export interface AppointmentCancelledEvent {
  type: EventType.APPOINTMENT_CANCELLED;
  data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    cancelledBy: string;
    reason?: string;
    patientEmail: string;
    doctorEmail: string;
  };
}

export interface UserRegisteredEvent {
  type: EventType.USER_REGISTERED;
  data: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

export type AppointmentEvent = 
  | AppointmentCreatedEvent 
  | AppointmentApprovedEvent 
  | AppointmentCancelledEvent;

// JWT payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
