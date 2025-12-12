import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/database';

// Create Redis store with error handling
const createRedisStore = (prefix: string) => {
  try {
    return new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: prefix,
    });
  } catch (error) {
    console.error('Redis store creation failed, using memory store:', error);
    return undefined; // Falls back to memory store
  }
};

// General API rate limiter
export const apiLimiter = rateLimit({
  store: createRedisStore('rl:apt:api:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  skip: (req) => req.method === 'POST' && req.path === '/', // Skip for appointment creation (has its own limiter)
});

// Appointment creation rate limiter
export const appointmentLimiter = rateLimit({
  store: createRedisStore('rl:apt:create:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Max 50 appointments per hour (generous for testing)
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: 'Too many appointment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many appointment requests. Please try again in 1 hour.',
    });
  },
});
