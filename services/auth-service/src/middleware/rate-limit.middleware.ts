import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/database';

// Create Redis store with error handling
const createRedisStore = () => {
  try {
    return new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: 'rl:',
    });
  } catch (error) {
    console.error('Redis store creation failed, using memory store:', error);
    return undefined; // Falls back to memory store
  }
};

// General API rate limiter
export const apiLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

// Strict rate limiter for auth endpoints (login)
export const authLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Only count failed login attempts
  skipFailedRequests: false,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

// Registration rate limiter
export const registerLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 registration attempts per hour
  skipSuccessfulRequests: true, // Don't count successful registrations
  skipFailedRequests: false,
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again in 1 hour.',
    });
  },
});
