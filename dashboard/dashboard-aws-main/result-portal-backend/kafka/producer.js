const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'result-portal',
  brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
});

const producer = kafka.producer();

async function connectProducer() {
  try {
    await producer.connect();
    console.log('[KAFKA] Producer connected successfully');
  } catch (error) {
    console.error('[KAFKA] Error connecting producer', error);
  }
}

async function emitEvent(topic, payload) {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    console.log(`[KAFKA SENT] ${topic}`);
  } catch (error) {
    console.error(`[KAFKA ERROR] Failed to send to ${topic}`, error);
  }
}

connectProducer();

module.exports = {
  emitEvent,
};
