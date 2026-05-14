'use strict';

const { chatCompletionWithRetry } = require('../integrations/llm-client');
const { generateQueryEmbedding }  = require('../integrations/embedding-client');
const { queryRelevantCode }        = require('../integrations/pinecone-client');
const github                       = require('../integrations/github-client');
const { logAuditEvent }            = require('../audit/audit-logger');

// ---------------------------------------------------------------------------
// LLMWiki Reasoning Chain — three-step pipeline with token budget control.
//
// Token budget: NVIDIA NIM Qwen3-480B max context = 32768 tokens.
//   Input budget:  8000 tokens  (~32000 chars)
//   Output budget: 4096 tokens
//
// The chain never exceeds this budget by:
//   1. Using vector search to find ONLY the relevant function, not the whole file
//   2. Truncating large diffs to the most relevant parts
//   3. Counting chars before building the final prompt
// ---------------------------------------------------------------------------

const INPUT_CHAR_BUDGET  = 24000; // ~6000 tokens (conservative)
const CHUNK_CHAR_LIMIT   = 2000;  // chars per code chunk shown to LLM

// ---------------------------------------------------------------------------
// Step 1: DIAGNOSE — structured JSON from error logs.
//
// Understands: TypeError, ECONNREFUSED, OOMKilled, MongoError,
//              Deadlock, RestartSpike, CrashLoopBackOff, HTTP5xx, etc.
// ---------------------------------------------------------------------------
async function diagnose(incidentId, errorLogs, errorType = null, severity = null) {
  const systemPrompt = `You are a senior SRE specialising in Node.js microservices on AWS EKS.

Analyse the error log and identify the root cause.

Possible error categories you must handle:
- TypeError / ReferenceError — code bug, wrong method call, null access
- MissingEndpoint / ProxyError — HTTP 404 from internal API route. Likely
    causes: (a) frontend calling wrong URL, (b) route was recently DELETED
    from the backend, (c) endpoint never existed. CHECK git history.
- ECONNREFUSED / ENOTFOUND — downstream service unavailable
- MongoError / MongoTimeout — database connectivity or query issue
- OOMKilled / HeapOOM — memory leak or undersized container limits
- CrashLoopBackOff / RestartSpike — container keeps crashing
- Deadlock / LockTimeout — database or async lock contention
- HTTP5xx — API endpoint returning 500 errors
- FatalError — Node.js crashed with an unrecoverable error

For MissingEndpoint errors specifically:
- Identify the missing route from the URL in the log
- Set fixStrategy to "restore-deleted-code" if recent git diff shows the
  route was deleted, otherwise "code-fix" to add it
- Set affectedFunction to the route handler name (e.g. "GET /categories")

Respond ONLY with valid JSON. No markdown. No explanation outside JSON.

Schema:
{
  "errorType": "string",
  "rootCause": "string (2-3 sentence technical explanation)",
  "affectedFiles": ["file paths relative to repo root"],
  "affectedFunction": "string (function or method name or HTTP route)",
  "errorLineHint": "string (the URL path or code pattern from the error)",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "service": "string (microservice name)",
  "fixStrategy": "rollback | code-fix | restore-deleted-code | config-change | scale-up | restart"
}`;

  const hint = errorType ? `Error category hint: ${errorType} (${severity})\n\n` : '';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: `${hint}Error logs:\n\n${errorLogs.substring(0, 3000)}` },
  ];

  await logAuditEvent({ incidentId, actionType: 'LLM_PROMPT_SENT' });
  const response = await chatCompletionWithRetry(messages, { temperature: 0.15 });
  await logAuditEvent({ incidentId, actionType: 'LLM_RESPONSE_RECEIVED' });

  try {
    const cleaned = response.content
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    // Merge detector-provided values if LLM couldn't identify them
    if (errorType && !parsed.errorType) parsed.errorType = errorType;
    if (severity  && !parsed.severity)  parsed.severity  = severity;
    return parsed;
  } catch (err) {
    console.error('[CHAIN] Step 1 parse failed:', err.message);
    return {
      errorType:        errorType || 'Unknown',
      rootCause:        response.content.substring(0, 300),
      affectedFiles:    [],
      affectedFunction: '',
      errorLineHint:    '',
      severity:         severity || 'MEDIUM',
      service:          'unknown',
      fixStrategy:      'rollback',
    };
  }
}

