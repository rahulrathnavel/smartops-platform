'use strict';

// ---------------------------------------------------------------------------
// Slack Block Kit message builders.
// Buttons use type "button" with a url field — clicking opens the browser.
// This avoids the 3-second Slack webhook timeout entirely since no interaction
// payload is sent to our server. The user clicks, browser opens, action fires.
// ---------------------------------------------------------------------------

function buildIncidentMessage(incidentId, diagnosis, fix, approveUrl, rejectUrl) {
  const sev = diagnosis.severity || 'MEDIUM';

  const diffPreview = (fix.files || [])
    .map(f => `${f.path}\n${f.explanation || 'Updated'}`)
    .join('\n\n')
    .substring(0, 2000);

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  ${sev} Severity`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Service:*  \`${diagnosis.service}\``,
          `*Error:*    \`${diagnosis.errorType}\``,
          `*Diagnosis:* ${diagnosis.rootCause}`,
        ].join('\n'),
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Proposed Fix* (${fix.files?.length || 0} file${fix.files?.length !== 1 ? 's' : ''}):\n${fix.summary || 'AI-generated code fix'}`,
      },
    },
    fix.files?.length > 0 && {
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`\n${diffPreview}\n\`\`\`` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Click a button below to respond. Opens in your browser — no timeout.*',
      },
    },
    // Buttons with url field — opens browser directly, no webhook timeout
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve and Deploy', emoji: false },
          style: 'primary',
          url: approveUrl,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: false },
          style: 'danger',
          url: rejectUrl,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `To suggest a code change, reply in this thread:\n*suggest: <your request>*\nExample: \`suggest: rename getDiscount to applyPricingRule\``,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `SmartOps Agent  |  ${new Date().toISOString()}  |  Buttons open browser, no timeout` },
      ],
    },
  ].filter(Boolean);
}

function buildApprovedMessage(incidentId, diagnosis, prNumber) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  RESOLVED`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*[APPROVED] Fix Deployed*`,
          `*Service:*    \`${diagnosis.service}\``,
          `*Root Cause:* ${diagnosis.rootCause}`,
          prNumber ? `*PR:*         #${prNumber} (merged)` : '',
        ].filter(Boolean).join('\n'),
      },
    },
  ];
}

function buildRejectedMessage(incidentId, diagnosis) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  REJECTED`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*[REJECTED] Fix Not Applied*`,
          `*Service:*    \`${diagnosis.service}\``,
          `*Root Cause:* ${diagnosis.rootCause}`,
          'Manual intervention required.',
        ].join('\n'),
      },
    },
  ];
}

function buildErrorMessage(incidentId, rawIncident, errorMsg) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  AGENT ERROR`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*[ERROR] Agent pipeline failed*`,
          `*Service:* \`${rawIncident.service || 'unknown'}\``,
          `*Error:*   ${errorMsg}`,
        ].join('\n'),
      },
    },
  ];
}

function buildSuggestionAppliedMessage(incidentId, diagnosis, fix) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  FIX REVISED`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*[REVISED] Fix updated based on your suggestion*`,
          `*Service:*  \`${diagnosis.service}\``,
          `*New fix:*  ${fix.summary || fix.commitMessage}`,
        ].join('\n'),
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
