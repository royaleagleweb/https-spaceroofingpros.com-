/* ============================================================
   Space Roofing Pros — contract delivery Worker
   ------------------------------------------------------------
   POST /api/send-contract   (Bearer OPERATOR_TOKEN)
       body: { contract }
       -> emails the contract to the client with a signing link
       -> { ok: true, signUrl }

   POST /api/sign            (public, HMAC-protected)
       body: { p, s, signature, signerName, signedAt }
       -> verifies the link signature, emails the signed copy to
          the client and to the company
       -> { ok: true }

   GET  /api/health          -> { ok: true }

   The contract itself travels inside the signing link (HMAC'd),
   so no database is required.
   ============================================================ */

import { renderContract, renderEmail, normalize, money } from '../../assets/js/contract-template.js';

/* ---------------- encoding helpers ---------------- */

const enc = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function encodePayload(obj) {
  return b64url(enc.encode(JSON.stringify(obj)));
}

function decodePayload(str) {
  return JSON.parse(new TextDecoder().decode(unb64url(str)));
}

/* ---------------- HMAC ---------------- */

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(secret, message) {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message));
  return b64url(new Uint8Array(mac));
}

/** Constant-time-ish comparison — avoids leaking the signature via timing. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------- HTTP helpers ---------------- */

function corsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const allow = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0] || '');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, env, request) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(env, request)),
  });
}

/* ---------------- Resend ---------------- */

async function sendEmail(env, { to, subject, html, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: replyTo || env.COMPANY_EMAIL,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`email provider rejected the message (${res.status}) ${detail.slice(0, 300)}`);
  }
  return res.json();
}

/* ---------------- Validation ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateContract(c) {
  if (!c || typeof c !== 'object') return 'contract payload missing';
  if (!c.clientName || String(c.clientName).trim().length < 2) return 'client name missing';
  if (!EMAIL_RE.test(String(c.clientEmail || '').trim())) return 'client email is not valid';
  if (!c.address) return 'property address missing';
  if (!(Number(c.total) > 0)) return 'contract total must be greater than zero';
  if (JSON.stringify(c).length > 60000) return 'contract payload is too large';
  return null;
}

function requireEnv(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  return missing.length ? `Worker is missing secrets: ${missing.join(', ')}` : null;
}

/* ============================================================
   Routes
   ============================================================ */

async function handleSendContract(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.OPERATOR_TOKEN || !safeEqual(token, env.OPERATOR_TOKEN)) {
    return json({ ok: false, error: 'unauthorized' }, 401, env, request);
  }

  const missing = requireEnv(env, ['RESEND_API_KEY', 'FROM_EMAIL', 'COMPANY_EMAIL', 'SIGNING_SECRET', 'SITE_URL']);
  if (missing) return json({ ok: false, error: missing }, 500, env, request);

  const body = await request.json().catch(() => null);
  const contract = normalize((body && body.contract) || {});
  const bad = validateContract(contract);
  if (bad) return json({ ok: false, error: bad }, 400, env, request);

  const payload = encodePayload(contract);
  const mac = await sign(env.SIGNING_SECRET, payload);
  const workerOrigin = new URL(request.url).origin;
  const signUrl = `${env.SITE_URL.replace(/\/$/, '')}/contract-sign.html`
    + `#p=${payload}&s=${mac}&api=${encodeURIComponent(workerOrigin)}`;

  await sendEmail(env, {
    to: contract.clientEmail,
    subject: `Your Roofing Agreement — ${contract.contractNo}`,
    html: renderEmail(contract, signUrl),
    replyTo: env.COMPANY_EMAIL,
  });

  // Keep the office in the loop without blocking the operator's response.
  const officeCopy = sendEmail(env, {
    to: env.COMPANY_EMAIL,
    subject: `Contract sent — ${contract.clientName} — ${money(contract.total)} (${contract.contractNo})`,
    html: `<p>Contract <b>${contract.contractNo}</b> was sent to ${contract.clientEmail}.</p>
      <p><a href="${signUrl}">Signing link</a></p>${renderContract(contract)}`,
  }).catch(() => {});

  return json({ ok: true, signUrl, contractNo: contract.contractNo }, 200, env, request);
}

async function handleSign(request, env) {
  const missing = requireEnv(env, ['RESEND_API_KEY', 'FROM_EMAIL', 'COMPANY_EMAIL', 'SIGNING_SECRET']);
  if (missing) return json({ ok: false, error: missing }, 500, env, request);

  const body = await request.json().catch(() => null);
  if (!body || !body.p || !body.s) return json({ ok: false, error: 'missing link data' }, 400, env, request);

  const expected = await sign(env.SIGNING_SECRET, body.p);
  if (!safeEqual(body.s, expected)) {
    return json({ ok: false, error: 'this signing link is not valid' }, 403, env, request);
  }

  let contract;
  try { contract = normalize(decodePayload(body.p)); }
  catch { return json({ ok: false, error: 'this signing link is corrupted' }, 400, env, request); }

  const signerName = String(body.signerName || '').trim();
  const signature = String(body.signature || '');
  if (signerName.length < 3) return json({ ok: false, error: 'signer name is required' }, 400, env, request);
  if (!signature.startsWith('data:image/png;base64,') || signature.length > 400000) {
    return json({ ok: false, error: 'signature image is missing or too large' }, 400, env, request);
  }

  const signedAt = new Date().toISOString();
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const html = renderContract(contract, { signature, signerName, signedAt, ip });

  // Recipients are fixed: the company address from config, and the client
  // address baked into the HMAC-verified payload. Nothing else is reachable.
  await sendEmail(env, {
    to: [env.COMPANY_EMAIL, contract.clientEmail],
    subject: `SIGNED — ${contract.contractNo} — ${signerName}`,
    html: `<p style="font-family:Inter,sans-serif;">${signerName} signed contract
      <b>${contract.contractNo}</b> on ${new Date(signedAt).toUTCString()}${ip ? ` from IP ${ip}` : ''}.</p>${html}`,
  });

  return json({ ok: true, contractNo: contract.contractNo, signedAt }, 200, env, request);
}

/* ============================================================
   Entry point
   ============================================================ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'srp-contracts' }, 200, env, request);
      }
      if (url.pathname === '/api/send-contract' && request.method === 'POST') {
        return await handleSendContract(request, env);
      }
      if (url.pathname === '/api/sign' && request.method === 'POST') {
        return await handleSign(request, env);
      }
      return json({ ok: false, error: 'not found' }, 404, env, request);
    } catch (err) {
      console.error('contract worker error', err && err.stack ? err.stack : err);
      return json({ ok: false, error: err.message || 'unexpected error' }, 500, env, request);
    }
  },
};
