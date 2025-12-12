-- Run this in pgAdmin Query Tool (connect to postgres database first)
-- Copy and paste these commands one by one, or run all together

-- 1. Create auth database
CREATE DATABASE auth_db;

-- 2. Create appointment database  
CREATE DATABASE appointment_db;

-- 3. Create notification database
CREATE DATABASE notification_db;

-- 4. Verify databases were created
SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;
