import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import {
  adminLogin,
  adminLogout,
  adminForgotPassword,
  adminResetPassword,
  adminVerifyToken,
  userRegister,
  userLogin,
  userProfile,
  userUpdateProfile,
} from '../controllers/authController';

const router = Router();

// Admin routes
router.post('/admin/login', adminLogin);
router.post('/admin/logout', authenticateAdmin, adminLogout);
router.post('/admin/forgot-password', adminForgotPassword);
router.post('/admin/reset-password', adminResetPassword);
router.get('/admin/verify-token', authenticateAdmin, adminVerifyToken);

// User routes (for mobile app)
router.post('/user/register', userRegister);
router.post('/user/login', userLogin);
router.get('/user/profile', authenticateUser, userProfile);
router.put('/user/profile', authenticateUser, userUpdateProfile);

export default router;
