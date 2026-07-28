/* ============================================================
   Easy Pergola — contract intake engine
   ------------------------------------------------------------
   Flow:
     Steps 1-9   intake
     Step 10     the finished contract, adjustable (price, terms,
                 scope, dates) with a live rebuild
     Step 11     the contractor countersigns
     Step 12     send to the client for their signature
   The operator can email themselves a copy at any point from
   step 10 onward.
   ============================================================ */

import {
  PROJECT_TYPES, PERMIT_OPTIONS, renderContract, normalize, money, esc,
} from './pergola-template.js';
import { createSignaturePad } from './signature-pad.js';

const DRAFT_KEY = 'ep.contract.draft';
const CFG_KEY = 'ep.contract.config';

const $ = (id) => document.getElementById(id);
const form = $('form');
const steps = [...document.querySelectorAll('.step')];
const INTAKE_STEPS = 10;          // steps 1-10 drive the progress bar
const REVIEW = 9;                 // index of the "contract is ready" step
const SIGN = 10;                  // countersign
const SEND = 11;                  // send to client
const DONE = 12;

let current = 0;
let pad = null;
let busy = false;

/* ---------------- Config ---------------- */

const cfg = Object.assign(
  { endpoint: '', token: '', myEmail: '', company: {} },
  readJSON(CFG_KEY)
);

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || {}; }
  catch { return {}; }
}

function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

/* ---------------- Data ---------------- */

let data = normalize(Object.assign({ warrantyYears: 1 }, readJSON(DRAFT_KEY)));

function collect() {
  const entries = Object.fromEntries(new FormData(form).entries());
  data = normalize(Object.assign({}, data, entries, { company: cfg.company }));
  saveDraft();
  return data;
}

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

/** Push saved values back into the intake inputs (draft restore, review edits). */
function hydrate() {
  Object.entries(data).forEach(([k, v]) => {
    const el = form.elements[k];
    if (el && typeof v !== 'object' && v != null) el.value = v;
  });
  document.querySelectorAll('.choices').forEach((group) => {
    const val = data[group.dataset.name];
    group.querySelectorAll('.choice').forEach((ch) => {
      ch.classList.toggle('selected', ch.dataset.value === val);
    });
  });
}

/* ---------------- Choice tiles ---------------- */

function buildChoices(name, list) {
  const group = document.querySelector(`.choices[data-name="${name}"]`);
  group.innerHTML = list.map((o) =>
    `<button type="button" class="choice" data-value="${esc(o.id)}">${esc(o.label)}`
    + `<small>${esc(o.note)}</small></button>`).join('');
  group.addEventListener('click', (e) => {
    const choice = e.target.closest('.choice');
    if (!choice) return;
    group.querySelectorAll('.choice').forEach((c) => c.classList.remove('selected'));
    choice.classList.add('selected');
    form.elements[name].value = choice.dataset.value;
    clearError();
  });
}

buildChoices('projectType', PROJECT_TYPES);
buildChoices('permit', PERMIT_OPTIONS);

/* ---------------- Validation ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RULES = {
  0: () => {
    const f = form.elements;
    if (f.clientName.value.trim().length < 2) return 'Enter the client\'s full name.';
    if (f.clientPhone.value.replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
    if (!EMAIL_RE.test(f.clientEmail.value.trim())) return 'Enter a valid email address.';
    return null;
  },
  1: () => {
    const f = form.elements;
    if (!f.address.value.trim()) return 'Enter the street address.';
    if (!f.city.value.trim()) return 'Enter the city.';
    if (!/^\d{5}(-\d{4})?$/.test(f.zip.value.trim())) return 'Enter a 5-digit ZIP code.';
    return null;
  },
  2: () => (form.elements.projectType.value ? null : 'Choose a project type.'),
  3: () => (form.elements.projectDescription.value.trim().length > 5
    ? null : 'Describe the project so the scope of work is clear.'),
  4: () => (form.elements.permit.value ? null : 'Choose who handles permits.'),
  5: () => (form.elements.included.value.trim() ? null : 'List what is included.'),
  7: () => {
    const price = Number(form.elements.price.value);
    const deposit = Number(form.elements.deposit.value || 0);
    if (!(price > 0)) return 'Enter the contract price.';
    if (deposit > price) return 'The deposit cannot exceed the contract price.';
    return null;
  },
  8: () => (form.elements.startDate.value ? null : 'Pick an estimated start date.'),
};

function showError(msg) {
  const box = steps[current].querySelector('[data-err]');
  if (box) box.textContent = msg;
}

function clearError() {
  steps.forEach((s) => {
    const box = s.querySelector('[data-err]');
    if (box) box.textContent = '';
  });
}

/* ---------------- Navigation ---------------- */

