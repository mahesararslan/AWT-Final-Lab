import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

// Utility to coerce env values into the exact expiresIn type
const resolveExpiresIn = (value: string | undefined, fallback: SignOptions['expiresIn']): SignOptions['expiresIn'] =>
  (value ?? fallback) as SignOptions['expiresIn'];

export const generateAccessToken = (payload: { userId: string; email: string; role: string }): string => {
  const expiresIn = resolveExpiresIn(process.env.JWT_EXPIRES_IN, '7d');
  return jwt.sign(payload, process.env.JWT_SECRET as Secret, { expiresIn });
};

export const generateRefreshToken = (payload: { userId: string }): string => {
  const expiresIn = resolveExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '30d');
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as Secret, { expiresIn });
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as Secret) as { userId: string };
};
