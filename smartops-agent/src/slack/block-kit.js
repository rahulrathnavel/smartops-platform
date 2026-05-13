'use strict';

// ---------------------------------------------------------------------------
// Slack Block Kit message builders — professional format, no emoji.
// ---------------------------------------------------------------------------

const SEVERITY_LABEL = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

function buildIncidentMessage(incidentId, diagnosis, fix, approveUrl, rejectUrl) {
  const diffPreview = fix.files
    .map((f) => `${f.path}\n${f.explanation || 'Updated'}`)
    .join('\n\n')
    .substring(0, 2500);

  const sev = SEVERITY_LABEL[diagnosis.severity] || 'MEDIUM';

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${incidentId}  |  ${sev}`, emoji: false },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*[${sev}] Incident Detected*`,
          `*Service:*     \`${diagnosis.service}\``,
          `*Error Type:*  \`${diagnosis.errorType}\``,
          `*Root Cause:*  ${diagnosis.rootCause}`,
        ].join('\n'),
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Proposed Fix* (${fix.files?.length || 0} file${fix.files?.length !== 1 ? 's' : ''}):\n${fix.summary || 'See details below'}`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`\n${diffPreview}\n\`\`\`` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '*Action required — click a link below:*',
          '',
          `*[APPROVE]* — Roll back to stable and apply fix: <${approveUrl}|Approve and Deploy>`,
          `*[REJECT]* — Skip this fix, manual action needed: <${rejectUrl}|Reject>`,
          '',
          'Or reply in thread with: `suggest: <your change request>`',
        ].join('\n'),
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `SmartOps Agent  |  ${new Date().toISOString()}  |  Links open in browser`,
        },
      ],
    },
  ];
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
          `*[RESOLVED] Fix Approved and Deployed*`,
          `*Service:*     \`${diagnosis.service}\``,
          `*Root Cause:*  ${diagnosis.rootCause}`,
          prNumber ? `*PR:*          #${prNumber} (merged)` : '',
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
          `*[REJECTED] Fix Rejected by SRE*`,
          `*Service:*  \`${diagnosis.service}\``,
          `*Root Cause:*  ${diagnosis.rootCause}`,
          'The proposed fix was not applied. Manual intervention required.',
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
          `*[ERROR] SmartOps Agent encountered an error*`,
          `*Service:*  \`${rawIncident.service || 'unknown'}\``,
          `*Error:*    ${errorMsg}`,
          'Manual investigation required.',
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
          `*New Fix:*  ${fix.summary || fix.commitMessage}`,
          '',
          'Reply `approve` to deploy or `suggest: <new change>` to refine further.',
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