function show(i) {
  steps.forEach((s, x) => s.classList.toggle('active', x === i));
  current = i;
  clearError();

  const onIntake = i < INTAKE_STEPS;
  $('plabel').textContent = onIntake ? `${i + 1} of ${INTAKE_STEPS}`
    : (i === DONE ? 'Complete' : i === SIGN ? 'Your signature' : 'Send');
  $('bar').style.width = `${Math.min(100, ((i + 1) / INTAKE_STEPS) * 100)}%`;

  $('back').style.visibility = (i === 0 || i === DONE) ? 'hidden' : 'visible';
  $('next').style.display = i >= REVIEW ? 'none' : 'inline-block';
  document.querySelector('.hint').style.display = i >= REVIEW ? 'none' : '';

  if (i === REVIEW) buildReview();
  if (i === SIGN) buildSign();
  if (i === SEND) buildSend();

  const firstInput = steps[i].querySelector('input:not([type=hidden]), textarea');
  if (firstInput && !firstInput.value) firstInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('next').onclick = () => {
  const rule = RULES[current];
  const err = rule ? rule() : null;
  if (err) { showError(err); return; }
  collect();
  if (current < REVIEW) show(current + 1);
};

$('back').onclick = () => { if (current > 0) show(current - 1); };

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
  if (!$('settings').hidden) return;
  if (current >= REVIEW) return;
  e.preventDefault();
  $('next').click();
});

/* ============================================================
   Step 10 — the finished contract, adjustable
   ============================================================ */

const ADJUSTABLE = [
  ['price', 'Contract price ($)', 'number'],
  ['deposit', 'Deposit ($)', 'number'],
  ['startDate', 'Estimated start', 'date'],
  ['durationDays', 'Working days', 'number'],
  ['warrantyYears', 'Warranty (years)', 'number'],
  ['manufacturerWarranty', 'Manufacturer warranty', 'text'],
  ['clientName', 'Client name', 'text'],
  ['clientEmail', 'Client email', 'email'],
  ['clientPhone', 'Client phone', 'tel'],
  ['address', 'Property address', 'text'],
  ['city', 'City', 'text'],
  ['zip', 'ZIP', 'text'],
];

const ADJUSTABLE_LONG = [
  ['projectDescription', 'Project description'],
  ['included', 'Included'],
  ['excluded', 'Excluded'],
  ['paymentSchedule', 'Payment milestones'],
];

