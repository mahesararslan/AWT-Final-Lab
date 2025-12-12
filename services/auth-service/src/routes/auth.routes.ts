import { Router, Request, Response, RequestHandler } from 'express';
import passport from 'passport';
import {
  register,
  login,
  logout,
  refresh,
  getCurrentUser,
  getDoctors,
  getAllUsers,
  getUserById
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { registerValidation, loginValidation } from '../middleware/validation.middleware';
import { authLimiter, registerLimiter } from '../middleware/rate-limit.middleware';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { pool, redis } from '../config/database';

const router = Router();

// Regular auth routes - cast to RequestHandler to avoid type conflicts with passport
router.post('/register', registerLimiter, registerValidation, register as RequestHandler);
router.post('/login', authLimiter, loginValidation, login as RequestHandler);
router.post('/logout', logout as RequestHandler);
router.post('/refresh', refresh as RequestHandler);
router.get('/me', authenticate as RequestHandler, getCurrentUser as RequestHandler);
router.get('/doctors', getDoctors as RequestHandler);
router.get('/users', authenticate as RequestHandler, getAllUsers as RequestHandler);
router.get('/users/:id', getUserById as RequestHandler);

// Google OAuth routes (for patients only)
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
}));

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3010'}/login?error=google_auth_failed`
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/login?error=no_user`);
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = generateRefreshToken({ userId: user.id });

      // Save refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await pool.query(
        'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [refreshToken, user.id, expiresAt]
      );

      // Cache user
      await redis.setex(`user:${user.id}`, 3600, JSON.stringify(user));

      // Set cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      // Redirect to patient dashboard
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/patient/dashboard`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/login?error=callback_failed`);
    }
  }
);

export default router;
