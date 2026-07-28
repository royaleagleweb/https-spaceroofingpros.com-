/* ============================================================
   Space Roofing Pros — Contract Bot (operator wizard)
   Step 1 collects every client detail at once, then the bot asks
   short one-at-a-time questions, then sends the contract.
   ============================================================ */

import {
  COMPANY, JOB_TYPES, MATERIALS, PAY_PLANS,
  renderContract, normalize, money, contractNumber, labelOf, esc,
} from './contract-template.js';

const DRAFT_KEY = 'srp.contract.draft';
const CFG_KEY = 'srp.contract.config';

/* ---------------- State ---------------- */

const cfg = Object.assign(
  { endpoint: '', token: '', company: Object.assign({}, COMPANY) },
  readJSON(CFG_KEY)
);

let data = Object.assign(freshContract(), readJSON(DRAFT_KEY));
let step = 0;
let sending = false;

function freshContract() {
  return {
    contractNo: contractNumber(),
    issuedAt: new Date().toISOString().slice(0, 10),
    clientName: '', clientEmail: '', clientPhone: '',
    address: '', city: '', state: 'FL', zip: '', mailing: '',
    jobType: '', jobTypeOther: '',
    material: '', materialOther: '',
    squares: '', stories: '1',
    isInsuranceClaim: null, carrier: '', claimNo: '', deductible: '',
    total: '', payPlan: '', payCustom: '',
    startDate: '', durationDays: '',
    warrantyYears: 10, manufacturerWarranty: '',
    permits: true,
    notes: '',
  };
}

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || {}; }
  catch { return {}; }
}

/* ---------------- DOM refs ---------------- */

const $ = (id) => document.getElementById(id);
const elBody = $('body'), elBar = $('bar'), elStepLabel = $('stepLabel');
const elDoc = $('doc'), elCNo = $('cNo'), elToast = $('toast');
const btnBack = $('btnBack'), btnNext = $('btnNext');

/* ============================================================
   Step definitions
   ============================================================ */

