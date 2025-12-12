import { Kafka, Producer, Consumer, Admin } from 'kafkajs';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'appointment-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

export const producer: Producer = kafka.producer();
export const consumer: Consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'appointment-group'
});

const admin: Admin = kafka.admin();

// Event types
export enum EventType {
  APPOINTMENT_CREATED = 'appointment.created',
  APPOINTMENT_APPROVED = 'appointment.approved',
  APPOINTMENT_CANCELLED = 'appointment.cancelled',
  APPOINTMENT_REJECTED = 'appointment.rejected',
  APPOINTMENT_COMPLETED = 'appointment.completed',
}

// Topic configuration
const APPOINTMENT_TOPIC = 'appointment-events';

// Ensure topic exists
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
  } catch (error) {
    console.error('❌ Error ensuring topic exists:', error);
    // Continue anyway - topic might be auto-created
  }
};

// Connect producer
export const connectProducer = async () => {
  try {
    await ensureTopicExists();
    await producer.connect();
    console.log('✅ Kafka Producer connected');
  } catch (error) {
    console.error('❌ Kafka Producer connection error:', error);
    // Don't exit - allow service to run without Kafka
  }
};

// Publish event to Kafka
export const publishEvent = async (topic: string, event: any) => {
  try {
    await producer.send({
      topic,
      messages: [
        {
          key: event.appointmentId || event.id,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.type,
            'timestamp': Date.now().toString()
          }
        }
      ]
    });
    console.log(`📤 Published event to ${topic}:`, event.type);
  } catch (error) {
    console.error('❌ Error publishing event:', error);
    throw error;
  }
};

// Graceful shutdown
export const disconnectKafka = async () => {
  try {
    await producer.disconnect();
    console.log('👋 Kafka Producer disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Kafka:', error);
  }
};

process.on('SIGTERM', disconnectKafka);
process.on('SIGINT', disconnectKafka);

export default kafka;