function buildReview() {
  collect();
  $('deliveryNote').innerHTML = cfg.endpoint && cfg.token
    ? `Adjust anything below — the contract rebuilds as you type. When it looks right, continue to sign it.`
    : `Adjust anything below — the contract rebuilds as you type. One-click emailing is not configured yet, so
       sending will open a prepared email instead. Set it up under ⚙.`;

  const box = $('adjust');
  box.innerHTML = `
    <div class="adjust-grid">
      ${ADJUSTABLE.map(([k, label, type]) => `
        <div class="adjust-field">
          <label for="adj_${k}">${esc(label)}</label>
          <input id="adj_${k}" data-adj="${k}" type="${type}"
                 value="${esc(data[k] == null ? '' : data[k])}"
                 ${type === 'number' ? 'min="0" step="0.01"' : ''}>
        </div>`).join('')}
      <div class="adjust-field">
        <label for="adj_permit">Permits</label>
        <select id="adj_permit" data-adj="permit">
          ${PERMIT_OPTIONS.map((o) => `<option value="${esc(o.id)}"${
            data.permit === o.id ? ' selected' : ''}>${esc(o.label)} — ${esc(o.note)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${ADJUSTABLE_LONG.map(([k, label]) => `
      <div class="adjust-field" style="margin-top:12px;">
        <label for="adj_${k}">${esc(label)}</label>
        <textarea id="adj_${k}" data-adj="${k}" style="min-height:76px;font-size:15px;">${esc(data[k] || '')}</textarea>
      </div>`).join('')}`;

  box.querySelectorAll('[data-adj]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.adj;
      data[key] = el.value;
      const mirror = form.elements[key];
      if (mirror) mirror.value = el.value;
      data = normalize(data);
      saveDraft();
      paint();
    });
  });

  paint();
}

function paint() {
  $('contractBox').innerHTML = renderContract(data);
}

/* ============================================================
   Step 11 — contractor countersignature
   ============================================================ */

function buildSign() {
  collect();
  $('signWho').textContent = cfg.company.legal || 'Easy Pergola LLC';
  if (!pad) {
    pad = createSignaturePad($('epPad'), {
      color: '#222',
      onChange: (ink) => { $('signNext').disabled = !ink; },
    });
    $('epClear').onclick = () => pad.clear();
  }
  $('signNext').disabled = !pad.hasInk;
  $('signerName').value = data.contractorName || cfg.company.legal || '';
}

$('signNext').onclick = () => {
  const name = $('signerName').value.trim();
  if (name.length < 2) { $('signErr').textContent = 'Enter the name of the person signing.'; return; }
  if (!pad || !pad.hasInk) { $('signErr').textContent = 'Draw your signature above.'; return; }
  $('signErr').textContent = '';
  data.contractorSignature = pad.toDataURL();
  data.contractorName = name;
  data.contractorSignedAt = new Date().toISOString().slice(0, 10);
  saveDraft();
  show(SEND);
};

$('signSkip').onclick = () => {
  delete data.contractorSignature;
  delete data.contractorName;
  saveDraft();
  show(SEND);
};

/* ============================================================
   Step 12 — send to the client
   ============================================================ */

function buildSend() {
  $('sendPreview').innerHTML = renderContract(data);
  $('sendTo').textContent = data.clientEmail;
  $('sendSummary').textContent =
    `${data.projectType} · ${money(data.price)} · ${data.contractorSignature ? 'signed by you' : 'not signed by you'}`;
  $('sendClientBtn').disabled = false;
  $('sendClientBtn').innerHTML = '📤 Send to client for signature';
}

/* ---------------- Delivery ---------------- */

function configured() { return !!(cfg.endpoint && cfg.token); }

async function post(path, body) {
  const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(out.error || `Error ${res.status}`);
  return out;
}

async function withBusy(btn, label, fn) {
  if (busy) return;
  busy = true;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>${label}`;
  try {
    await fn();
  } catch (err) {
    alert(`That didn't go through: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = original;
  } finally {
    busy = false;
  }
}

/** Email the operator their own copy. */
function sendToMe() {
  collect();
  const to = cfg.myEmail || cfg.company.email;
  if (!to) { openSettings(); alert('Add the address to send your copy to, under Settings.'); return; }

  if (!configured()) {
    window.print();
    window.location.href = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(`Contract ${data.contractNo} — ${data.clientName}`)}`
      + `&body=${encodeURIComponent(
        `Contract ${data.contractNo}\n${data.clientName} — ${data.address}, ${data.city}\n`
        + `${data.projectType}\nTotal: ${money(data.price)}\n\nSave the PDF and attach it.`)}`;
    return;
  }

  withBusy($('sendMe'), 'Sending…', async () => {
    await post('/api/send-contract', { contract: data, recipient: 'me' });
    $('sendMe').innerHTML = '✅ Sent to you';
  });
}

/** Email the client, with a link to add their signature. */
function sendToClient() {
  collect();
  if (!configured()) {
    window.print();
    window.location.href = `mailto:${encodeURIComponent(data.clientEmail)}`
      + `?subject=${encodeURIComponent(`Your Easy Pergola Contract — ${data.contractNo}`)}`
      + `&body=${encodeURIComponent(
        `Hi ${(data.clientName || '').split(' ')[0]},\n\n`
        + `Your contract (${data.contractNo}) for the ${data.projectType} at ${data.address} is attached.\n`
        + `Total: ${money(data.price)}\n\nPlease review, sign, and send it back.\n\n`
        + `${cfg.company.name || 'Easy Pergola'}`)}`;
    finish('Prepared for the client',
      `Save the PDF and attach it to the email that just opened. Set up one-click sending under ⚙ to skip this step.`);
    return;
  }

  withBusy($('sendClientBtn'), 'Sending…', async () => {
    const out = await post('/api/send-contract', { contract: data, recipient: 'client' });
    finish('Sent to the client',
      `${data.clientName} received contract ${data.contractNo} at ${data.clientEmail} with a link to sign it. `
      + `The fully executed copy lands in your inbox the moment they do.`, out.signUrl);
  });
}

function finish(title, text, signUrl) {
  $('doneTitle').textContent = title;
  $('doneText').innerHTML = esc(text)
    + (signUrl ? `<br><br><a href="${esc(signUrl)}" target="_blank" rel="noopener">Open the signing link</a>` : '');
  show(DONE);
}

$('sendMe').onclick = sendToMe;
$('sendClientBtn').onclick = sendToClient;
$('download').onclick = () => { collect(); window.print(); };
$('reviewNext').onclick = () => { collect(); show(SIGN); };

$('copy').onclick = async () => {
  collect();
  const html = renderContract(data);
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([$('contractBox').innerText], { type: 'text/plain' }),
    })]);
    $('copy').textContent = '✅ Copied';
    setTimeout(() => { $('copy').textContent = '📋 Copy for email'; }, 2500);
  } catch {
    await navigator.clipboard.writeText($('contractBox').innerText).catch(() => {});
    $('copy').textContent = '✅ Copied as text';
  }
};