const STEPS = [

  /* --- 1. All client details in one shot --- */
  {
    id: 'client',
    label: 'פרטי הלקוח',
    ask: 'בוא נתחיל 👋 מלא את כל פרטי הלקוח והנכס.',
    sub: 'שדות עם ● הם חובה. אחר כך אשאל אותך רק כמה שאלות קצרות.',
    render: () => `
      <div class="grid">
        ${input('clientName', 'שם מלא של הלקוח', 'text', { req: true, span: true, ph: 'John Smith' })}
        ${input('clientEmail', 'אימייל', 'email', { req: true, ph: 'john@example.com' })}
        ${input('clientPhone', 'טלפון', 'tel', { req: true, ph: '(305) 555-0100' })}
        ${input('address', 'כתובת הנכס', 'text', { req: true, span: true, ph: '123 Ocean Dr' })}
        ${input('city', 'עיר', 'text', { req: true, ph: 'Miami' })}
        ${input('zip', 'מיקוד', 'text', { req: true, ph: '33139' })}
        ${input('mailing', 'כתובת למשלוח דואר', 'text', { span: true, hint: 'רק אם שונה מכתובת הנכס' })}
      </div>`,
    validate: () => {
      const bad = [];
      if (!data.clientName.trim()) bad.push(['clientName', 'צריך שם']);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.clientEmail.trim())) bad.push(['clientEmail', 'אימייל לא תקין']);
      if (data.clientPhone.replace(/\D/g, '').length < 7) bad.push(['clientPhone', 'טלפון לא תקין']);
      if (!data.address.trim()) bad.push(['address', 'צריך כתובת']);
      if (!data.city.trim()) bad.push(['city', 'צריך עיר']);
      if (!/^\d{5}(-\d{4})?$/.test(data.zip.trim())) bad.push(['zip', 'מיקוד בן 5 ספרות']);
      return bad;
    },
  },

  /* --- 2. Job type --- */
  {
    id: 'jobType',
    label: 'סוג העבודה',
    ask: 'איזו עבודה אנחנו עושים?',
    render: () => chips('jobType', JOB_TYPES)
      + (data.jobType === 'other'
        ? `<div class="grid grid--1" style="margin-top:14px;">${input('jobTypeOther', 'פרט את סוג העבודה', 'text', { req: true })}</div>`
        : ''),
    validate: () => {
      if (!data.jobType) return [[null, 'בחר סוג עבודה']];
      if (data.jobType === 'other' && !data.jobTypeOther.trim()) return [['jobTypeOther', 'פרט את סוג העבודה']];
      return [];
    },
  },

  /* --- 3. Material --- */
  {
    id: 'material',
    label: 'סוג הגג',
    ask: 'איזה חומר גג?',
    sub: 'זה נכנס לתיאור העבודה ולסעיף האחריות.',
    render: () => chips('material', MATERIALS)
      + (data.material === 'other'
        ? `<div class="grid grid--1" style="margin-top:14px;">${input('materialOther', 'פרט את החומר', 'text', { req: true })}</div>`
        : ''),
    validate: () => {
      if (!data.material) return [[null, 'בחר חומר גג']];
      if (data.material === 'other' && !data.materialOther.trim()) return [['materialOther', 'פרט את החומר']];
      return [];
    },
  },

  /* --- 4. Size --- */
  {
    id: 'size',
    label: 'גודל',
    ask: 'כמה גדול הגג?',
    sub: 'סקוור = 100 רגל רבועה. אפשר להשאיר ריק אם עדיין לא מדדתם.',
    render: () => `
      <div class="grid">
        ${input('squares', 'שטח משוער (squares)', 'number', { ph: '24', min: 0, step: '0.5' })}
        ${select('stories', 'מספר קומות', [['1', '1'], ['2', '2'], ['3', '3+']])}
      </div>`,
    validate: () => [],
  },

  /* --- 5. Insurance --- */
  {
    id: 'insurance',
    label: 'ביטוח',
    ask: 'זו תביעת ביטוח או תשלום פרטי?',
    render: () => chips('isInsuranceClaim', [
      { id: true, label: 'תביעת ביטוח', he: 'Insurance claim' },
      { id: false, label: 'תשלום פרטי', he: 'Private pay' },
    ], true)
      + (data.isInsuranceClaim === true
        ? `<div class="grid" style="margin-top:16px;">
            ${input('carrier', 'חברת הביטוח', 'text', { req: true, ph: 'Citizens' })}
            ${input('claimNo', 'מספר תביעה', 'text', { ph: 'CL-000000' })}
            ${input('deductible', 'השתתפות עצמית ($)', 'number', { req: true, min: 0, step: '0.01', span: true })}
          </div>`
        : ''),
    validate: () => {
      if (data.isInsuranceClaim === null) return [[null, 'בחר אפשרות']];
      if (data.isInsuranceClaim === true) {
        const bad = [];
        if (!data.carrier.trim()) bad.push(['carrier', 'צריך שם חברת ביטוח']);
        if (data.deductible === '' || Number(data.deductible) < 0) bad.push(['deductible', 'הכנס סכום השתתפות עצמית']);
        return bad;
      }
      return [];
    },
  },

  /* --- 6. Price --- */
  {
    id: 'price',
    label: 'מחיר',
    ask: 'מה המחיר הכולל של העבודה?',
    sub: 'לפני מע״מ מקומי אם רלוונטי. אפשר לשנות בהמשך.',
    render: () => `<div class="grid grid--1">
      ${input('total', 'מחיר כולל ($)', 'number', { req: true, min: 0, step: '0.01', ph: '18500' })}
    </div>`,
    validate: () => (Number(data.total) > 0 ? [] : [['total', 'הכנס מחיר גדול מאפס']]),
  },

  /* --- 7. Payment schedule --- */
  {
    id: 'pay',
    label: 'תשלומים',
    ask: 'איך מחלקים את התשלום?',
    render: () => chips('payPlan', PAY_PLANS)
      + (data.payPlan === 'custom'
        ? `<div class="grid grid--1" style="margin-top:14px;">
            ${textarea('payCustom', 'לוח תשלומים מותאם', 'שורה לכל תשלום, למשל:\n$5,000 עם החתימה\n$8,000 בתחילת העבודה\nיתרה בסיום')}
          </div>`
        : payPreview()),
    validate: () => {
      if (!data.payPlan) return [[null, 'בחר לוח תשלומים']];
      if (data.payPlan === 'custom' && !data.payCustom.trim()) return [['payCustom', 'פרט את לוח התשלומים']];
      return [];
    },
  },

  /* --- 8. Schedule --- */
  {
    id: 'timeline',
    label: 'לוח זמנים',
    ask: 'מתי מתחילים וכמה זמן זה לוקח?',
    render: () => `
      <div class="grid">
        ${input('startDate', 'תאריך התחלה משוער', 'date', { req: true })}
        ${input('durationDays', 'משך בימי עבודה', 'number', { ph: '4', min: 1, step: '1' })}
      </div>`,
    validate: () => (data.startDate ? [] : [['startDate', 'בחר תאריך התחלה']]),
  },

  /* --- 9. Warranty --- */
  {
    id: 'warranty',
    label: 'אחריות',
    ask: 'כמה שנות אחריות עבודה?',
    render: () => chips('warrantyYears', [
      { id: 5, label: '5 שנים' }, { id: 10, label: '10 שנים' },
      { id: 15, label: '15 שנים' }, { id: 25, label: '25 שנים' },
    ], true)
      + `<div class="grid grid--1" style="margin-top:16px;">
          ${input('manufacturerWarranty', 'אחריות יצרן (טקסט חופשי)', 'text', { ph: 'GAF 30-year limited shingle warranty' })}
        </div>`,
    validate: () => (data.warrantyYears ? [] : [[null, 'בחר תקופת אחריות']]),
  },

  /* --- 10. Permits + notes --- */
  {
    id: 'extras',
    label: 'היתרים והערות',
    ask: 'שאלה אחרונה — היתרים והערות מיוחדות.',
    render: () => chips('permits', [
      { id: true, label: 'אנחנו מוציאים היתרים' },
      { id: false, label: 'הלקוח אחראי להיתרים' },
    ], true)
      + `<div class="grid grid--1" style="margin-top:16px;">
          ${textarea('notes', 'הערות / תוספות לחוזה', 'למשל: כולל פירוק פאנלים סולאריים והרכבה מחדש')}
        </div>`,
    validate: () => [],
  },

  /* --- 11. Review & send --- */
  {
    id: 'send',
    label: 'שליחה',
    ask: 'הכל מוכן ✅ בדוק ושלח ללקוח.',
    sub: 'החוזה המלא מוצג מימין. אפשר לחזור ולתקן כל פרט.',
    render: renderSendStep,
    validate: () => [],
  },
];

