import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  type: 'admin' | 'user';
}

// Generate JWT Token
export function generateToken(payload: JwtPayload, expiresIn: string = JWT_EXPIRE): string {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload as object, JWT_SECRET, options);
}

// Verify JWT Token
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Hash Password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare Password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate Reset Token
export function generateResetToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
