'use strict';

const github    = require('../integrations/github-client');
const { generateEmbeddings } = require('../integrations/embedding-client');
const pinecone  = require('../integrations/pinecone-client');
const { logAuditEvent } = require('../audit/audit-logger');

// ---------------------------------------------------------------------------
// LLMWiki — Code Indexer
//
// Chunks source code at FUNCTION level (not character level) so each vector
// represents a complete function/class with rich metadata:
//   - file path, service name, function name, start/end line, imports
//
// This gives the LLM precise, non-truncated code context for any error.
// ---------------------------------------------------------------------------

const INDEXABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.yaml', '.yml', '.tf', '.md'];
const SKIP_DIRS             = ['node_modules', '.git', 'dist', 'build', '.terraform', '.wwebjs'];

// Token budget: ~4 chars = 1 token. Keep each chunk under 1200 tokens.
const MAX_CHUNK_CHARS = 4800;

// ---------------------------------------------------------------------------
// Extract function/class/method boundaries from JS source.
// Returns array of { name, startLine, endLine, body } blocks.
// ---------------------------------------------------------------------------
function extractFunctionBlocks(content) {
  const lines  = content.split('\n');
  const blocks = [];
  let depth    = 0;
  let current  = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect function/class declarations
    if (!current) {
      const fnMatch   = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      const arrowMatch = line.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
      const methodMatch = line.match(/^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/);

      const name = (fnMatch || arrowMatch || classMatch || methodMatch)?.[1];
      if (name && (line.includes('{') || lines[i + 1]?.includes('{'))) {
        current    = { name, startLine: i + 1, bodyLines: [line] };
        depth      = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        if (depth === 0) { depth = 1; }
        continue;
      }
    }

    if (current) {
      current.bodyLines.push(line);
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (depth <= 0) {
        current.endLine = i + 1;
        current.body    = current.bodyLines.join('\n');
        blocks.push(current);
        current = null;
        depth   = 0;
      }
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Extract imports from a file.
// ---------------------------------------------------------------------------
function extractImports(content) {
  return content
    .split('\n')
    .filter(l => l.match(/^(?:const|let|import)\s+.*require\(|^import\s+/))
    .slice(0, 10)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Chunk a single file into semantically meaningful pieces.
// ---------------------------------------------------------------------------
function chunkFile(filePath, content) {
  const service = getService(filePath);
  const imports = extractImports(content).substring(0, 500);
  const functions = extractFunctionBlocks(content);
  const chunks   = [];

  if (functions.length > 0) {
    // Function-level chunks — best for precision retrieval
    for (const fn of functions) {
      const body = `// File: ${filePath}\n// Imports:\n${imports}\n\n// Function: ${fn.name} (lines ${fn.startLine}-${fn.endLine})\n${fn.body}`;
      const truncated = body.substring(0, MAX_CHUNK_CHARS);
      chunks.push({
        id: `${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_fn_${fn.name}_${fn.startLine}`,
        content: truncated,
        metadata: {
          filePath,
          service,
          functionName: fn.name,
          startLine:    fn.startLine,
          endLine:      fn.endLine,
          chunkType:    'function',
          content:      truncated.substring(0, 400),
        },
      });
    }
  }

  // Always add a file-level header chunk (imports + first 60 lines)
  const headerLines = content.split('\n').slice(0, 60).join('\n');
  const headerContent = `// File: ${filePath}\n${headerLines}`.substring(0, MAX_CHUNK_CHARS);
  chunks.push({
    id: `${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_header`,
    content: headerContent,
    metadata: {
      filePath,
      service,
      chunkType:    'header',
      functionName: '',
      startLine:    1,
      endLine:      60,
      content:      headerContent.substring(0, 400),
    },
  });

  return chunks;
}

function getService(filePath) {
  if (filePath.includes('catalog-service'))  return 'catalog-service';
  if (filePath.includes('user-service'))     return 'user-service';
  if (filePath.includes('cart-service'))     return 'cart-service';
  if (filePath.includes('order-service'))    return 'order-service';
  if (filePath.includes('payment-service'))  return 'payment-service';
  if (filePath.includes('api-gateway'))      return 'api-gateway';
  if (filePath.includes('smartops-agent'))   return 'smartops-agent';
  if (filePath.includes('e-commerce-main'))  return 'frontend';
  if (filePath.includes('k8s'))              return 'kubernetes';
  return 'other';
}

function shouldIndex(filePath) {
  if (SKIP_DIRS.some(d => filePath.includes(`${d}/`))) return false;
  return INDEXABLE_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

// ---------------------------------------------------------------------------
// Index the full repo (runs once at agent startup).
// ---------------------------------------------------------------------------
async function indexFullRepo() {
  console.log('[INDEXER] Starting full repository index (function-level LLMWiki)...');
  const t0 = Date.now();

  try {
    const allFiles     = await github.listFiles();
    const indexable    = allFiles.filter(shouldIndex);
    console.log(`[INDEXER] Found ${indexable.length} indexable files out of ${allFiles.length} total`);

    const allChunks = [];

    for (const filePath of indexable) {
      try {
        const content = await github.getFileContent(filePath);
        const chunks  = chunkFile(filePath, content);
        allChunks.push(...chunks);
      } catch (err) {
        console.warn(`[INDEXER] Skipping ${filePath}: ${err.message?.substring(0, 60)}`);
      }
      await new Promise(r => setTimeout(r, 150)); // GitHub rate limit
    }

    console.log(`[INDEXER] Generated ${allChunks.length} chunks, generating embeddings...`);
    await embedAndUpsert(allChunks);
    console.log(`[INDEXER] Full index complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    await logAuditEvent({
      incidentId: 'SYSTEM',
      actionType: 'VECTOR_QUERY',
      metadata: { operation: 'full_index', fileCount: indexable.length, chunkCount: allChunks.length },
    });
  } catch (err) {
    console.error('[INDEXER] Full index failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Incremental index — re-index only changed files (called on git push).
// ---------------------------------------------------------------------------
async function indexChangedFiles(changedFiles) {
  console.log(`[INDEXER] Incremental index for ${changedFiles.length} changed files`);

  for (const filePath of changedFiles) {
    if (!shouldIndex(filePath)) continue;
    try {
      await pinecone.deleteByFilePrefix(filePath);
      const content = await github.getFileContent(filePath);
      const chunks  = chunkFile(filePath, content);
      await embedAndUpsert(chunks);
      console.log(`[INDEXER] Re-indexed ${filePath} (${chunks.length} chunks)`);
    } catch (err) {
      console.warn(`[INDEXER] Failed to re-index ${filePath}:`, err.message?.substring(0, 80));
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

// ---------------------------------------------------------------------------
// Helper: embed + upsert in batches.
// ---------------------------------------------------------------------------
async function embedAndUpsert(chunks) {
  const texts = chunks.map(c => `${c.metadata.filePath} ${c.metadata.functionName || ''}\n${c.content}`.substring(0, 480));
  const embeddings = await generateEmbeddings(texts);

  const valid = [];
  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i]?.embedding;
    if (emb && emb.some(v => v !== 0)) {
      chunks[i].embedding = emb;
      valid.push(chunks[i]);
    }
  }
  if (valid.length > 0) await pinecone.upsertChunks(valid);
  return valid.length;
}

module.exports = { indexFullRepo, indexChangedFiles };
