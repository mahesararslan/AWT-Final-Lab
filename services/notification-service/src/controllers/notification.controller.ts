import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { pool, redis } from '../config/database';

// Helper to transform notification from snake_case to camelCase
const transformNotification = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  status: row.status,
  read: row.read,
  metadata: row.metadata,
  sentAt: row.sent_at,
  createdAt: row.created_at,
});

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.userId;
    const { limit = '50', offset = '0' } = req.query;

    // Try cache first
    const cacheKey = `notifications:${userId}:${limit}:${offset}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    );

    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );

    // Transform notifications to camelCase
    const notifications = result.rows.map(transformNotification);

    const data = {
      notifications,
      total: parseInt(countResult.rows[0].count),
      unread: parseInt(unreadResult.rows[0].count)
    };

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(data));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Invalidate cache (DEL doesn't support wildcards, use KEYS first)
    const keys = await redis.keys(`notifications:${req.user.userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: transformNotification(result.rows[0]) }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read'
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [req.user.userId]
    );

    // Invalidate cache
    const keys = await redis.keys(`notifications:${req.user.userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read'
    });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Invalidate cache
    const keys = await redis.keys(`notifications:${req.user.userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
};
