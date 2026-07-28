/* ============================================================
   Space Roofing Pros — shared contract model + renderer
   ------------------------------------------------------------
   Single source of truth for contract content. Imported by:
     - assets/js/contract-bot.js    (operator wizard)
     - assets/js/contract-sign.js   (client review & sign page)
     - worker/src/index.js          (email delivery)
   Rendered HTML uses inline styles so it survives email clients.
   ============================================================ */

export const COMPANY = {
  name: 'Space Roofing Pros',
  legal: 'Space Roofing Pros LLC',
  license: 'CCC1331234',
  address: '1450 Brickell Ave, Suite 200',
  city: 'Miami',
  state: 'FL',
  zip: '33131',
  phone: '(305) 555-1234',
  email: 'info@spaceroofingpros.com',
  site: 'spaceroofingpros.com',
};

/* ---------------- Options shown in the wizard ---------------- */

export const JOB_TYPES = [
  { id: 'replacement', label: 'Full Roof Replacement', he: 'החלפת גג מלאה' },
  { id: 'new', label: 'New Roof Installation', he: 'התקנת גג חדש' },
  { id: 'repair', label: 'Roof Repair', he: 'תיקון גג' },
  { id: 'flat', label: 'Flat Roof / Waterproofing', he: 'גג שטוח / איטום' },
  { id: 'maintenance', label: 'Maintenance & Tune-Up', he: 'תחזוקה ובדיקה' },
  { id: 'other', label: 'Other', he: 'אחר' },
];

export const MATERIALS = [
  { id: 'shingle', label: 'Architectural Asphalt Shingles', he: 'רעפי אספלט' },
  { id: 'concrete-tile', label: 'Concrete Tile', he: 'רעפי בטון' },
  { id: 'clay-tile', label: 'Clay Tile', he: 'רעפי חרס' },
  { id: 'metal', label: 'Standing Seam Metal', he: 'מתכת (Standing Seam)' },
  { id: 'tpo', label: 'TPO Single-Ply Membrane', he: 'ממברנת TPO' },
  { id: 'modified', label: 'Modified Bitumen / Torch Down', he: 'ביטומן מודיפייד' },
  { id: 'other', label: 'Other', he: 'אחר' },
];

export const PAY_PLANS = [
  {
    id: '30-40-30',
    label: '30% deposit · 40% at dry-in · 30% on completion',
    he: '30% מקדמה · 40% באמצע · 30% בסיום',
    parts: [
      { pct: 30, when: 'Upon signing this Agreement (deposit)' },
      { pct: 40, when: 'Upon completion of tear-off and dry-in' },
      { pct: 30, when: 'Upon final inspection and completion' },
    ],
  },
  {
    id: '50-50',
    label: '50% deposit · 50% on completion',
    he: '50% מקדמה · 50% בסיום',
    parts: [
      { pct: 50, when: 'Upon signing this Agreement (deposit)' },
      { pct: 50, when: 'Upon final inspection and completion' },
    ],
  },
  {
    id: '10-45-45',
    label: '10% deposit · 45% at material delivery · 45% on completion',
    he: '10% מקדמה · 45% באספקת חומרים · 45% בסיום',
    parts: [
      { pct: 10, when: 'Upon signing this Agreement (deposit)' },
      { pct: 45, when: 'Upon delivery of materials to the job site' },
      { pct: 45, when: 'Upon final inspection and completion' },
    ],
  },
  {
    id: 'full-completion',
    label: 'No deposit · 100% on completion',
    he: 'בלי מקדמה · 100% בסיום',
    parts: [{ pct: 100, when: 'Upon final inspection and completion' }],
  },
  { id: 'custom', label: 'Custom schedule', he: 'לוח תשלומים מותאם', parts: null },
];

/* ---------------- Small helpers ---------------- */

