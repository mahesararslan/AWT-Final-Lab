import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import appointmentRoutes from './routes/appointment.routes';
import { connectProducer } from './config/kafka';
import { apiLimiter } from './middleware/rate-limit.middleware';

const app: Application = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3010',
    'http://localhost:3000',
    'http://localhost:3010',
    process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply rate limiting
app.use(apiLimiter);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'appointment-service' });
});

app.use('/api/appointments', appointmentRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Connect Kafka Producer
connectProducer().catch(console.error);

app.listen(PORT, () => {
  console.log(`🚀 Appointment Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

export default app;
