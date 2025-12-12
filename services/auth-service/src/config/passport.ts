import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import { pool, redis } from './database';

// Load environment variables
dotenv.config();

// Google OAuth Strategy - Only for Patients
// Only initialize if Google credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || '';
        const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        // Check if user exists
        const existingUser = await pool.query(
          'SELECT * FROM users WHERE email = $1 OR google_id = $2',
          [email, googleId]
        );

        let user;

        if (existingUser.rows.length > 0) {
          user = existingUser.rows[0];

          // If user exists but doesn't have google_id, link it
          if (!user.google_id) {
            await pool.query(
              'UPDATE users SET google_id = $1 WHERE id = $2',
              [googleId, user.id]
            );
            user.google_id = googleId;
          }

          // Check if user is a patient (Google OAuth is only for patients)
          if (user.role !== 'PATIENT') {
            return done(new Error('Google sign-in is only available for patients. Please use email/password login.'), undefined);
          }
        } else {
          // Create new patient user
          const result = await pool.query(
            `INSERT INTO users (email, first_name, last_name, role, google_id, password)
             VALUES ($1, $2, $3, 'PATIENT', $4, '')
             RETURNING id, email, first_name, last_name, role, phone, specialization, google_id, created_at, updated_at`,
            [email, firstName, lastName, googleId]
          );
          user = result.rows[0];

          // Invalidate any relevant caches
          await redis.del('users:all');
        }

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error as Error, undefined);
      }
    }
  )
  );
  console.log('✅ Google OAuth strategy initialized');
} else {
  console.log('⚠️ Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

export default passport;

