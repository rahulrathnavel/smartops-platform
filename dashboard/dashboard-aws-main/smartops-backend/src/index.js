require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initWebSocket } = require('./websocket');
const { startAggregation } = require('./aggregator');

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'dashboard-backend' }));

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`[SMARTOPS BACKEND] Listening on port ${PORT}`);
  startAggregation();
});
