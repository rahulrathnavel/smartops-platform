const express = require('express');
const cors = require('cors');
const { telemetryMiddleware, getMetrics, activeSessions } = require('./middleware/telemetry');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(telemetryMiddleware);

app.get('/metrics', getMetrics);
app.use('/api', authRoutes);

app.get('/api/results', (req, res) => {
  // Mock results endpoint for load testing
  res.json({ results: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[RESULT PORTAL] Listening on port ${PORT}`);
});
