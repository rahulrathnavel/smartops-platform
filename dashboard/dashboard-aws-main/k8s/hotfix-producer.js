const { Kafka } = require("kafkajs");
const kafka = new Kafka({ clientId: "aurcc-producer", brokers: [process.env.KAFKA_BROKER || "kafka.kafka.svc.cluster.local:9092"] });
const producer = kafka.producer();
let connected = false;

const connect = async () => {
  if (connected) return;
  try { await producer.connect(); connected = true; console.log("[KAFKA] Producer connected"); }
  catch (e) { console.error("[KAFKA] Connection failed", e); }
};

const send = async (topic, message) => {
  await connect();
  try {
    await producer.send({ topic, messages: [{ value: JSON.stringify(message) }] });
    console.log("[2y1hvb] [KAFKA LOGIN EVENT SENT]");
  } catch (e) { console.error("[KAFKA] Send failed", e); }
};

module.exports = { send };
