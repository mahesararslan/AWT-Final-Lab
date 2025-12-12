import { Kafka, Consumer, Admin } from 'kafkajs';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

export const consumer: Consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-group'
});

const admin: Admin = kafka.admin();

// Topic configuration
const APPOINTMENT_TOPIC = 'appointment-events';

// Ensure topic exists before subscribing
const ensureTopicExists = async () => {
  try {
    await admin.connect();
    
    // Check if topic exists
    const topics = await admin.listTopics();
    
    if (!topics.includes(APPOINTMENT_TOPIC)) {
      console.log(`📝 Creating topic: ${APPOINTMENT_TOPIC}...`);
      await admin.createTopics({
        topics: [
          {
            topic: APPOINTMENT_TOPIC,
            numPartitions: 3,
            replicationFactor: 1,
          }
        ],
      });
      console.log(`✅ Topic created: ${APPOINTMENT_TOPIC}`);
    } else {
      console.log(`✅ Topic already exists: ${APPOINTMENT_TOPIC}`);
    }
    
    await admin.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Error ensuring topic exists:', error);
    // Return false but continue - topic might be auto-created
    return false;
  }
};

export const connectConsumer = async () => {
  try {
    await ensureTopicExists();
    await consumer.connect();
    console.log('✅ Kafka Consumer connected');
    
    await consumer.subscribe({
      topic: APPOINTMENT_TOPIC,
      fromBeginning: false
    });
    
    console.log(`📥 Subscribed to ${APPOINTMENT_TOPIC} topic`);
  } catch (error) {
    console.error('❌ Kafka Consumer connection error:', error);
    throw error; // Re-throw to handle retry in server.ts
  }
};

export const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
    console.log('👋 Kafka Consumer disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Kafka:', error);
  }
};

process.on('SIGTERM', disconnectConsumer);
process.on('SIGINT', disconnectConsumer);

export default kafka;
