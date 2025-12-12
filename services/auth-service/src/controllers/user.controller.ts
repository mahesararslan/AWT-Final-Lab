import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { pool, redis } from '../config/database';

export const getAllDoctors = async (req: AuthRequest, res: Response) => {
  try {
    // Try to get from cache first
    const cached = await redis.get('doctors:all');
    if (cached) {
      return res.json({
        success: true,
        data: { doctors: JSON.parse(cached) },
        cached: true
      });
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, specialization, created_at
       FROM users WHERE role = 'DOCTOR'
       ORDER BY first_name, last_name`
    );

    const doctors = result.rows;

    // Cache for 5 minutes
    await redis.setex('doctors:all', 300, JSON.stringify(doctors));

    res.json({
      success: true,
      data: { doctors }
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctors'
    });
  }
};

export const getDoctorById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cached = await redis.get(`doctor:${id}`);
    if (cached) {
      return res.json({
        success: true,
        data: { doctor: JSON.parse(cached) },
        cached: true
      });
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, specialization, created_at
       FROM users WHERE id = $1 AND role = 'DOCTOR'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const doctor = result.rows[0];

    // Cache for 5 minutes
    await redis.setex(`doctor:${id}`, 300, JSON.stringify(doctor));

    res.json({
      success: true,
      data: { doctor }
    });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctor'
    });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cached = await redis.get(`user:${id}`);
    if (cached) {
      return res.json({
        success: true,
        data: { user: JSON.parse(cached) },
        cached: true
      });
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, phone, specialization, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Cache for 5 minutes
    await redis.setex(`user:${id}`, 300, JSON.stringify(user));

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};