export function money(n) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function longDate(iso) {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso + (String(iso).length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function labelOf(list, id, fallback) {
  const hit = list.find((o) => o.id === id);
  return hit ? hit.label : (fallback || id || '—');
}

export function contractNumber(prefix, date) {
  const d = date || new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix || 'SRP'}-${stamp}-${rand}`;
}

/** Build the payment milestone rows for a contract. */
export function paymentRows(data) {
  const plan = PAY_PLANS.find((p) => p.id === data.payPlan);
  const total = Number(data.total || 0);
  if (!plan || !plan.parts) {
    const text = (data.payCustom || '').trim();
    return text
      ? text.split('\n').filter(Boolean).map((line) => ({ amount: null, when: line.trim() }))
      : [{ amount: total, when: 'As agreed in writing between the parties' }];
  }
  return plan.parts.map((p) => ({
    amount: Math.round(total * p.pct) / 100,
    when: `${p.pct}% — ${p.when}`,
  }));
}

/** Normalize / fill in a raw wizard payload. Safe to call repeatedly. */
export function normalize(raw) {
  const d = Object.assign({}, raw);
  d.kind = 'roofing';
  d.company = Object.assign({}, COMPANY, raw.company || {});
  d.contractNo = d.contractNo || contractNumber('SRP');
  d.issuedAt = d.issuedAt || new Date().toISOString().slice(0, 10);
  d.total = Number(d.total || 0);
  d.deductible = Number(d.deductible || 0);
  d.warrantyYears = Number(d.warrantyYears || 10);
  d.durationDays = Number(d.durationDays || 0);
  return d;
}

/* ---------------- Renderer ---------------- */

const S = {
  page: 'max-width:820px;margin:0 auto;padding:32px;background:#ffffff;color:#112233;'
    + "font-family:'Inter',Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;",
  h1: 'margin:0 0 4px;font-size:24px;font-weight:800;color:#0b3a5c;letter-spacing:-.01em;',
  h2: 'margin:28px 0 10px;font-size:15px;font-weight:800;color:#0b3a5c;text-transform:uppercase;letter-spacing:.06em;'
    + 'border-bottom:2px solid #ff6b35;padding-bottom:6px;',
  p: 'margin:0 0 10px;color:#334155;',
  small: 'font-size:12px;color:#6b7280;',
  th: 'text-align:left;padding:8px 10px;background:#f3f7fa;color:#0b3a5c;font-size:12px;'
    + 'text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;',
  td: 'padding:9px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;',
  note: 'margin:14px 0;padding:12px 14px;background:#fff5ec;border-left:4px solid #ff6b35;border-radius:6px;font-size:12.5px;color:#4b3b30;',
};

function kvTable(rows) {
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">${rows
    .filter((r) => r && r[1] !== '' && r[1] != null)
    .map(
      (r) => `<tr><td style="${S.td}width:38%;color:#6b7280;">${esc(r[0])}</td>`
        + `<td style="${S.td}font-weight:600;">${esc(r[1])}</td></tr>`
    )
    .join('')}</table>`;
}

/**
 * Render the full contract as standalone HTML.
 * @param {object} raw  wizard payload
 * @param {object} [opt] { signature: dataURL, signerName, signedAt, ip }
 */
export function renderContract(raw, opt) {
  const d = normalize(raw);
  const o = opt || {};
  const c = d.company;
  const rows = paymentRows(d);
  const jobLabel = labelOf(JOB_TYPES, d.jobType, d.jobTypeOther);
  const matLabel = labelOf(MATERIALS, d.material, d.materialOther);

  const propertyAddr = [d.address, [d.city, d.state].filter(Boolean).join(', '), d.zip]
    .filter(Boolean)
    .join(' · ');

  const scopeLines = [
    `Tear off existing roof covering down to the deck and dispose of all debris.`,
    `Inspect the roof deck; replace deteriorated sheathing (see allowance below).`,
    `Install underlayment and all flashing, drip edge, and accessories per Florida Building Code.`,
    `Furnish and install ${matLabel.toLowerCase()} across the designated roof areas.`,
    d.permits
      ? `Pull all required building permits and coordinate municipal inspections.`
      : `Permits and municipal inspection fees are NOT included and are the Owner's responsibility.`,
    `Clean the job site daily and perform a magnetic nail sweep upon completion.`,
  ];
  if (d.jobType === 'repair' || d.jobType === 'maintenance') {
    scopeLines[0] = 'Perform the repair work described below; no full tear-off is included.';
    scopeLines[3] = `Furnish and install ${matLabel.toLowerCase()} materials as needed for the repair.`;
  }

  const clauses = [
    ['Scope of Work',
      `<ul style="margin:0 0 10px;padding-left:20px;color:#334155;">${scopeLines
        .map((l) => `<li style="margin-bottom:5px;">${esc(l)}</li>`)
        .join('')}</ul>`
      + (d.notes
        ? `<p style="${S.p}"><strong>Additional scope / notes:</strong><br>${esc(d.notes).replace(/\n/g, '<br>')}</p>`
        : '')],

    ['Wood Replacement Allowance',
      `<p style="${S.p}">Replacement of rotted or damaged decking, fascia, or trusses discovered after tear-off `
      + `is not included in the Contract Price. Such work will be billed at the unit rates below and requires a `
      + `written Change Order signed by the Owner before the work proceeds.</p>`
      + `<table style="width:100%;border-collapse:collapse;">`
      + `<tr><td style="${S.td}">Roof sheathing / plywood</td><td style="${S.td}">$4.50 per sq. ft.</td></tr>`
      + `<tr><td style="${S.td}">Dimensional lumber (2x)</td><td style="${S.td}">$9.00 per linear ft.</td></tr>`
      + `<tr><td style="${S.td}">Fascia board</td><td style="${S.td}">$11.00 per linear ft.</td></tr>`
      + `</table>`],

    ['Schedule',
      `<p style="${S.p}">Work is scheduled to begin on or about <strong>${esc(longDate(d.startDate))}</strong>`
      + (d.durationDays
        ? ` and to reach substantial completion within approximately <strong>${d.durationDays} working day(s)</strong>`
        : '')
      + `, subject to weather, material availability, permit issuance, and municipal inspection scheduling. `
      + `Delays caused by those factors do not constitute a breach of this Agreement.</p>`],

    ['Warranty',
      `<p style="${S.p}">The Contractor warrants its workmanship against defects for `
      + `<strong>${d.warrantyYears} year(s)</strong> from the date of substantial completion. `
      + (d.manufacturerWarranty
        ? `Roofing materials carry the manufacturer's warranty: <strong>${esc(d.manufacturerWarranty)}</strong>. `
        : '')
      + `Manufacturer warranties are provided by the manufacturer, not the Contractor. This warranty is void if the `
      + `Contract Price is not paid in full, if other parties alter the roof, or for damage caused by named storms, `
      + `impact, structural movement, or lack of maintenance.</p>`],

    ['Change Orders',
      `<p style="${S.p}">Any change to the scope, materials, or price must be documented in a written Change Order `
      + `signed by both parties before the additional work begins. Verbal changes are not binding.</p>`],

    ['Insurance & Liability',
      `<p style="${S.p}">The Contractor carries general liability and workers' compensation insurance; certificates `
      + `are available on request. The Owner is responsible for insuring the structure and its contents. The Owner `
      + `shall remove or protect fragile items in the attic and around the perimeter of the home prior to the start `
      + `of work; the Contractor is not liable for vibration damage to such unsecured items.</p>`],

    ['Right to Cancel',
      `<p style="${S.p}">The Owner may cancel this Agreement without penalty or obligation within `
      + `<strong>three (3) business days</strong> of the date of signing by delivering written notice to the `
      + `Contractor at ${esc(c.email)} or ${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}. `
      + `After that period, the Owner remains responsible for materials ordered and labor performed.</p>`],

    ['Default & Collection',
      `<p style="${S.p}">Balances unpaid more than ten (10) days after they become due accrue interest at 1.5% per `
      + `month (18% per annum) or the maximum rate allowed by Florida law, whichever is less. The Owner agrees to pay `
      + `reasonable attorneys' fees and costs incurred in collection. This Agreement is governed by the laws of the `
      + `State of Florida, with venue in the county where the property is located.</p>`],
  ];

  if (d.isInsuranceClaim) {
    clauses.splice(3, 0, ['Insurance Claim Terms',
      `<p style="${S.p}">This project is being performed in connection with a property insurance claim with `
      + `<strong>${esc(d.carrier || 'the Owner\'s carrier')}</strong>`
      + (d.claimNo ? `, claim number <strong>${esc(d.claimNo)}</strong>` : '')
      + `. The Contract Price is the amount approved by the carrier plus any supplements the carrier approves, `
      + `plus the Owner's deductible of <strong>${money(d.deductible)}</strong>.</p>`
      + `<p style="${S.p}">The Owner remains responsible for paying the full deductible. Florida law prohibits a `
      + `contractor from waiving, rebating, or absorbing an insurance deductible. The Contractor is not a public `
      + `adjuster and does not negotiate the claim on the Owner's behalf. This Agreement is not an assignment of `
      + `insurance benefits.</p>`]);
  }

  const clauseHTML = clauses
    .map((c2, i) => `<h2 style="${S.h2}">${i + 1}. ${esc(c2[0])}</h2>${c2[1]}`)
    .join('');

  const payHTML = `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">`
    + `<tr><th style="${S.th}">Milestone</th><th style="${S.th}width:150px;">Amount</th></tr>`
    + rows
      .map((r) => `<tr><td style="${S.td}">${esc(r.when)}</td>`
        + `<td style="${S.td}font-weight:700;">${r.amount == null ? '—' : money(r.amount)}</td></tr>`)
      .join('')
    + `<tr><td style="${S.td}font-weight:800;color:#0b3a5c;">TOTAL CONTRACT PRICE</td>`
    + `<td style="${S.td}font-weight:800;color:#0b3a5c;font-size:16px;">${money(d.total)}</td></tr>`
    + `</table>`;

  const sigBlock = o.signature
    ? `<img src="${esc(o.signature)}" alt="Owner signature" style="max-height:70px;display:block;margin-bottom:4px;">`
      + `<div style="border-top:1px solid #112233;padding-top:5px;">${esc(o.signerName || d.clientName)}</div>`
      + `<div style="${S.small}">Signed electronically ${esc(longDate(o.signedAt || new Date().toISOString()))}`
      + (o.ip ? ` · IP ${esc(o.ip)}` : '') + `</div>`
    : `<div style="height:70px;"></div><div style="border-top:1px solid #112233;padding-top:5px;">`
      + `${esc(d.clientName || 'Owner')}</div><div style="${S.small}">Date: ____________________</div>`;

  // The contractor countersigns before the contract goes out, so the signature
  // rides along inside the payload rather than being applied at render time.
  const contractorBlock = d.contractorSignature
    ? `<img src="${esc(d.contractorSignature)}" alt="Contractor signature" style="max-height:70px;display:block;margin-bottom:4px;">`
      + `<div style="border-top:1px solid #112233;padding-top:5px;">${esc(d.contractorName || c.legal)} · Lic. #${esc(c.license)}</div>`
      + `<div style="${S.small}">Signed electronically ${esc(longDate(d.contractorSignedAt || d.issuedAt))}</div>`
    : `<div style="height:70px;padding-top:26px;font-family:Georgia,serif;font-size:22px;color:#0b3a5c;">${esc(c.name)}</div>`
      + `<div style="border-top:1px solid #112233;padding-top:5px;">${esc(c.legal)} · Lic. #${esc(c.license)}</div>`
      + `<div style="${S.small}">Date: ${esc(longDate(d.issuedAt))}</div>`;

  return `<div style="${S.page}">
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="${S.h1}">${esc(c.name)}</div>
        <div style="${S.small}">${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}<br>
        ${esc(c.phone)} · ${esc(c.email)}<br>Florida License #${esc(c.license)}</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:220px;">
        <div style="font-size:13px;font-weight:800;color:#0b3a5c;text-transform:uppercase;letter-spacing:.08em;">
          Roofing Agreement</div>
        <div style="${S.small}margin-top:4px;">No. <strong style="color:#112233;">${esc(d.contractNo)}</strong><br>
        Issued ${esc(longDate(d.issuedAt))}</div>
        ${o.signature ? '<div style="margin-top:8px;display:inline-block;padding:4px 10px;background:#14a6a0;color:#fff;border-radius:99px;font-size:11px;font-weight:700;">SIGNED</div>' : ''}
      </td>
    </tr>
  </table>

  <p style="${S.p}">This Roofing Agreement (the &ldquo;Agreement&rdquo;) is entered into between
  <strong>${esc(c.legal)}</strong> (the &ldquo;Contractor&rdquo;) and <strong>${esc(d.clientName || 'the Owner')}</strong>
  (the &ldquo;Owner&rdquo;) for work at the property described below.</p>

  <h2 style="${S.h2}">Owner &amp; Property</h2>
  ${kvTable([
    ['Owner', d.clientName],
    ['Email', d.clientEmail],
    ['Phone', d.clientPhone],
    ['Property address', propertyAddr],
    ['Mailing address', d.mailing && d.mailing !== d.address ? d.mailing : ''],
  ])}

  <h2 style="${S.h2}">Project</h2>
  ${kvTable([
    ['Type of work', jobLabel],
    ['Roof system', matLabel],
    ['Approximate area', d.squares ? `${d.squares} squares (${Number(d.squares) * 100} sq. ft.)` : ''],
    ['Stories', d.stories],
    ['Permits', d.permits ? 'Included — pulled by Contractor' : 'Not included — by Owner'],
    ['Insurance claim', d.isInsuranceClaim ? `Yes — ${d.carrier || 'carrier on file'}${d.claimNo ? ` (#${d.claimNo})` : ''}` : 'No — private pay'],
  ])}

  <h2 style="${S.h2}">Contract Price &amp; Payment Schedule</h2>
  ${payHTML}
  <p style="${S.small}">Payments are due upon reaching each milestone. Accepted methods: check, ACH, or credit card
  (card payments incur a 3% processing fee).</p>

  ${clauseHTML}

  <div style="${S.note}"><strong>NOTICE TO OWNER — CONSTRUCTION LIEN LAW.</strong> According to Florida law, those who
  work on your property or provide materials and are not paid in full have a right to enforce their claim for payment
  against your property. This claim is known as a construction lien. If your contractor or a subcontractor fails to pay
  subcontractors, suppliers, or laborers, the people who are owed money may look to your property for payment, even if
  you have paid your contractor in full. Protect yourself — ask for a written release of lien from anyone who could
  claim a lien against your property before you make each payment.</div>

  <div style="${S.note}"><strong>NOTICE — FLORIDA HOMEOWNERS' CONSTRUCTION RECOVERY FUND.</strong> Payment may be
  available from the Florida Homeowners' Construction Recovery Fund if you lose money on a project performed under
  contract, where the loss results from specified violations of Florida law by a state-licensed contractor. For
  information about the recovery fund and filing a claim, contact the Florida Construction Industry Licensing Board at
  2601 Blair Stone Road, Tallahassee, FL 32399-1039, or 850-487-1395.</div>

  <h2 style="${S.h2}">Signatures</h2>
  <p style="${S.p}">By signing below, the Owner acknowledges having read and agreed to every provision of this
  Agreement, including the notices above, and authorizes the Contractor to proceed with the work described.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:14px;">
    <tr>
      <td style="width:50%;padding-right:24px;vertical-align:bottom;">
        <div style="${S.small}margin-bottom:6px;font-weight:700;color:#0b3a5c;">OWNER</div>
        ${sigBlock}
      </td>
      <td style="width:50%;vertical-align:bottom;">
        <div style="${S.small}margin-bottom:6px;font-weight:700;color:#0b3a5c;">CONTRACTOR</div>
        ${contractorBlock}
      </td>
    </tr>
  </table>

  <p style="${S.small}margin-top:24px;text-align:center;">${esc(c.name)} · ${esc(c.phone)} · ${esc(c.site)}
  · Contract ${esc(d.contractNo)}</p>
</div>`;
}

/** Short email body that wraps the contract with a call to action. */
export function renderEmail(raw, signUrl) {
  const d = normalize(raw);
  const c = d.company;
  const cta = signUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${esc(signUrl)}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;
        padding:14px 30px;border-radius:10px;font-weight:700;font-size:15px;">Review &amp; Sign Your Contract</a>
        <div style="font-size:12px;color:#6b7280;margin-top:8px;">Takes about a minute — no account needed.</div>
      </div>`
    : '';
  return `<div style="background:#f3f7fa;padding:24px 12px;">
    <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;
    box-shadow:0 12px 30px rgba(11,42,74,.12);font-family:'Inter',Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="background:#0b3a5c;color:#fff;padding:22px 32px;">
        <div style="font-size:19px;font-weight:800;">${esc(c.name)}</div>
        <div style="font-size:13px;color:#cdd9e7;">Your roofing agreement is ready</div>
      </div>
      <div style="padding:26px 32px 0;">
        <p style="margin:0 0 10px;color:#334155;font-size:15px;">Hi ${esc((d.clientName || '').split(' ')[0] || 'there')},</p>
        <p style="margin:0 0 10px;color:#334155;font-size:15px;">Thanks for choosing ${esc(c.name)}. Your agreement for
        the work at <strong>${esc(d.address || 'your property')}</strong> is below, for a total of
        <strong>${money(d.total)}</strong>. Please review it and reach out with any questions.</p>
        ${cta}
      </div>
      ${renderContract(d)}
    </div>
  </div>`;
}

export default { COMPANY, JOB_TYPES, MATERIALS, PAY_PLANS, renderContract, renderEmail, normalize, money, longDate, contractNumber, paymentRows, labelOf, esc };
