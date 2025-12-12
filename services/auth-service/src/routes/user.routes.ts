import { Router, RequestHandler } from 'express';
import { getAllDoctors, getDoctorById, getUserById } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/doctors', authenticate as RequestHandler, getAllDoctors as RequestHandler);
router.get('/doctors/:id', authenticate as RequestHandler, getDoctorById as RequestHandler);
router.get('/:id', authenticate as RequestHandler, getUserById as RequestHandler);

export default router;
