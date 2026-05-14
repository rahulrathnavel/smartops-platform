'use strict';

// ---------------------------------------------------------------------------
// Slack Block Kit — simple, reliable format.
// No interactive buttons (they require HTTPS + Slack App webhook config).
// Users reply in the thread: "1" approve, "2" reject, "3 <text>" suggest.
// The thread-listener.js polls for replies every 15 seconds.
// ---------------------------------------------------------------------------

function buildIncidentMessage(incidentId, diagnosis, fix, approveUrl, rejectUrl) {
  const sev = diagnosis.severity || 'MEDIUM';

  const diffLines = (fix.files || [])
    .map(f => `• ${f.path}\n  ${f.explanation || 'Updated'}`)
    .join('\n')
    .substring(0, 1800);

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `INCIDENT ${incidentId}  —  ${sev}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Service:*    \`${diagnosis.service}\``,
          `*Error type:* \`${diagnosis.errorType}\``,
          `*Root cause:* ${diagnosis.rootCause}`,
        ].join('\n'),
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Proposed fix (${fix.files?.length || 0} file${fix.files?.length !== 1 ? 's' : ''})* — ${fix.summary || 'AI-generated code change'}\n\`\`\`\n${diffLines}\n\`\`\``,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '*Reply in this thread to act:*',
          '',
          '`1`  — Approve and deploy (rolls back service + applies fix)',
          '`2`  — Reject (no change, manual fix needed)',
          '`3 <your request>`  — Suggest a change to the fix',
          '         _Example:_ `3 remove the getDiscount call entirely`',
          '',
          `_Or open in browser:_  ${approveUrl}`,
        ].join('\n'),
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `SmartOps Agent  |  ${new Date().toISOString()}` },
      ],
    },
  ];
}

function buildApprovedMessage(incidentId, diagnosis, prNumber) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `RESOLVED  —  ${incidentId}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Service rolled back to stable image.*`,
          `*Service:*    \`${diagnosis.service}\``,
          `*Root cause:* ${diagnosis.rootCause}`,
          prNumber ? `*PR:* #${prNumber} merged` : '',
        ].filter(Boolean).join('\n'),
      },
    },
  ];
}

function buildRejectedMessage(incidentId, diagnosis) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `REJECTED  —  ${incidentId}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*No changes applied.*\n*Service:* \`${diagnosis.service}\`\nManual intervention required.`,
      },
    },
  ];
}

function buildErrorMessage(incidentId, rawIncident, errorMsg) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `AGENT ERROR  —  ${incidentId}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Service:* \`${rawIncident.service || 'unknown'}\`\n*Error:* ${errorMsg}`,
      },
    },
  ];
}

function buildSuggestionAppliedMessage(incidentId, diagnosis, fix) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FIX REVISED  —  ${incidentId}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Updated fix:* ${fix.summary || fix.commitMessage}\nReply \`1\` to approve or \`3 <text>\` for another change.`,
      },
    },
  ];
}

module.exports = {
  buildIncidentMessage,
  buildApprovedMessage,
  buildRejectedMessage,
  buildErrorMessage,
  buildSuggestionAppliedMessage,
};
