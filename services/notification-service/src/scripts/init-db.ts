import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { pool } from '../config/database';

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔨 Creating database tables...');

    // Create enum types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM ('EMAIL', 'SMS', 'IN_APP');
        CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type notification_type DEFAULT 'IN_APP',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status notification_status DEFAULT 'PENDING',
        read BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
    `);

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('✅ Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}

export default createTables;
