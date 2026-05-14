'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch  = require('node-fetch');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const AGENT_URL   = process.env.AGENT_URL   || 'http://abe89923884ea4896bdda38a738650f7-afd67114d324f5df.elb.ap-south-1.amazonaws.com';
const GROUP_NAME  = process.env.GROUP_NAME  || 'SmartOps Incidents';
const POLL_MS     = parseInt(process.env.POLL_MS || '8000', 10);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let whatsappReady   = false;
let targetGroupId   = null;
const notifiedIds   = new Set();   // incident IDs already sent to WhatsApp
const pendingMap    = new Map();   // incidentId -> { approveToken, rejectToken, status }

// ---------------------------------------------------------------------------
// WhatsApp client (uses LocalAuth to persist session — QR only needed once)
// ---------------------------------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  },
});

client.on('qr', (qr) => {
  console.log('\n[WhatsApp] Scan this QR code with your WhatsApp (Settings > Linked Devices):');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  whatsappReady = true;
  console.log('[WhatsApp] Connected and ready. Waiting 5s for page to fully load...');

  // Give WhatsApp Web time to finish rendering before querying chats
  await new Promise(r => setTimeout(r, 5000));

  // Retry getChats up to 3 times in case the page is still slow
  let chats = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      chats = await client.getChats();
      break;
    } catch (err) {
      console.warn(`[WhatsApp] getChats() attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
    }
  }

  const group = chats.find(c => c.isGroup && c.name === GROUP_NAME);
  if (group) {
    targetGroupId = group.id._serialized;
    console.log(`[WhatsApp] Target group found: "${GROUP_NAME}" (${targetGroupId})`);
    await send(`SmartOps Agent connected.\nMonitoring: ${AGENT_URL}\nGroup: ${GROUP_NAME}`);
  } else {
    console.warn(`[WhatsApp] Group "${GROUP_NAME}" not found. Create a WhatsApp group with that exact name and restart.`);
    if (chats.length > 0) {
      console.warn('[WhatsApp] Available groups:', chats.filter(c => c.isGroup).map(c => c.name).join(', '));
    }
  }
});

client.on('disconnected', () => {
  whatsappReady = false;
  console.log('[WhatsApp] Disconnected.');
});

// ---------------------------------------------------------------------------
// Incoming message handler — parses developer replies
// ---------------------------------------------------------------------------
client.on('message', async (msg) => {
  if (!targetGroupId || msg.from !== targetGroupId) return;

  const text = msg.body.trim().toLowerCase();

  // Find which incident the user is replying about
  // Look for "1", "approve", "2", "reject", "3 <text>", "suggest <text>"
  const activeIncidents = [...pendingMap.entries()]
    .filter(([, v]) => v.status === 'awaiting_approval');

  if (activeIncidents.length === 0) {
    if (text === '1' || text === '2' || text.startsWith('3') || text.startsWith('suggest')) {
      await send('No active incidents awaiting approval right now.');
    }
    return;
  }

  // If there is exactly one active incident, apply to it automatically
  // If multiple, user should prefix with the incident ID
  let targetId = null;
  let action   = null;
  let suggestion = '';

  for (const [id] of activeIncidents) {
    if (text.includes(id.toLowerCase())) {
      targetId = id;
      break;
    }
  }

  // Fallback: apply to the most recent active incident
  if (!targetId) targetId = activeIncidents[activeIncidents.length - 1][0];

  if (text === '1' || text === 'approve' || text === 'yes' || text === 'ok') {
    action = 'approve';
  } else if (text === '2' || text === 'reject' || text === 'no') {
    action = 'reject';
  } else if (text.startsWith('3 ') || text.startsWith('suggest ')) {
    action = 'suggest';
    suggestion = msg.body.replace(/^(3|suggest)\s+/i, '').trim();
  }

  if (!action) return;

  const entry = pendingMap.get(targetId);
  if (!entry) return;

  if (action === 'approve') {
    await send(`Approving ${targetId}... rolling back service now.`);
    try {
      // Use the direct JSON action API — no browser needed
      const r = await fetch(`${AGENT_URL}/action/approve/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'whatsapp' }),
        timeout: 8000,
      });
      if (r.ok) {
        pendingMap.set(targetId, { ...entry, status: 'approved' });
        await send(`Approved. Service is rolling back to stable image.\nShop will recover in ~30 seconds.`);
      } else {
        await send(`Approval returned HTTP ${r.status}. Check the dashboard.`);
      }
    } catch (err) {
      await send(`Approval failed: ${err.message}`);
    }

  } else if (action === 'reject') {
    await send(`Rejecting ${targetId}. No changes will be applied.`);
    try {
      const r = await fetch(`${AGENT_URL}/action/reject/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'whatsapp' }),
        timeout: 8000,
      });
      if (r.ok) {
        pendingMap.set(targetId, { ...entry, status: 'rejected' });
        await send(`Rejected. Manual investigation required for ${targetId}.`);
      }
    } catch (err) {
      await send(`Rejection failed: ${err.message}`);
    }

  } else if (action === 'suggest' && suggestion) {
    await send(`Suggestion received:\n"${suggestion}"\n\nSending to LLM for a revised fix...`);
    try {
      const payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'whatsapp-user', username: 'developer-whatsapp' },
        actions: [{ action_id: 'suggest_fix', value: targetId }],
        suggestion,
      });
      const r = await fetch(`${AGENT_URL}/slack/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `payload=${encodeURIComponent(payload)}`,
        timeout: 8000,
      });
      if (r.ok) {
        await send(`Suggestion submitted. You will get another approval request shortly.`);
      }
    } catch (err) {
      await send(`Could not forward suggestion: ${err.message}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Send a message to the target group
// ---------------------------------------------------------------------------
async function send(text) {
  if (!whatsappReady || !targetGroupId) {
    console.log('[WhatsApp] Not ready, would have sent:', text.substring(0, 60));
    return;
  }
  try {
    await client.sendMessage(targetGroupId, text);
  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Format a professional incident alert message for WhatsApp
// ---------------------------------------------------------------------------
function formatIncidentAlert(inc) {
  const rca = inc.rcaOutput;
  const sep = '─'.repeat(40);
  const lines = [
    sep,
    `SMARTOPS INCIDENT ALERT`,
    `ID: ${inc.id}`,
    `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    sep,
    '',
    `SERVICE AFFECTED`,
    `  ${inc.service || 'unknown'} (${inc.severity || 'MEDIUM'} severity)`,
    '',
    `ERROR DETECTED`,
    `  ${(inc.errorLog || 'See agent logs').substring(0, 200)}`,
    '',
  ];

  if (rca) {
    lines.push('RCA MODEL ANALYSIS');
    lines.push(`  Root cause:  ${rca.rootCauseNode} — ${Math.round((rca.confidence || 0) * 100)}% confidence`);
    if (rca.propagationPath?.length > 1) {
      lines.push(`  Also affected: ${rca.propagationPath.slice(1).join(', ')}`);
    }
    if (rca.evidenceMetrics) {
      const m = rca.evidenceMetrics;
      if (m.errorRate)    lines.push(`  Error rate:  ${m.errorRate}`);
      if (m.p95Latency)   lines.push(`  P95 latency: ${m.p95Latency}`);
    }
    lines.push('');
  }

  if (inc.diagnosis) {
    lines.push('LLM DIAGNOSIS');
    lines.push(`  ${inc.diagnosis}`);
    lines.push('');
  }

  if (inc.fix) {
    lines.push('PROPOSED FIX (code change)');
    lines.push(`  ${inc.fix}`);
    lines.push('');
    lines.push('PLAIN SUMMARY');
    lines.push(`  The LLM identified a bug in ${inc.service} and generated`);
    lines.push(`  a code fix. Approving will roll back the service to the`);
    lines.push(`  last stable image and apply the fix automatically.`);
    lines.push('');
  }

  lines.push(sep);
  lines.push('YOUR OPTIONS — reply with a number:');
  lines.push('');
  lines.push('  1  Approve and Deploy');
  lines.push('     Rolls back service + applies AI fix');
  lines.push('');
  lines.push('  2  Reject');
  lines.push('     No changes — manual investigation needed');
  lines.push('');
  lines.push('  3 <your message>  Suggest a change');
  lines.push('     Example: 3 rename the variable to discountValue');
  lines.push('     LLM will regenerate the fix and ask again');
  lines.push(sep);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Poll SmartOps Agent for new incidents awaiting approval
// ---------------------------------------------------------------------------
async function pollAgent() {
  if (!whatsappReady || !targetGroupId) return;

  try {
    const r = await fetch(`${AGENT_URL}/incidents`, { timeout: 5000 });
    if (!r.ok) return;
    const { incidents } = await r.json();

    for (const inc of incidents || []) {
      if (inc.status !== 'awaiting_approval') continue;
      if (notifiedIds.has(inc.id)) continue;

      notifiedIds.add(inc.id);
      pendingMap.set(inc.id, {
        status:       inc.status,
        approveToken: 'whatsapp-token',
        rejectToken:  'whatsapp-token-reject',
      });

      const msg = formatIncidentAlert(inc);
      await send(msg);
      console.log(`[WhatsApp] Alert sent for ${inc.id}`);
    }

    // Update status of known incidents
    for (const inc of incidents || []) {
      const entry = pendingMap.get(inc.id);
      if (entry && entry.status === 'awaiting_approval' && inc.status === 'resolved') {
        pendingMap.set(inc.id, { ...entry, status: 'resolved' });
        await send(`[RESOLVED] ${inc.id} — Service has recovered.`);
      }
    }
  } catch (err) {
    // Silently skip on network errors (agent might be busy)
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log('='.repeat(55));
console.log('  SmartOps WhatsApp Bridge');
console.log(`  Agent:  ${AGENT_URL}`);
console.log(`  Group:  ${GROUP_NAME}`);
console.log(`  Poll:   every ${POLL_MS}ms`);
console.log('='.repeat(55));
console.log('Initializing WhatsApp client...\n');

client.initialize();
setInterval(pollAgent, POLL_MS);