/* ============================================================
   Field builders
   ============================================================ */

function input(key, label, type, o) {
  const opt = o || {};
  const attrs = [
    `id="f_${key}"`, `data-key="${key}"`, `type="${type}"`,
    `value="${esc(data[key] == null ? '' : data[key])}"`,
    opt.ph ? `placeholder="${esc(opt.ph)}"` : '',
    opt.min != null ? `min="${opt.min}"` : '',
    opt.step ? `step="${opt.step}"` : '',
  ].filter(Boolean).join(' ');
  return `<div class="field${opt.span ? ' span-2' : ''}">
    <label for="f_${key}">${esc(label)}${opt.req ? ' <span class="req">●</span>' : ''}</label>
    <input ${attrs} />
    ${opt.hint ? `<span class="field__hint">${esc(opt.hint)}</span>` : ''}
    <span class="field__err" id="e_${key}"></span>
  </div>`;
}

function textarea(key, label, ph) {
  return `<div class="field span-2">
    <label for="f_${key}">${esc(label)}</label>
    <textarea id="f_${key}" data-key="${key}" placeholder="${esc(ph || '')}">${esc(data[key] || '')}</textarea>
    <span class="field__err" id="e_${key}"></span>
  </div>`;
}

function select(key, label, opts) {
  return `<div class="field">
    <label for="f_${key}">${esc(label)}</label>
    <select id="f_${key}" data-key="${key}">
      ${opts.map(([v, t]) => `<option value="${esc(v)}"${String(data[key]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
    <span class="field__err" id="e_${key}"></span>
  </div>`;
}

/** Quick-pick chips. `raw` keeps non-string ids (true/false/numbers) intact. */
function chips(key, list, raw) {
  return `<div class="chips" data-chipkey="${key}" data-raw="${raw ? '1' : ''}">
    ${list.map((o) => {
      const on = String(data[key]) === String(o.id);
      const sub = o.he && o.he !== o.label ? `<small>${esc(o.label)}</small>` : '';
      const text = o.he ? esc(o.he) : esc(o.label);
      return `<button type="button" class="chip${on ? ' is-on' : ''}" data-val="${esc(o.id)}">${text}${sub}</button>`;
    }).join('')}
  </div><span class="field__err" id="e_${key}"></span>`;
}

function payPreview() {
  const plan = PAY_PLANS.find((p) => p.id === data.payPlan);
  if (!plan || !plan.parts || !Number(data.total)) return '';
  return `<div class="summary" style="margin-top:16px;">
    ${plan.parts.map((p) => `<div class="summary__row">
      <span>${esc(p.when)}</span><b>${money(Number(data.total) * p.pct / 100)}</b>
    </div>`).join('')}
  </div>`;
}

/* ============================================================
   Review & send step
   ============================================================ */

function renderSendStep() {
  const rows = [
    ['לקוח', `${data.clientName} · ${data.clientEmail}`, 0],
    ['נכס', `${data.address}, ${data.city} ${data.zip}`, 0],
    ['עבודה', `${labelOf(JOB_TYPES, data.jobType, data.jobTypeOther)} · ${labelOf(MATERIALS, data.material, data.materialOther)}`, 1],
    ['מחיר', money(data.total), 5],
    ['התחלה', data.startDate || '—', 7],
    ['אחריות', `${data.warrantyYears} שנים`, 8],
  ];

  const configured = !!(cfg.endpoint && cfg.token);
  const note = configured
    ? `<div class="send-note">✉ שליחה אוטומטית מוגדרת. לחיצה על "שלח ללקוח" תשלח את החוזה ל־<b>${esc(data.clientEmail)}</b> עם קישור לחתימה דיגיטלית.</div>`
    : `<div class="send-note send-note--warn">⚙ שליחה אוטומטית לא מוגדרת. הבוט יוריד PDF ויפתח לך מייל מוכן — תצרף ותשלח. להפעלת שליחה בלחיצה אחת: <b>הגדרות</b> → כתובת Worker.</div>`;

  return `
    <div class="summary">
      ${rows.map(([k, v, s]) => `<div class="summary__row">
        <span>${esc(k)}: <b>${esc(v)}</b></span>
        <button type="button" data-goto="${s}">שנה</button>
      </div>`).join('')}
    </div>
    ${note}
    <div class="grid grid--1" style="gap:10px;">
      <button type="button" class="btn btn--primary btn--block" id="btnSend">
        ${configured ? '📤 שלח ללקוח עכשיו' : '📤 הכן מייל ללקוח'}
      </button>
      <div class="grid">
        <button type="button" class="btn btn--outline" id="btnCopy">📋 העתק להדבקה בג׳ימייל</button>
        <button type="button" class="btn btn--outline" id="btnPdf">⬇ הורד PDF</button>
      </div>
    </div>
    <p class="field__hint" style="margin-top:14px;">
      נוסח החוזה כולל את ההודעות הנדרשות בפלורידה (Construction Lien Law, Recovery Fund) וזכות ביטול של 3 ימים.
      מומלץ שעו״ד בפלורידה יאשר את הנוסח פעם אחת לפני שימוש שוטף.
    </p>`;
}

/* ============================================================
   Render loop
   ============================================================ */

function render() {
  const s = STEPS[step];

  elBody.innerHTML = `<div class="bubble">
      <span class="bubble__avatar">
        <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path d="M4 26 24 8l20 18-3 3-17-15-17 15z" fill="#ff6b35"/><path d="M8 26h32v14H8z" fill="#ffffff"/><path d="M20 30h8v10h-8z" fill="#ff6b35"/></svg>
      </span>
      <span class="bubble__text">${esc(s.ask)}${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>
    </div>
    ${s.render()}`;

  elBar.style.width = `${(step / (STEPS.length - 1)) * 100}%`;
  elStepLabel.textContent = `שלב ${step + 1} מתוך ${STEPS.length} · ${s.label}`;
  btnBack.disabled = step === 0;
  btnNext.hidden = step === STEPS.length - 1;

  // Focus the first empty input so the operator can just type
  const first = elBody.querySelector('input:not([type=date]), textarea');
  if (first && !first.value) first.focus();

  wireStep();
  renderDoc();
}

function renderDoc() {
  data.company = cfg.company;
  elDoc.innerHTML = renderContract(data);
  elCNo.textContent = data.contractNo;
}

function wireStep() {
  elBody.querySelectorAll('[data-key]').forEach((el) => {
    el.addEventListener('input', () => {
      data[el.dataset.key] = el.value;
      saveDraft();
      renderDoc();
    });
  });

  elBody.querySelectorAll('[data-chipkey]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const key = group.dataset.chipkey;
      const raw = group.dataset.raw;
      let val = chip.dataset.val;
      if (raw) {
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      }
      data[key] = val;
      saveDraft();
      render(); // re-render: chips can reveal follow-up fields
    });
  });

  elBody.querySelectorAll('[data-goto]').forEach((b) => {
    b.addEventListener('click', () => { step = Number(b.dataset.goto); render(); });
  });

  const send = $('btnSend');
  if (send) send.addEventListener('click', doSend);
  const copy = $('btnCopy');
  if (copy) copy.addEventListener('click', copyRich);
  const pdf = $('btnPdf');
  if (pdf) pdf.addEventListener('click', () => window.print());
}

function showErrors(bad) {
  elBody.querySelectorAll('.field__err').forEach((e) => { e.textContent = ''; });
  elBody.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  bad.forEach(([key, msg]) => {
    if (key) {
      const err = $(`e_${key}`), fld = $(`f_${key}`);
      if (err) err.textContent = msg;
      if (fld) fld.setAttribute('aria-invalid', 'true');
    } else {
      toast(msg, 'err');
    }
  });
  const firstBad = bad.find(([k]) => k);
  if (firstBad) {
    const el = $(`f_${firstBad[0]}`);
    if (el) el.focus();
  }
}

function next() {
  const bad = STEPS[step].validate();
  if (bad.length) { showErrors(bad); return; }
  if (step < STEPS.length - 1) { step += 1; render(); }
}

function back() { if (step > 0) { step -= 1; render(); } }

/* ============================================================
   Sending
   ============================================================ */

async function doSend() {
  if (sending) return;
  const btn = $('btnSend');

  if (!cfg.endpoint || !cfg.token) return sendFallback();

  sending = true;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> שולח…';
  try {
    const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}/api/send-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ contract: normalize(data) }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `שגיאה ${res.status}`);
    toast(`✅ נשלח ל־${data.clientEmail}`, 'ok');
    btn.innerHTML = '✅ נשלח';
    if (out.signUrl) {
      const box = document.createElement('div');
      box.className = 'send-note';
      box.innerHTML = `קישור החתימה: <a href="${esc(out.signUrl)}" target="_blank" rel="noopener" class="ltr">${esc(out.signUrl)}</a>`;
      btn.parentElement.appendChild(box);
    }
  } catch (err) {
    toast(`שליחה נכשלה: ${err.message}`, 'err');
    btn.disabled = false;
    btn.innerHTML = '📤 נסה שוב';
  } finally {
    sending = false;
  }
}

/** No Worker configured: hand the operator a ready-to-send email + a PDF. */
function sendFallback() {
  const d = normalize(data);
  const lines = [
    `Hi ${(d.clientName || '').split(' ')[0] || 'there'},`,
    '',
    `Thanks for choosing ${cfg.company.name}. Your roofing agreement (${d.contractNo}) for`,
    `${d.address}, ${d.city}, ${d.state} ${d.zip} is attached.`,
    '',
    `Total contract price: ${money(d.total)}`,
    `Estimated start: ${d.startDate || 'TBD'}`,
    `Workmanship warranty: ${d.warrantyYears} years`,
    '',
    'Please review, sign, and send it back. Reply here with any questions.',
    '',
    cfg.company.name,
    `${cfg.company.phone} · ${cfg.company.email}`,
    `FL License #${cfg.company.license}`,
  ].join('\n');

  const href = `mailto:${encodeURIComponent(d.clientEmail)}`
    + `?subject=${encodeURIComponent(`Your Roofing Agreement — ${d.contractNo}`)}`
    + `&body=${encodeURIComponent(lines)}`;

  window.print();          // save the contract as PDF to attach
  window.location.href = href;
  toast('שמור כ-PDF וצרף למייל שנפתח', 'ok');
}

/** Copy the contract as rich HTML so it can be pasted straight into Gmail. */
async function copyRich() {
  const html = renderContract(normalize(data));
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([elDoc.innerText], { type: 'text/plain' }),
      }),
    ]);
    toast('✅ הועתק — הדבק בגוף המייל', 'ok');
  } catch {
    try {
      await navigator.clipboard.writeText(elDoc.innerText);
      toast('הועתק כטקסט רגיל', 'ok');
    } catch {
      toast('הדפדפן חסם העתקה', 'err');
    }
  }
}

