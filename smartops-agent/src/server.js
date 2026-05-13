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

  // ── URL-based approval ────────────────────────────────────────────────────
  // GET  → shows a confirmation page (safe for Slack link unfurling)
  // POST → actually triggers the K8s rollback (only fires on button click)

  const CSS = `
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
         height:100vh;margin:0;background:#0f0f0f;color:#fff}
    .card{text-align:center;padding:40px;background:#1a1a2e;border-radius:12px;
          border:1px solid #16213e;max-width:460px;width:90%}
    h1{margin:0 0 8px}p{color:#aaa;margin:8px 0}
    .btn{display:inline-block;margin:6px;padding:12px 28px;border:none;border-radius:8px;
         font-size:16px;font-weight:bold;cursor:pointer;text-decoration:none}
    .approve{background:#0d7377;color:#fff}.approve:hover{background:#0a5c60}
    .reject{background:#444;color:#ccc}.reject:hover{background:#555}
    .spinner{width:32px;height:32px;border:3px solid #333;border-top:3px solid #00d4ff;
             border-radius:50%;animation:spin 1s linear infinite;margin:16px auto}
    @keyframes spin{to{transform:rotate(360deg)}}
    .done{color:#00d4ff;font-size:22px;margin:12px 0}`;

  app.get('/approve/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Approve ${incidentId}</title>
      <style>${CSS}</style></head><body><div class="card">
        <h1>🤖 SmartOps</h1>
        <p>Incident: <strong>${incidentId}</strong></p>
        <p>Rolling back <code>catalog-service</code> to stable <code>:latest</code> image.</p>
        <form method="POST">
          <button class="btn approve" type="submit">✅ Confirm — Approve &amp; Heal</button>
        </form>
        <form method="POST" action="/reject/${incidentId}/${token}">
          <button class="btn reject" type="submit">✗ Reject</button>
        </form>
      </div></body></html>`);
  });

  app.post('/approve/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Healing ${incidentId}</title>
      <style>${CSS}</style>
      <script>setTimeout(()=>location.replace('/'),12000)</script></head><body><div class="card">
        <h1>🤖 SmartOps</h1>
        <div class="done">✅ Approved!</div>
        <div class="spinner"></div>
        <p>Rolling back catalog-service → <code>:latest</code></p>
        <p style="font-size:13px;color:#666">Shop recovers in ~30s. Page auto-closes.</p>
      </div></body></html>`);
    setImmediate(() => {
      approvalHandler(incidentId, token, 'sre-web-approval')
        .catch((err) => console.error('[SERVER] Approval error:', err.message));
    });
  });

  // ── URL-based rejection ───────────────────────────────────────────────────
  app.get('/reject/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Reject ${incidentId}</title>
      <style>${CSS}</style></head><body><div class="card">
        <h1>🚫 SmartOps</h1>
        <p>Reject the fix for <strong>${incidentId}</strong>?</p>
        <p style="color:#ff6b6b">No changes will be applied. Manual fix required.</p>
        <form method="POST">
          <button class="btn" style="background:#c0392b;color:#fff" type="submit">✗ Confirm Rejection</button>
        </form>
      </div></body></html>`);
  });

  app.post('/reject/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Rejected</title>
      <style>${CSS}</style></head><body><div class="card">
        <h1>🚫 Rejected</h1>
        <p>Fix for <strong>${incidentId}</strong> was rejected.</p>
        <p style="font-size:13px;color:#666">Manual intervention required.</p>
      </div></body></html>`);
    setImmediate(() => {
      rejectionHandler(incidentId, token, 'sre-web-rejection')
        .catch((err) => console.error('[SERVER] Rejection error:', err.message));
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
