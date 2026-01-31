import { Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { generateToken, hashPassword, comparePassword, generateResetToken } from '../utils/auth';
import { verifyHCaptcha, sendPasswordResetEmail } from '../utils/email';
import crypto from 'crypto';

// Rate limiting check
async function checkRateLimit(email: string, ip: string): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const db = getDatabase();
  const windowMinutes = 15;
  const maxAttempts = 5;

  // Count failed attempts in the last window
  const result = await db.get(`
    SELECT COUNT(*) as count FROM login_attempts 
    WHERE email = ? AND success = 0 
    AND created_at > datetime('now', '-${windowMinutes} minutes')
  `, [email]);

  const attempts = result?.count || 0;
  return {
    allowed: attempts < maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - attempts)
  };
}

// Log login attempt
async function logLoginAttempt(email: string, ip: string, success: boolean) {
  const db = getDatabase();
  await db.run(
    'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)',
    [email, ip, success ? 1 : 0]
  );
}

// Create session
async function createSession(adminId: number, token: string, req: Request): Promise<number> {
  const db = getDatabase();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ip = req.ip || req.socket.remoteAddress || 'Unknown';
  
  // Parse device info from user agent
  let deviceInfo = 'Unknown Device';
  if (userAgent.includes('Windows')) deviceInfo = 'Windows PC';
  else if (userAgent.includes('Mac')) deviceInfo = 'Mac';
  else if (userAgent.includes('iPhone')) deviceInfo = 'iPhone';
  else if (userAgent.includes('Android')) deviceInfo = 'Android';
  else if (userAgent.includes('Linux')) deviceInfo = 'Linux';

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.run(`
    INSERT INTO admin_sessions (admin_id, token_hash, ip_address, user_agent, device_info, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [adminId, tokenHash, ip, userAgent, deviceInfo, expiresAt]);

  return result.lastID || 0;
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, captchaToken } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'Unknown';

    // Validate input
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(email, ip);
    if (!rateLimit.allowed) {
      res.status(429).json({ 
        success: false, 
        message: 'Too many login attempts. Please try again in 15 minutes.' 
      });
      return;
    }

    // Verify CAPTCHA
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
      return;
    }

    // Get admin from database
    const db = getDatabase();
    const admin = await db.get('SELECT * FROM admins WHERE email = ?', [email]);

    if (!admin) {
      await logLoginAttempt(email, ip, false);
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password',
        remainingAttempts: rateLimit.remainingAttempts - 1
      });
      return;
    }

    if (!admin.is_active) {
      await logLoginAttempt(email, ip, false);
      res.status(403).json({ success: false, message: 'Account is inactive' });
      return;
    }

    // Compare password
    const passwordMatch = await comparePassword(password, admin.password);
    if (!passwordMatch) {
      await logLoginAttempt(email, ip, false);
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password',
        remainingAttempts: rateLimit.remainingAttempts - 1
      });
      return;
    }

    // Log successful attempt
    await logLoginAttempt(email, ip, true);

    // Update last login
    await db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

    // Generate token
    const token = generateToken(
      { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
      '7d'
    );

    // Create session
    const sessionId = await createSession(admin.id, token, req);

    // Get admin permissions
    const permissions = await db.all(`
      SELECT DISTINCT p.name, p.module, p.action FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN admin_roles ar ON rp.role_id = ar.role_id
      WHERE ar.admin_id = ?
    `, [admin.id]);

    // Get admin roles
    const roles = await db.all(`
      SELECT r.name, r.display_name FROM roles r
      JOIN admin_roles ar ON r.id = ar.role_id
      WHERE ar.admin_id = ?
    `, [admin.id]);

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [admin.id, 'login', 'auth', ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      sessionId,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        roles: roles,
        permissions: permissions.map(p => p.name),
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function adminForgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email, captchaToken } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email required' });
      return;
    }

    // Verify CAPTCHA
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
      return;
    }

    // Check if admin exists
    const db = getDatabase();
    const admin = await db.get('SELECT id, email FROM admins WHERE email = ?', [email]);

    if (!admin) {
      // Don't reveal if email exists or not (security best practice)
      res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent',
      });
      return;
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await db.run(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [email, resetToken, expiresAt.toISOString()]
    );

    // Send reset email
    const resetLink = `${process.env.ADMIN_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetLink);

    res.json({
      success: true,
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function adminResetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, message: 'All fields required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const db = getDatabase();

    // Verify reset token
    const resetRecord = await db.get(
      'SELECT * FROM password_resets WHERE token = ? AND is_used = 0 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (!resetRecord) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update admin password
    await db.run('UPDATE admins SET password = ? WHERE email = ?', [
      hashedPassword,
      resetRecord.email,
    ]);

    // Mark token as used
    await db.run('UPDATE password_resets SET is_used = 1 WHERE id = ?', [resetRecord.id]);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function adminLogout(req: Request, res: Response): Promise<void> {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'No admin authenticated' });
      return;
    }

    const db = getDatabase();
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await db.run('UPDATE admin_sessions SET is_active = 0 WHERE token_hash = ?', [tokenHash]);
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, ip_address) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'logout', 'auth', req.ip]
    );

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function adminVerifyToken(req: Request, res: Response): Promise<void> {
  try {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'No admin authenticated' });
      return;
    }

    // Get fresh admin data
    const db = getDatabase();
    const admin = await db.get('SELECT id, email, name, role, is_active FROM admins WHERE id = ?', [
      req.admin.id,
    ]);

    if (!admin || !admin.is_active) {
      res.status(401).json({ success: false, message: 'Admin not found or inactive' });
      return;
    }

    // Update session last activity
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await db.run(
        'UPDATE admin_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token_hash = ? AND is_active = 1',
        [tokenHash]
      );
    }

    // Get admin permissions
    const permissions = await db.all(`
      SELECT DISTINCT p.name FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN admin_roles ar ON rp.role_id = ar.role_id
      WHERE ar.admin_id = ?
    `, [admin.id]);

    // Get admin roles
    const roles = await db.all(`
      SELECT r.name, r.display_name FROM roles r
      JOIN admin_roles ar ON r.id = ar.role_id
      WHERE ar.admin_id = ?
    `, [admin.id]);

    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        roles: roles,
        permissions: permissions.map(p => p.name),
      },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ============ USER AUTHENTICATION (for mobile app) ============

export async function userRegister(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email and password required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const db = getDatabase();

    // Check if email already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db.run(
      'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, phone || null]
    );

    // Generate token
    const userId = result.lastID as number;
    const token = generateToken(
      { id: userId, email, role: 'user', type: 'user' },
      '30d'
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: userId,
        name,
        email,
        phone: phone || null,
      },
    });
  } catch (error) {
    console.error('User register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function userLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }

    const db = getDatabase();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, message: 'Account is inactive' });
      return;
    }

    // Compare password
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken(
      { id: user.id, email: user.email, role: 'user', type: 'user' },
      '30d'
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
      },
    });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function userProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const db = getDatabase();
    const user = await db.get(
      'SELECT id, name, email, phone, address, city, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function userUpdateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, phone, address, city } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE users SET 
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, phone, address, city, req.user.id]
    );

    const user = await db.get(
      'SELECT id, name, email, phone, address, city FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
