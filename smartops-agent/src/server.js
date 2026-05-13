'use strict';

const express = require('express');
const { config } = require('./config');

// ---------------------------------------------------------------------------
// Express HTTP server.
// Approval is via clickable HTTP links (GET /approve/:id/:token) rather than
// Slack interactive buttons, which require HTTPS and a configured webhook URL.
// ---------------------------------------------------------------------------

function createServer({ interactionHandler, webhookHandler, approvalHandler, rejectionHandler }) {
  const app = express();

  app.use('/slack/interactions', express.urlencoded({ extended: true }));
  app.use('/webhooks/github', express.json());
  app.use(express.json());

  // -- Root status page --
  app.get('/', (_req, res) => {
    res.json({
      service: 'SmartOps Autonomous Agent',
      version: '1.0',
      status: 'running',
      uptime: `${Math.floor(process.uptime())}s`,
      endpoints: {
        health:   'GET /health',
        approve:  'GET /approve/:incidentId/:token',
        reject:   'GET /reject/:incidentId/:token',
        slack:    'POST /slack/interactions',
        github:   'POST /webhooks/github',
      },
    });
  });

  // -- Health --
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: config.agentName, uptime: process.uptime() });
  });

  // ── URL-based approval (works over plain HTTP, no Slack App config needed) ──
  app.get('/approve/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;

    // Respond immediately with a nice HTML page
    res.send(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>SmartOps — Approving ${incidentId}</title>
      <style>
        body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#fff}
        .card{text-align:center;padding:40px;background:#1a1a2e;border-radius:12px;border:1px solid #16213e;max-width:420px}
        h1{color:#00d4ff;margin:0 0 8px}
        p{color:#aaa;margin:0 0 20px}
        .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:bold;background:#0d7377;color:#fff}
        .spinner{width:32px;height:32px;border:3px solid #333;border-top:3px solid #00d4ff;border-radius:50%;animation:spin 1s linear infinite;margin:20px auto}
        @keyframes spin{to{transform:rotate(360deg)}}
      </style>
      <script>setTimeout(()=>location.reload(),8000)</script>
    </head><body>
      <div class="card">
        <h1>🤖 SmartOps</h1>
        <p>Processing approval for <strong>${incidentId}</strong></p>
        <div class="spinner"></div>
        <span class="badge">Rolling back → stable :latest image</span>
        <p style="margin-top:20px;font-size:13px;color:#666">The shop will recover in ~30 seconds.<br>This page auto-refreshes.</p>
      </div>
    </body></html>`);

    // Trigger approval asynchronously
    setImmediate(() => {
      approvalHandler(incidentId, token, 'slack-url-click')
        .catch((err) => console.error('[SERVER] Approval handler error:', err.message));
    });
  });

  // ── URL-based rejection ───────────────────────────────────────────────────
  app.get('/reject/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;

    res.send(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>SmartOps — Rejecting ${incidentId}</title>
      <style>
        body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#fff}
        .card{text-align:center;padding:40px;background:#1a1a2e;border-radius:12px;border:1px solid #16213e;max-width:420px}
        h1{color:#ff4757;margin:0 0 8px}p{color:#aaa}
        .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:bold;background:#c0392b;color:#fff}
      </style>
    </head><body>
      <div class="card">
        <h1>🚫 Rejected</h1>
        <p>Fix for <strong>${incidentId}</strong> was rejected.</p>
        <span class="badge">No changes applied</span>
        <p style="margin-top:20px;font-size:13px;color:#666">Manual intervention required.</p>
      </div>
    </body></html>`);

    setImmediate(() => {
      rejectionHandler(incidentId, token, 'slack-url-click')
        .catch((err) => console.error('[SERVER] Rejection handler error:', err.message));
    });
  });

  // -- Slack interactivity webhook (kept for when HTTPS is configured) --
  app.post('/slack/interactions', (req, res) => {
    res.status(200).send('');
    try {
      const payload = JSON.parse(req.body.payload);
      interactionHandler(payload);
    } catch (err) {
      console.error('[SERVER] Failed to parse Slack interaction:', err.message);
    }
  });

  // -- GitHub push webhook --
  app.post('/webhooks/github', (req, res) => {
    res.status(200).json({ ok: true });
    try {
      webhookHandler(req.body, req.headers);
    } catch (err) {
      console.error('[SERVER] Failed to handle GitHub webhook:', err.message);
    }
  });

  return app;
}

module.exports = { createServer };
