import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import notificationRoutes from './routes/notification.routes';
import { initializeSocketIO } from './config/socket';
import { connectConsumer } from './config/kafka';
import { startKafkaConsumer } from './services/event-handler';

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3010',
    'http://localhost:3000',
    'http://localhost:3010'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.use('/api/notifications', notificationRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Initialize Socket.IO
initializeSocketIO(httpServer);

// Connect Kafka Consumer and start listening
const initializeKafka = async () => {
  try {
    await connectConsumer();
    await startKafkaConsumer();
  } catch (error) {
    console.error('❌ Failed to initialize Kafka:', error);
    console.log('⏳ Retrying Kafka connection in 10 seconds...');
    
    // Retry after 10 seconds
    setTimeout(async () => {
      try {
        await connectConsumer();
        await startKafkaConsumer();
        console.log('✅ Kafka connected on retry');
      } catch (retryError) {
        console.error('❌ Kafka retry failed. Service will continue without Kafka.');
        console.log('💡 Please ensure Kafka is running and topic "appointment-events" exists');
      }
    }, 10000);
  }
};

initializeKafka();

httpServer.listen(PORT, () => {
  console.log(`🚀 Notification Service running on port ${PORT}`);
  console.log(`🔌 Socket.IO server initialized`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

export default app;
