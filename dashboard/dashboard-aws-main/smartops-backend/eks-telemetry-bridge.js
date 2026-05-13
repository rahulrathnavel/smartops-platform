const { spawn } = require('child_process');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'eks-log-bridge',
  brokers: ['localhost:29092']
});

const producer = kafka.producer();

async function startBridge() {
  await producer.connect();
  console.log('[BRIDGE] Connected to Kafka. Tailing EKS logs (v2)...');

  // Specifically tail the CURRENT active pods
  const kubectl = spawn('kubectl', ['logs', '-l', 'app=aurcc-backend', '-f', '--tail', '0', '--prefix']);

  kubectl.stdout.on('data', async (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.includes('POST /api/login') && line.includes(' 200 ')) {
        const parts = line.split('|').map(p => p.trim());
        const timestamp = parts[0].replace(/^\[.*?\]\s*/, ''); // Strip prefix if exists
        const regNoMatch = line.match(/regNo=([^ ]+)/);
        const registrationNo = regNoMatch ? regNoMatch[1] : 'UNKNOWN';

        const event = {
          timestamp: new Date().getTime(), // Use current time for better dash sync
          registrationNo,
          department: 'EKS-HOSTED',
          status: 'SUCCESS',
          source: 'AWS-EKS-LOGS'
        };

        await producer.send({
          topic: 'login-events',
          messages: [{ value: JSON.stringify(event) }]
        });
        console.log('[BRIDGE] Dispatched Login Event from EKS:', registrationNo);
      }
    }
  });

  kubectl.stderr.on('data', (data) => {
    if (!data.toString().includes('dial tcp')) { // Ignore temporary dial errors
       console.error(`[KUBECTL ERROR] ${data}`);
    }
  });
}

startBridge().catch(console.error);