// ---------------------------------------------------------------------------
// Step 2: LOCATE — retrieve the exact code that caused the issue.
//
// Strategy:
//   a. Embed query = errorType + rootCause + service + affectedFunction
//   b. Query Pinecone for top-8 function-level chunks
//   c. Filter to chunks that mention the errorLineHint or affectedFunction
//   d. Fetch only the relevant file section (not the whole file)
//   e. Get last 3 git diffs for change context
//   f. Stay within INPUT_CHAR_BUDGET
// ---------------------------------------------------------------------------
async function locateContext(incidentId, diagnosis) {
  // Build a targeted query from the diagnosis
  const queryParts = [
    diagnosis.errorType    ? `Error: ${diagnosis.errorType}` : '',
    diagnosis.rootCause    ? `Cause: ${diagnosis.rootCause}` : '',
    diagnosis.affectedFunction ? `Function: ${diagnosis.affectedFunction}` : '',
    diagnosis.service      ? `Service: ${diagnosis.service}` : '',
    diagnosis.errorLineHint ? `Line hint: ${diagnosis.errorLineHint}` : '',
  ].filter(Boolean).join('\n');

  const queryEmbedding = await generateQueryEmbedding(queryParts);
  const rawChunks      = await queryRelevantCode(queryEmbedding, 12);

  await logAuditEvent({
    incidentId, actionType: 'VECTOR_QUERY',
    metadata: { matchCount: rawChunks.length, topScore: rawChunks[0]?.score },
  });

  // Prioritise: chunks from the affected service and mentioning the function
  const ranked = rawChunks.sort((a, b) => {
    let scoreA = a.score || 0;
    let scoreB = b.score || 0;
    if (a.filePath?.includes(diagnosis.service)) scoreA += 0.15;
    if (b.filePath?.includes(diagnosis.service)) scoreB += 0.15;
    if (diagnosis.affectedFunction && a.content?.includes(diagnosis.affectedFunction)) scoreA += 0.2;
    if (diagnosis.affectedFunction && b.content?.includes(diagnosis.affectedFunction)) scoreB += 0.2;
    return scoreB - scoreA;
  });

  // Keep top-6, truncated to budget
  const relevantChunks = ranked.slice(0, 6).map(c => ({
    ...c,
    content: (c.content || '').substring(0, CHUNK_CHAR_LIMIT),
  }));

  // Fetch recent diffs — only the last 3 commits, only the relevant files
  let diffs = [];
  try {
    const allDiffs = await github.getRecentDiffs(5);
    diffs = allDiffs
      .filter(d => diagnosis.affectedFiles.length === 0 ||
        d.files.some(f => diagnosis.affectedFiles.some(af => f.filename?.includes(af))))
      .slice(0, 3);
    await logAuditEvent({ incidentId, actionType: 'DIFF_FETCHED', metadata: { commitCount: diffs.length } });
  } catch (err) {
    console.error('[CHAIN] Diff fetch failed:', err.message);
  }

  // Fetch at most ONE affected file (the most relevant one), up to 150 lines
  const fileContents = [];
  const targetFile   = diagnosis.affectedFiles?.[0];
  if (targetFile) {
    try {
      const content = await github.getFileContent(targetFile);
      // If we know the function, extract only that function's region
      const lines      = content.split('\n');
      const fnName     = diagnosis.affectedFunction;
      let startIdx     = 0;
      let endIdx       = Math.min(lines.length, 100);

      if (fnName) {
        const fnLine = lines.findIndex(l => l.includes(`function ${fnName}`) || l.includes(`${fnName}(`));
        if (fnLine >= 0) {
          startIdx = Math.max(0, fnLine - 3);
          endIdx   = Math.min(lines.length, fnLine + 60);
        }
      }
      fileContents.push({
        path: targetFile,
        content: lines.slice(startIdx, endIdx).join('\n'),
        startLine: startIdx + 1,
      });
    } catch (err) {
      console.warn(`[CHAIN] Could not fetch ${targetFile}:`, err.message?.substring(0, 80));
    }
  }

  return { relevantChunks, diffs, fileContents };
}

