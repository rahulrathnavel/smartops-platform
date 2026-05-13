const { Kafka } = require('kafkajs');

async function produceTest() {
  const kafka = new Kafka({
    clientId: 'test-producer',
    brokers: ['localhost:29092']
  });

  const producer = kafka.producer();
  await producer.connect();
  console.log('Producer connected');

  const payload = {
    timestamp: Date.now(),
    registrationNo: 'TEST' + Math.floor(Math.random() * 1000),
    department: 'AIDS',
    status: 'SUCCESS',
    ip: '127.0.0.1'
  };

  await producer.send({
    topic: 'login-events',
    messages: [{ value: JSON.stringify(payload) }]
  });

  console.log('Message sent:', payload);
  await producer.disconnect();
}

produceTest().catch(console.error);
