const api = typeof browser !== 'undefined' ? browser : chrome;

const ALLOWED_PAGE_ORIGIN_PATTERNS = [
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i,
  /^https?:\/\/[a-z0-9-]+\.ipns\.localhost(?::\d+)?$/i,
  /^https?:\/\/[a-z0-9-]+\.ipfs\.localhost(?::\d+)?$/i
];

const ALLOWED_API_BASES = new Set([
  'http://127.0.0.1:5001',
  'http://localhost:5001'
]);

const ALLOWED_API_PATHS = new Set([
  '/api/v0/key/list',
  '/api/v0/key/gen',
  '/api/v0/name/publish',
  '/api/v0/name/resolve',
  '/api/v0/add',
  '/api/v0/cat',
  '/api/v0/dag/get',
  '/api/v0/dag/put'
]);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyAllowedKeys(obj, allowedKeys) {
  return Object.keys(obj).every((key) => allowedKeys.includes(key));
}

function parseQuery(queryString) {
  const params = new URLSearchParams(String(queryString || ''));
  const out = {};
  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      if (Array.isArray(out[key])) out[key].push(value);
      else out[key] = [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isValidAlias(value) {
  return /^[a-zA-Z0-9_-]{2,64}$/.test(String(value || ''));
}

function validateRequest(path, queryObj, bodyDesc) {
  if (!ALLOWED_API_PATHS.has(path)) {
    throw new Error(`API path not allowed: ${path}`);
  }

  if (path === '/api/v0/key/list') {
    if (!hasOnlyAllowedKeys(queryObj, ['l'])) throw new Error('Invalid key/list query args.');
    if (queryObj.l !== undefined && String(queryObj.l) !== 'true') throw new Error('key/list only allows l=true.');
    if (bodyDesc?.kind !== 'none') throw new Error('key/list does not accept body.');
    return;
  }

  if (path === '/api/v0/key/gen') {
    if (!hasOnlyAllowedKeys(queryObj, ['arg', 'type'])) throw new Error('Invalid key/gen query args.');
    if (!isValidAlias(queryObj.arg)) throw new Error('Invalid key alias.');
    if (String(queryObj.type || '') !== 'ed25519') throw new Error('Only ed25519 key type is allowed.');
    if (bodyDesc?.kind !== 'none') throw new Error('key/gen does not accept body.');
    return;
  }

  if (path === '/api/v0/name/publish') {
    if (!hasOnlyAllowedKeys(queryObj, ['arg', 'key', 'lifetime'])) throw new Error('Invalid name/publish query args.');
    if (!String(queryObj.arg || '').startsWith('/ipfs/')) throw new Error('name/publish arg must be /ipfs/<cid>.');
    if (!isValidAlias(queryObj.key)) throw new Error('Invalid publish key alias.');
    if (queryObj.lifetime !== undefined && !/^\d+[smhd]$/i.test(String(queryObj.lifetime))) {
      throw new Error('Invalid lifetime format for name/publish.');
    }
    if (bodyDesc?.kind !== 'none') throw new Error('name/publish does not accept body.');
    return;
  }

  if (path === '/api/v0/name/resolve') {
    if (!hasOnlyAllowedKeys(queryObj, ['arg', 'recursive'])) throw new Error('Invalid name/resolve query args.');
    if (!String(queryObj.arg || '').startsWith('/ipns/')) throw new Error('name/resolve arg must be /ipns/<name>.');
    if (queryObj.recursive !== undefined && !['true', 'false'].includes(String(queryObj.recursive))) {
      throw new Error('name/resolve recursive must be true|false.');
    }
    if (bodyDesc?.kind !== 'none') throw new Error('name/resolve does not accept body.');
    return;
  }

  if (path === '/api/v0/add') {
    if (!hasOnlyAllowedKeys(queryObj, ['pin'])) throw new Error('Invalid add query args.');
    if (queryObj.pin !== undefined && !['true', 'false'].includes(String(queryObj.pin))) {
      throw new Error('add pin must be true|false.');
    }
    if (!isPlainObject(bodyDesc) || bodyDesc.kind !== 'formData' || !Array.isArray(bodyDesc.entries) || bodyDesc.entries.length === 0) {
      throw new Error('add requires FormData body.');
    }
    return;
  }

  if (path === '/api/v0/cat') {
    if (!hasOnlyAllowedKeys(queryObj, ['arg'])) throw new Error('Invalid cat query args.');
    if (!String(queryObj.arg || '').startsWith('/ipfs/')) throw new Error('cat arg must be /ipfs/<cid...>.');
    if (bodyDesc?.kind !== 'none') throw new Error('cat does not accept body.');
    return;
  }

  if (path === '/api/v0/dag/get') {
    if (!hasOnlyAllowedKeys(queryObj, ['arg', 'output-codec'])) throw new Error('Invalid dag/get query args.');
    if (!String(queryObj.arg || '').trim()) throw new Error('dag/get requires arg.');
    if (queryObj['output-codec'] !== undefined && !String(queryObj['output-codec']).trim()) {
      throw new Error('Invalid dag/get output-codec.');
    }
    if (bodyDesc?.kind !== 'none') throw new Error('dag/get does not accept body.');
    return;
  }

  if (path === '/api/v0/dag/put') {
    if (!hasOnlyAllowedKeys(queryObj, ['store-codec', 'input-codec', 'pin', 'hash'])) {
      throw new Error('Invalid dag/put query args.');
    }
    if (queryObj['store-codec'] !== undefined && !String(queryObj['store-codec']).trim()) {
      throw new Error('Invalid dag/put store-codec.');
    }
    if (queryObj['input-codec'] !== undefined && !String(queryObj['input-codec']).trim()) {
      throw new Error('Invalid dag/put input-codec.');
    }
    if (queryObj.pin !== undefined && !['true', 'false'].includes(String(queryObj.pin))) {
      throw new Error('dag/put pin must be true|false.');
    }
    if (queryObj.hash !== undefined && !String(queryObj.hash).trim()) {
      throw new Error('Invalid dag/put hash.');
    }
    if (!isPlainObject(bodyDesc) || bodyDesc.kind !== 'formData' || !Array.isArray(bodyDesc.entries) || bodyDesc.entries.length === 0) {
      throw new Error('dag/put requires FormData body.');
    }
  }
}

function buildFetchBody(bodyDesc) {
  if (!isPlainObject(bodyDesc)) return undefined;
  if (bodyDesc.kind === 'none') return undefined;
  if (bodyDesc.kind === 'text') return String(bodyDesc.text || '');
  if (bodyDesc.kind === 'formData') {
    const fd = new FormData();
    for (const entry of bodyDesc.entries || []) {
      if (!isPlainObject(entry) || typeof entry.name !== 'string') continue;
      if (entry.type === 'text') {
        fd.append(entry.name, String(entry.value || ''));
      } else if (entry.type === 'file') {
        const blob = new Blob([String(entry.value || '')], {
          type: String(entry.contentType || 'application/octet-stream')
        });
        fd.append(entry.name, blob, String(entry.filename || 'upload.bin'));
      }
    }
    return fd;
  }
  return undefined;
}

function isAllowedPageOrigin(origin) {
  return ALLOWED_PAGE_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function normalizeBase(base) {
  return String(base || '').replace(/\/$/, '');
}

async function handleProxyRequest(message, sender) {
  const request = message?.payload || {};
  const senderUrl = sender?.url || '';
  let senderOrigin = '';

  const explicitPageOrigin = String(request.pageOrigin || '').trim();
  if (explicitPageOrigin) {
    senderOrigin = explicitPageOrigin;
  } else {
    try {
      senderOrigin = new URL(senderUrl).origin;
    } catch (_) {
      throw new Error(`Missing/invalid sender origin (sender.url='${senderUrl || 'n/a'}').`);
    }
  }

  if (!isAllowedPageOrigin(senderOrigin)) {
    throw new Error(`Origin not allowed by extension policy: ${senderOrigin}`);
  }

  const base = normalizeBase(request.base || 'http://127.0.0.1:5001');
  if (!ALLOWED_API_BASES.has(base)) {
    throw new Error(`API base not allowed: ${base}`);
  }

  const path = String(request.path || '').trim();
  const query = request.query || '';
  const queryObj = parseQuery(query);
  const bodyDesc = isPlainObject(request.body) ? request.body : { kind: 'none' };
  validateRequest(path, queryObj, bodyDesc);

  const url = `${base}${path}${query ? `?${query}` : ''}`;

  const fetchOptions = { method: 'POST' };
  const fetchBody = buildFetchBody(bodyDesc);
  if (fetchBody !== undefined) {
    fetchOptions.body = fetchBody;
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Kubo API ${response.status}: ${text || response.statusText}`);
  }

  if (path === '/api/v0/cat') {
    return { __rawText: text };
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Kubo API returned non-JSON response: ${text || '(empty body)'}`);
  }
}

async function handleSelfTest() {
  const url = 'http://127.0.0.1:5001/api/v0/key/list?l=true';
  const response = await fetch(url, { method: 'POST' });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Self-test failed: Kubo API ${response.status}: ${text || response.statusText}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error('Self-test failed: non-JSON response from Kubo API.');
  }
  const keyCount = Array.isArray(parsed?.Keys) ? parsed.Keys.length : 0;
  return { keyCount };
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'MA_KUBO_PROXY') {
    handleProxyRequest(message, sender)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === 'MA_KUBO_SELF_TEST') {
    handleSelfTest()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  return false;
});
