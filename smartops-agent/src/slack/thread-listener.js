'use strict';

const slack          = require('../integrations/slack-client');
const incidentManager = require('../core/incident-manager');

// ---------------------------------------------------------------------------
// Thread Listener — polls active incident Slack threads every 15 seconds.
// Recognises: "suggest: <text>" or "1" (approve) or "2" (reject) typed in thread.
// ---------------------------------------------------------------------------

const seen = new Set(); // processed message ts values

async function pollAllThreads() {
  const incidents = incidentManager.getAllIncidents();
  for (const inc of incidents) {
    if (inc.status !== 'awaiting_approval') continue;

    const full = incidentManager.getIncident(inc.id);
    if (!full?.slackMessage?.channel || !full?.slackMessage?.ts) continue;

    try {
      const replies = await slack.getThreadReplies(full.slackMessage.channel, full.slackMessage.ts);
      for (const msg of replies) {
        if (seen.has(msg.ts))  continue;
        if (!msg.text)         continue;
        if (msg.bot_id)        continue; // skip our own messages

        seen.add(msg.ts);

        const text = msg.text.trim().toLowerCase();

        if (text === '1' || text === 'approve' || text === 'yes') {
          console.log(`[THREAD] Approve for ${inc.id} from ${msg.user}`);
          await slack.postThreadReply(full.slackMessage.channel, full.slackMessage.ts,
            `Approval received from <@${msg.user}>. Rolling back service now...`);
          incidentManager.handleApproval(inc.id, msg.user).catch(e =>
            console.error('[THREAD] Approval error:', e.message));

        } else if (text === '2' || text === 'reject' || text === 'no') {
          console.log(`[THREAD] Reject for ${inc.id} from ${msg.user}`);
          incidentManager.handleRejection(inc.id, msg.user).catch(e =>
            console.error('[THREAD] Rejection error:', e.message));

        } else if (text.startsWith('suggest:') || text.startsWith('suggest ')) {
          const suggestion = msg.text.replace(/^suggest:?\s*/i, '').trim();
          if (suggestion.length >= 5) {
            console.log(`[THREAD] Suggestion for ${inc.id}: "${suggestion.substring(0, 80)}"`);
            await slack.postThreadReply(full.slackMessage.channel, full.slackMessage.ts,
              `Suggestion received. Regenerating fix based on: "${suggestion.substring(0, 100)}"...`);
            incidentManager.handleSuggestion(inc.id, suggestion, msg.user).catch(e =>
              console.error('[THREAD] Suggestion error:', e.message));
          }
        }
      }
    } catch (err) {
      // Silently skip — thread may not exist or API rate limited
    }
  }
}

function startThreadListener() {
  console.log('[THREAD] Slack thread listener started (polling every 15s)');
  setInterval(pollAllThreads, 15_000);
  pollAllThreads(); // run immediately
}

module.exports = { startThreadListener, pollAllThreads };