$('startNew').onclick = () => {
  localStorage.removeItem(DRAFT_KEY);
  location.reload();
};

/* ---------------- Settings ---------------- */

const SET_FIELDS = {
  setName: 'name', setLegal: 'legal', setLicense: 'license', setPhone: 'phone',
  setEmail: 'email', setAddress: 'address', setCity: 'city', setZip: 'zip',
};

function openSettings() {
  const base = normalize({}).company;
  $('setMyEmail').value = cfg.myEmail || '';
  $('setEndpoint').value = cfg.endpoint || '';
  $('setToken').value = cfg.token || '';
  Object.entries(SET_FIELDS).forEach(([id, key]) => {
    $(id).value = (cfg.company && cfg.company[key]) || base[key] || '';
  });
  $('settings').hidden = false;
}

$('gear').onclick = openSettings;
$('setCancel').onclick = () => { $('settings').hidden = true; };
$('settings').addEventListener('click', (e) => {
  if (e.target === $('settings')) $('settings').hidden = true;
});

$('setSave').onclick = () => {
  cfg.myEmail = $('setMyEmail').value.trim();
  cfg.endpoint = $('setEndpoint').value.trim().replace(/\/$/, '');
  cfg.token = $('setToken').value.trim();
  cfg.company = cfg.company || {};
  Object.entries(SET_FIELDS).forEach(([id, key]) => { cfg.company[key] = $(id).value.trim(); });
  saveCfg();
  $('settings').hidden = true;
  data = normalize(Object.assign(data, { company: cfg.company }));
  if (current === REVIEW) paint();
  if (current === SEND) buildSend();
};

/* ---------------- Boot ---------------- */

// A contract mailed to the operator carries a #review= link so they can pick it
// up on any device and continue from the adjust step.
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('review')) {
  try {
    const bin = atob(hash.get('review').replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    data = normalize(JSON.parse(new TextDecoder().decode(bytes)));
    saveDraft();
  } catch { /* fall through to a normal start */ }
}

hydrate();
show(data.price > 0 && data.clientEmail ? REVIEW : 0);
