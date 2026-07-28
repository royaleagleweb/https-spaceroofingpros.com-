/* ============================================================
   Space Roofing Pros — client signing page
   Reads the contract from the URL fragment (never sent to a
   server in a request line), renders it, captures a signature,
   and posts it back to the Worker for delivery.

   Link shape: contract-sign.html#p=<payload>&s=<hmac>&api=<origin>
   ============================================================ */

import { renderContract, normalize, money, esc } from './contract-template.js';

const $ = (id) => document.getElementById(id);
const main = $('main');
const elToast = $('toast');

/* ---------------- base64url <-> object ---------------- */

function decodePayload(b64) {
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function toast(msg, kind) {
  elToast.textContent = msg;
  elToast.className = `toast is-on${kind ? ` toast--${kind}` : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { elToast.className = 'toast'; }, 4200);
}

function fail(msg) {
  main.innerHTML = `<div class="sign-card"><h2 style="margin-top:0;">This link isn't valid</h2>
    <p>${esc(msg)}</p>
    <p>Please contact us at <a href="tel:+13055551234">(305) 555-1234</a> or
    <a href="mailto:info@spaceroofingpros.com">info@spaceroofingpros.com</a> and we'll send a fresh link.</p></div>`;
}

/* ---------------- Boot ---------------- */

const params = new URLSearchParams(location.hash.slice(1));
const api = params.get('api') || '';
const sig = params.get('s') || '';

let contract = null;
try {
  const raw = params.get('p');
  if (!raw) throw new Error('missing payload');
  contract = normalize(decodePayload(raw));
} catch {
  fail('The contract link looks incomplete or was cut off by your email app. Copy the full link and try again.');
}

if (contract) start();

function start() {

main.innerHTML = $('tpl').innerHTML;
$('doc').innerHTML = renderContract(contract);
$('signer').value = contract.clientName || '';
document.title = `Sign Contract ${contract.contractNo} — Space Roofing Pros`;

/* ---------------- Signature pad ---------------- */

const pad = $('pad');
const ctx = pad.getContext('2d');
let drawing = false;
let hasInk = false;

function sizePad() {
  const dpr = window.devicePixelRatio || 1;
  const rect = pad.getBoundingClientRect();
  const prev = hasInk ? pad.toDataURL() : null;
  pad.width = Math.round(rect.width * dpr);
  pad.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#112233';
  if (prev) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = prev;
  }
}

function pos(e) {
  const r = pad.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

pad.addEventListener('pointerdown', (e) => {
  drawing = true;
  pad.setPointerCapture(e.pointerId);
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

pad.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  if (!hasInk) { hasInk = true; pad.classList.add('is-drawn'); }
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
  pad.addEventListener(ev, () => { drawing = false; });
});

$('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, pad.width, pad.height);
  hasInk = false;
  pad.classList.remove('is-drawn');
});

sizePad();
window.addEventListener('resize', sizePad);

/* ---------------- Submit ---------------- */

let busy = false;

$('submit').addEventListener('click', async () => {
  if (busy) return;

  const signer = $('signer').value.trim();
  $('e_signer').textContent = '';
  $('e_form').textContent = '';

  if (signer.length < 3) { $('e_signer').textContent = 'Please enter your full legal name.'; $('signer').focus(); return; }
  if (!hasInk) { $('e_form').textContent = 'Please draw your signature above.'; return; }
  if (!$('agree').checked) { $('e_form').textContent = 'Please check the box to confirm you agree.'; return; }

  const signature = pad.toDataURL('image/png');
  const signedAt = new Date().toISOString();
  const btn = $('submit');

  // No Worker behind this link — let the client return the signed copy themselves.
  if (!api) {
    $('doc').innerHTML = renderContract(contract, { signature, signerName: signer, signedAt });
    window.print();
    window.location.href = `mailto:${encodeURIComponent(contract.company.email)}`
      + `?subject=${encodeURIComponent(`Signed Contract ${contract.contractNo} — ${signer}`)}`
      + `&body=${encodeURIComponent(`Attached is my signed contract ${contract.contractNo}.\n\n${signer}`)}`;
    toast('Save the PDF and attach it to the email that just opened.');
    return;
  }

  busy = true;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Sending…';

  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/api/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: params.get('p'), s: sig, signature, signerName: signer, signedAt }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `Error ${res.status}`);

    main.innerHTML = `<div class="sign-card done">
      <div class="done__mark">✓</div>
      <h1 style="font-size:1.5rem;">Thank you, ${esc(signer.split(' ')[0])}!</h1>
      <p>Contract <b>${esc(contract.contractNo)}</b> is signed. A copy is on its way to
      <b>${esc(contract.clientEmail)}</b>.</p>
      <p>We'll reach out shortly to confirm your start date of
      <b>${esc(contract.startDate || 'the scheduled day')}</b>.</p>
      <p style="margin-top:22px;"><a class="btn btn--navy" href="tel:+13055551234">📞 (305) 555-1234</a></p>
    </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    $('e_form').textContent = `We couldn't submit your signature: ${err.message}. Please try again or call us.`;
    btn.disabled = false;
    btn.innerHTML = 'Sign &amp; Return Contract';
    busy = false;
  }
});

} // end start()
