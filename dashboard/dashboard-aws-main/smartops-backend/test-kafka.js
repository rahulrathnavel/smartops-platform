const { startKafkaConsumer } = require('./src/collectors/kafka');
require('dotenv').config();

console.log('Starting Kafka Consumer Test...');
const mockIo = { emit: (name, data) => console.log(`[MOCK IO EMIT] ${name}:`, data) };
const broker = process.env.KAFKA_BROKER || 'localhost:9092';

startKafkaConsumer(mockIo, broker);