/* ============================================================
   Draft / settings / chrome
   ============================================================ */

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

function toast(msg, kind) {
  elToast.textContent = msg;
  elToast.className = `toast is-on${kind ? ` toast--${kind}` : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { elToast.className = 'toast'; }, 3800);
}

$('btnBack').addEventListener('click', back);
$('btnNext').addEventListener('click', next);
$('btnPrint').addEventListener('click', () => window.print());
$('btnDraft').addEventListener('click', () => { saveDraft(); toast('✅ הטיוטה נשמרה בדפדפן', 'ok'); });

$('btnReset').addEventListener('click', () => {
  if (!confirm('להתחיל חוזה חדש? הטיוטה הנוכחית תימחק.')) return;
  localStorage.removeItem(DRAFT_KEY);
  data = freshContract();
  step = 0;
  render();
  toast('חוזה חדש נפתח');
});

// Enter advances, except inside a textarea
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
  if ($('settings').hidden === false) return;
  e.preventDefault();
  if (step < STEPS.length - 1) next();
});

/* ---------------- Settings modal ---------------- */

const SET_FIELDS = {
  setName: 'name', setLegal: 'legal', setLicense: 'license',
  setPhone: 'phone', setEmail: 'email', setAddress: 'address',
  setCity: 'city', setZip: 'zip',
};

function openSettings() {
  $('setEndpoint').value = cfg.endpoint;
  $('setToken').value = cfg.token;
  Object.entries(SET_FIELDS).forEach(([id, key]) => { $(id).value = cfg.company[key] || ''; });
  $('settings').hidden = false;
}

$('btnSettings').addEventListener('click', openSettings);
$('setClose').addEventListener('click', () => { $('settings').hidden = true; });
$('settings').addEventListener('click', (e) => {
  if (e.target === $('settings')) $('settings').hidden = true;
});
$('setSave').addEventListener('click', () => {
  cfg.endpoint = $('setEndpoint').value.trim().replace(/\/$/, '');
  cfg.token = $('setToken').value.trim();
  Object.entries(SET_FIELDS).forEach(([id, key]) => { cfg.company[key] = $(id).value.trim(); });
  saveCfg();
  $('settings').hidden = true;
  renderDoc();
  if (step === STEPS.length - 1) render();
  toast('✅ ההגדרות נשמרו', 'ok');
});

/* ---------------- Go ---------------- */

render();
