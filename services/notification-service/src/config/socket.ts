import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { redisSub, redisPub } from './database';

export let io: SocketIOServer;

export const initializeSocketIO = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('accessToken=')[1]?.split(';')[0];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
        role: string;
      };

      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    console.log(`✅ User connected: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Send unread notification count on connection
    socket.emit('connected', {
      message: 'Connected to notification service',
      userId
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${userId}`);
    });

    socket.on('mark_read', async (data) => {
      console.log('Mark read event:', data);
    });
  });

  // Subscribe to Redis pub/sub for notifications
  redisSub.subscribe('notifications', (err) => {
    if (err) {
      console.error('❌ Redis subscribe error:', err);
    } else {
      console.log('📡 Subscribed to notifications channel');
    }
  });

  redisSub.on('message', (channel, message) => {
    if (channel === 'notifications') {
      try {
        const notification = JSON.parse(message);
        // Support both user_id (snake_case) and userId (camelCase)
        const targetUserId = notification.userId || notification.user_id;
        // Send notification to specific user
        io.to(`user:${targetUserId}`).emit('notification', notification);
        console.log(`📨 Sent notification to user ${targetUserId}`);
      } catch (error) {
        console.error('❌ Error broadcasting notification:', error);
      }
    }
  });

  return io;
};

// Helper to publish notification via Redis
export const publishNotification = async (notification: any) => {
  try {
    await redisPub.publish('notifications', JSON.stringify(notification));
  } catch (error) {
    console.error('❌ Error publishing notification:', error);
  }
};
