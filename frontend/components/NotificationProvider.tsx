'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import type { Notification } from '@/lib/types';
import { notificationAPI } from '@/lib/api';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Helper to transform snake_case notification to camelCase
const transformNotification = (notification: any): Notification => {
  return {
    id: notification.id,
    userId: notification.user_id || notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    status: notification.status,
    read: notification.read,
    metadata: notification.metadata,
    createdAt: notification.created_at || notification.createdAt,
  };
};

export function NotificationProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await notificationAPI.getMyNotifications();
      if (response.success && response.data) {
        // Transform and deduplicate notifications
        const transformed = response.data.notifications.map(transformNotification);
        setNotifications(transformed);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Connect Socket.IO
    connectSocket(userId);
    const socket = getSocket();

    // Load initial notifications
    loadNotifications();

    // Listen for new notifications from socket
    const handleNewNotification = (rawNotification: any) => {
      const notification = transformNotification(rawNotification);
      
      setNotifications((prev) => {
        // Check if notification already exists to prevent duplicates
        const exists = prev.some((n) => n.id === notification.id);
        if (exists) {
          return prev;
        }
        return [notification, ...prev];
      });
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
      disconnectSocket();
    };
  }, [userId, loadNotifications]);

  const markAsRead = async (id: string) => {
    const response = await notificationAPI.markAsRead(id);
    if (response.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, status: 'READ' as any } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const response = await notificationAPI.markAllAsRead();
    if (response.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, status: 'READ' as any }))
      );
    }
  };

  const deleteNotification = async (id: string) => {
    const response = await notificationAPI.deleteNotification(id);
    if (response.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
