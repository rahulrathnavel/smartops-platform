require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const { DynamoDBClient }       = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { initWebSocket }  = require('./websocket');
const { startAggregation } = require('./aggregator');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'dashboard-backend' })
);

// ---------------------------------------------------------------------------
// REST: incident history from DynamoDB smartops-incidents table
// ---------------------------------------------------------------------------
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' })
);

app.get('/api/incidents/history', async (_req, res) => {
  try {
    const result = await dynamo.send(new ScanCommand({
      TableName: 'smartops-incidents',
      Limit: 200,
    }));
    const events = (result.Items || []).sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || '')
    );
    res.json({ events, count: events.length });
  } catch (err) {
    console.error('[HISTORY] DynamoDB scan failed:', err.message);
    res.status(500).json({ error: err.message, events: [] });
  }
});

// ---------------------------------------------------------------------------
// REST: current active incidents proxied from SmartOps Agent
// ---------------------------------------------------------------------------
const AGENT_URL = process.env.AGENT_URL ||
  'http://smartops-agent.smartops-system.svc.cluster.local:3000';

app.get('/api/incidents/active', async (_req, res) => {
  try {
    const node_fetch = require('node-fetch');
    const r = await node_fetch(`${AGENT_URL}/incidents`, { timeout: 3000 });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message, incidents: [] });
  }
});

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[SMARTOPS BACKEND] Listening on port ${PORT}`);
  startAggregation();
});
