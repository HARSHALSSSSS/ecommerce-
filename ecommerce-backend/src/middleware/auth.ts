import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      admin?: JwtPayload;
      user?: JwtPayload;
    }
  }
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const decoded = verifyToken(token);

    if (decoded.type !== 'admin') {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const decoded = verifyToken(token);

    if (decoded.type !== 'user') {
      res.status(403).json({ success: false, message: 'User access required' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export function authenticateOptional(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      if (decoded.type === 'admin') {
        req.admin = decoded;
      } else if (decoded.type === 'user') {
        req.user = decoded;
      }
    }
  } catch (error) {
    // Continue without authentication
  }

  next();
}

/**
 * Middleware to require a specific admin role
 * Must be used after authenticateAdmin
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin || req.user;
    
    if (!admin) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!admin.role || !allowedRoles.includes(admin.role)) {
      res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
      return;
    }

    next();
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}
