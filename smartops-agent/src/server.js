'use strict';

const express = require('express');
const { config } = require('./config');

// ---------------------------------------------------------------------------
// Express HTTP server.
// Approval is via clickable HTTP links (GET /approve/:id/:token shows confirmation,
// POST /approve/:id/:token triggers the rollback) rather than Slack interactive
// buttons, which require HTTPS and a configured Slack App webhook URL.
// ---------------------------------------------------------------------------

function createServer({ interactionHandler, webhookHandler, approvalHandler, rejectionHandler, getIncidents }) {
  const app = express();

  app.use('/slack/interactions', express.urlencoded({ extended: true }));
  app.use('/webhooks/github', express.json());
  app.use(express.json());

  // -- Root status --
  app.get('/', (_req, res) => {
    res.json({
      service: 'SmartOps Autonomous Agent',
      version: '1.0',
      status: 'running',
      uptime: `${Math.floor(process.uptime())}s`,
      endpoints: {
        health:    'GET /health',
        incidents: 'GET /incidents',
        approve:   'GET /approve/:incidentId/:token  (confirmation page)',
        approveAction: 'POST /approve/:incidentId/:token (triggers rollback)',
        reject:    'GET /reject/:incidentId/:token',
        rejectAction: 'POST /reject/:incidentId/:token',
        slack:     'POST /slack/interactions',
        github:    'POST /webhooks/github',
      },
    });
  });

  // -- Health --
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: config.agentName, uptime: process.uptime() });
  });

  // -- Simple JSON action API for WhatsApp bridge (no browser needed) --
  app.post('/action/approve/:incidentId', (req, res) => {
    const { incidentId } = req.params;
    const actor = req.body?.actor || 'whatsapp';
    res.json({ ok: true, incidentId, action: 'approve' });
    setImmediate(() =>
      approvalHandler(incidentId, 'whatsapp-token', actor)
        .catch(e => console.error('[ACTION] approve error:', e.message))
    );
  });

  app.post('/action/reject/:incidentId', (req, res) => {
    const { incidentId } = req.params;
    const actor = req.body?.actor || 'whatsapp';
    res.json({ ok: true, incidentId, action: 'reject' });
    setImmediate(() =>
      rejectionHandler(incidentId, 'whatsapp-token', actor)
        .catch(e => console.error('[ACTION] reject error:', e.message))
    );
  });

  // -- Incidents REST API (used by dashboard backend and WhatsApp bridge) --
  app.get('/incidents', (_req, res) => {
    try {
      const all = getIncidents ? getIncidents() : [];
      res.json({ incidents: all, count: all.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Shared page CSS ───────────────────────────────────────────────────────
  const PAGE_CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1e293b;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:40px;
          max-width:480px;width:100%;box-shadow:0 4px 16px rgba(0,0,0,0.08)}
    h1{font-size:22px;font-weight:700;margin-bottom:8px;color:#0f172a}
    .sub{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.5}
    .service{font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px;
             font-size:13px;color:#1d4ed8}
    .btn{display:block;width:100%;padding:14px;border:none;border-radius:8px;font-size:15px;
         font-weight:600;cursor:pointer;margin-top:12px;text-align:center;text-decoration:none}
    .btn-approve{background:#2563eb;color:#fff}
    .btn-approve:hover{background:#1d4ed8}
    .btn-reject{background:#fff;color:#64748b;border:1px solid #e2e8f0}
    .btn-reject:hover{background:#f8fafc}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
    .badge-processing{background:#eff6ff;color:#2563eb}
    .badge-done{background:#f0fdf4;color:#16a34a}
    .badge-rejected{background:#fef2f2;color:#dc2626}
    .spinner{width:24px;height:24px;border:3px solid #e2e8f0;border-top:3px solid #2563eb;
             border-radius:50%;animation:spin 0.8s linear infinite;margin:20px auto}
    @keyframes spin{to{transform:rotate(360deg)}}
    .divider{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
    .meta{font-size:12px;color:#94a3b8;margin-top:16px}
  `;

  // ── Approval flow — GET shows confirmation, POST triggers rollback ─────────
  app.get('/approve/:incidentId/:token', (req, res) => {
    const { incidentId } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Approve ${incidentId}</title>
      <style>${PAGE_CSS}</style></head><body>
      <div class="card">
        <h1>Incident Approval</h1>
        <p class="sub">Approving this will roll back <span class="service">${incidentId}</span> to the last stable image and apply the AI-generated fix.</p>
        <form method="POST">
          <button class="btn btn-approve" type="submit">Approve and Deploy</button>
        </form>
        <form method="POST" action="/reject/${incidentId}/${req.params.token}">
          <button class="btn btn-reject" type="submit">Reject</button>
        </form>
        <p class="meta">Incident: ${incidentId} — SmartOps Agent</p>
      </div></body></html>`);
  });

  app.post('/approve/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Processing</title>
      <style>${PAGE_CSS}</style>
      <script>setTimeout(()=>location.replace('/'),15000)</script></head><body>
      <div class="card">
        <h1>Deployment in Progress</h1>
        <p class="sub">Rolling back <span class="service">catalog-service</span> to stable image. The service will recover in approximately 30 seconds.</p>
        <div class="spinner"></div>
        <span class="badge badge-processing">Processing rollback...</span>
        <p class="meta" style="margin-top:20px">This page closes automatically.</p>
      </div></body></html>`);
    setImmediate(() => {
      approvalHandler(incidentId, token, 'web-sre-approval')
        .catch((err) => console.error('[SERVER] Approval error:', err.message));
    });
  });

  // ── Rejection flow ────────────────────────────────────────────────────────
  app.get('/reject/:incidentId/:token', (req, res) => {
    const { incidentId } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Reject ${incidentId}</title>
      <style>${PAGE_CSS}</style></head><body>
      <div class="card">
        <h1>Reject Fix</h1>
        <p class="sub">Rejecting will leave the service unchanged. Manual investigation will be required.</p>
        <form method="POST">
          <button class="btn" style="background:#dc2626;color:#fff" type="submit">Confirm Rejection</button>
        </form>
        <p class="meta">Incident: ${incidentId}</p>
      </div></body></html>`);
  });

  app.post('/reject/:incidentId/:token', (req, res) => {
    const { incidentId, token } = req.params;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SmartOps — Rejected</title>
      <style>${PAGE_CSS}</style></head><body>
      <div class="card">
        <h1>Fix Rejected</h1>
        <p class="sub">The proposed fix for <span class="service">${incidentId}</span> was rejected. No changes were applied.</p>
        <span class="badge badge-rejected">Rejected</span>
        <p class="meta" style="margin-top:20px">Manual intervention required.</p>
      </div></body></html>`);
    setImmediate(() => {
      rejectionHandler(incidentId, token, 'web-sre-rejection')
        .catch((err) => console.error('[SERVER] Rejection error:', err.message));
    });
  });

  // -- Slack interactivity (kept for when HTTPS is configured) --
  app.post('/slack/interactions', (req, res) => {
    res.status(200).send('');
    try {
      const payload = JSON.parse(req.body.payload);
      interactionHandler(payload);
    } catch (err) {
      console.error('[SERVER] Slack interaction parse error:', err.message);
    }
  });

  // -- GitHub push webhook --
  app.post('/webhooks/github', (req, res) => {
    res.status(200).json({ ok: true });
    try {
      webhookHandler(req.body, req.headers);
    } catch (err) {
      console.error('[SERVER] GitHub webhook error:', err.message);
    }
  });

  return app;
}

module.exports = { createServer };
