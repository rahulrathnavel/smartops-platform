'use strict';

const { WebClient } = require('@slack/web-api');
const { config } = require('../config');

let client = null;

function getClient() {
  if (!client) client = new WebClient(config.slack.botToken);
  return client;
}

// Post an incident message.
// unfurl_links: false prevents Slack from auto-fetching approval URLs.
async function postIncidentMessage(blocks, text) {
  const slack = getClient();
  const result = await slack.chat.postMessage({
    channel:       config.slack.channelId,
    blocks,
    text:          text || 'New incident detected by SmartOps Agent',
    unfurl_links:  false,
    unfurl_media:  false,
  });
  return { channel: result.channel, ts: result.ts };
}

async function updateMessage(channel, ts, blocks, text) {
  const slack = getClient();
  await slack.chat.update({
    channel, ts, blocks,
    text:         text || 'Incident updated',
    unfurl_links: false,
  });
}

async function postThreadReply(channel, threadTs, text) {
  const slack = getClient();
  await slack.chat.postMessage({
    channel,
    thread_ts:    threadTs,
    text,
    unfurl_links: false,
  });
}

async function getThreadReplies(channel, threadTs) {
  const slack = getClient();
  const result = await slack.conversations.replies({ channel, ts: threadTs, limit: 50 });
  return result.messages || [];
}

module.exports = { postIncidentMessage, updateMessage, postThreadReply, getThreadReplies };