// ---------------------------------------------------------------------------
// Step 3: GENERATE FIX — token-budgeted prompt construction.
//
// Builds the prompt section by section, stopping before exceeding budget.
// ---------------------------------------------------------------------------
async function generateFix(incidentId, diagnosis, context, humanSuggestion = null) {
  const systemPrompt = `You are a senior Node.js/Express engineer fixing a production bug.

RULES:
1. Output ONLY valid JSON. No markdown fences. No text outside JSON.
2. Only change what is strictly necessary to fix the bug.
3. If fixStrategy is "rollback" — set files to [] and explain in summary.
4. If fixStrategy is "code-fix" or "restore-deleted-code" — provide the COMPLETE corrected file content for each affected file.
5. Be precise: reference exact line numbers and function names.

CRITICAL KNOWLEDGE — catalog-service products.js:
- The file has EXACTLY 3 routes in this order: GET /, GET /categories, GET /:id
- /categories MUST be defined BEFORE /:id (Express route matching order)
- Product.price is a plain Number (e.g. 29.99) — it has NO methods like .getDiscount()
- Use Product.findOne({ productId: ... }), NOT Product.findById()
- There must be exactly ONE module.exports = router; at the end
- Each route handler must have try/catch/finally with OpenTelemetry span management
- If a route was deleted, restore it. If a TypeError bug was injected, remove the bad code.

Response schema:
{
  "summary": "string (2-sentence fix description for the SRE)",
  "fixStrategy": "code-fix | restore-deleted-code | config-change | restart",
  "files": [
    {
      "path": "string",
      "functionName": "string (which function was changed)",
      "content": "string (the corrected file content)",
      "explanation": "string (what changed, why, and what line)"
    }
  ],
  "commitMessage": "string (conventional commit)"
}`;

  // Build prompt parts within budget
  const parts = [];
  let usedChars = systemPrompt.length + 500; // reserve 500 for system overhead

  // Diagnosis (always included)
  const diagStr = `## Diagnosis\nService: ${diagnosis.service}\nError: ${diagnosis.errorType}\nSeverity: ${diagnosis.severity}\nFix strategy: ${diagnosis.fixStrategy}\nRoot cause: ${diagnosis.rootCause}\nAffected function: ${diagnosis.affectedFunction || 'unknown'}\nLine hint: ${diagnosis.errorLineHint || 'none'}`;
  parts.push(diagStr);
  usedChars += diagStr.length;

  // Human suggestion (high priority — include if present)
  if (humanSuggestion) {
    const hs = `## Developer Suggestion\n${humanSuggestion}`;
    parts.push(hs);
    usedChars += hs.length;
  }

  // Relevant file content (highest value — function-level)
  for (const f of context.fileContents) {
    const section = `## Source Code: ${f.path} (lines ${f.startLine}+)\n\`\`\`javascript\n${f.content}\n\`\`\``;
    if (usedChars + section.length < INPUT_CHAR_BUDGET) {
      parts.push(section);
      usedChars += section.length;
    }
  }

  // Pinecone code chunks (ranked by relevance)
  if (usedChars < INPUT_CHAR_BUDGET * 0.75) {
    const chunksHeader = '## Related Code from Knowledge Base';
    parts.push(chunksHeader);
    usedChars += chunksHeader.length;

    for (const chunk of context.relevantChunks) {
      const section = `### ${chunk.filePath || ''} ${chunk.functionName ? `(${chunk.functionName})` : ''}\nScore: ${chunk.score?.toFixed(3)}\n${(chunk.content || '').substring(0, CHUNK_CHAR_LIMIT)}`;
      if (usedChars + section.length < INPUT_CHAR_BUDGET) {
        parts.push(section);
        usedChars += section.length;
      }
    }
  }

  // Recent diffs (lowest priority — for change context)
  if (context.diffs.length > 0 && usedChars < INPUT_CHAR_BUDGET * 0.85) {
    const diffHeader = '## Recent Git Changes';
    parts.push(diffHeader);
    usedChars += diffHeader.length;

    for (const d of context.diffs.slice(0, 2)) {
      const patches  = d.files.map(f => `${f.filename}: ${(f.patch || '').substring(0, 200)}`).join('\n');
      const section  = `### ${d.sha?.substring(0, 7)} — ${d.message}\n${patches}`;
      if (usedChars + section.length < INPUT_CHAR_BUDGET) {
        parts.push(section);
        usedChars += section.length;
      }
    }
  }

  const userMessage = parts.join('\n\n');
  console.log(`[CHAIN] Step 3 prompt size: ${usedChars} chars (~${Math.round(usedChars / 4)} tokens)`);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage  },
  ];

  await logAuditEvent({ incidentId, actionType: 'LLM_PROMPT_SENT' });
  const response = await chatCompletionWithRetry(messages, { maxTokens: 3000, temperature: 0.2 });
  await logAuditEvent({ incidentId, actionType: 'LLM_RESPONSE_RECEIVED' });

  try {
    const cleaned = response.content
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[CHAIN] Step 3 parse failed:', err.message);
    return {
      summary:       diagnosis.fixStrategy === 'rollback'
        ? `Rolling back ${diagnosis.service} to last stable image. Root cause: ${diagnosis.rootCause}`
        : 'LLM generated a fix but the response could not be parsed.',
      fixStrategy:   diagnosis.fixStrategy || 'rollback',
      files:         [],
      commitMessage: `fix(${diagnosis.service}): ${diagnosis.rootCause?.substring(0, 60)}`,
    };
  }
}

module.exports = { diagnose, locateContext, generateFix };
