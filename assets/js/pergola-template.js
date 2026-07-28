/* ============================================================
   Easy Pergola — contract model + renderer
   ------------------------------------------------------------
   Same shape as contract-template.js (roofing) so the signing
   page and the Worker can render either one from a `kind` field.
   Rendered HTML uses inline styles so it survives email clients.
   ============================================================ */

import { money, longDate, esc, contractNumber } from './contract-template.js';

export { money, longDate, esc };

export const COMPANY = {
  name: 'Easy Pergola',
  legal: 'Easy Pergola LLC',
  license: 'CBC0000000',
  address: '000 Example Blvd',
  city: 'Fort Lauderdale',
  state: 'FL',
  zip: '33301',
  phone: '(954) 000-0000',
  email: 'office@easypergola.com',
  site: 'easypergola.com',
};

/* ---------------- Wizard options (mirrors the intake form) ---------------- */

export const PROJECT_TYPES = [
  { id: 'Aluminum Pergola', label: 'Aluminum Pergola', note: 'Attached or freestanding' },
  { id: 'Patio Cover', label: 'Patio Cover', note: 'Solid insulated roof' },
  { id: 'Outdoor Kitchen', label: 'Outdoor Kitchen', note: 'Cabinets, counters, appliances' },
  { id: 'Multi-Scope Project', label: 'Multi-Scope Project', note: 'Pergola plus additional work' },
];

export const PERMIT_OPTIONS = [
  { id: 'Contractor Responsibility', label: 'Contractor', note: 'Easy Pergola handles permits' },
  { id: 'Homeowner Responsibility', label: 'Homeowner', note: 'Owner handles permits and approvals' },
  { id: 'Not Included', label: 'Not Included', note: 'Permit work is excluded' },
  { id: 'To Be Confirmed', label: 'Confirm Later', note: 'Decide before work begins' },
];

/* How each permit choice reads inside the contract. */
const PERMIT_CLAUSE = {
  'Contractor Responsibility':
    'The Contractor shall apply for and obtain all building permits required for the Work and shall '
    + 'coordinate all municipal inspections. Permit fees are included in the Contract Price unless stated '
    + 'otherwise. The Owner shall sign any application the permitting authority requires from the property owner.',
  'Homeowner Responsibility':
    'The Owner is responsible for obtaining all building permits and any approvals required for the Work, '
    + 'including HOA or architectural review approval, and for paying all related fees. The Contractor will not '
    + 'begin the Work until the Owner provides evidence that the required permits have been issued.',
  'Not Included':
    'Permit work is expressly excluded from this Agreement. No permit application, permit fee, engineering '
    + 'submittal, or municipal inspection is included in the Contract Price. The Owner accepts full responsibility '
    + 'for compliance with all applicable permitting requirements.',
  'To Be Confirmed':
    'Responsibility for permits has not yet been assigned. Before the Work begins, the parties shall confirm in a '
    + 'written Change Order who will obtain the permits and who will pay the related fees. Until that is confirmed, '
    + 'no permit cost is included in the Contract Price.',
};

/* ---------------- Normalize ---------------- */

export function normalize(raw) {
  const d = Object.assign({}, raw);
  d.kind = 'pergola';
  d.company = Object.assign({}, COMPANY, raw.company || {});
  d.contractNo = d.contractNo || contractNumber('EP');
  d.issuedAt = d.issuedAt || new Date().toISOString().slice(0, 10);
  d.price = Number(d.price || 0);
  d.deposit = Number(d.deposit || 0);
  d.warrantyYears = Number(d.warrantyYears || 1);
  d.durationDays = Number(d.durationDays || 0);
  d.state = d.state || 'FL';
  return d;
}

/* ---------------- Renderer ---------------- */

const S = {
  page: 'max-width:820px;margin:0 auto;padding:32px;background:#ffffff;color:#222;'
    + 'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;',
  h1: 'margin:0 0 4px;font-size:23px;font-weight:800;color:#8a5a2b;letter-spacing:.11em;',
  h2: 'margin:26px 0 10px;font-size:14px;font-weight:800;color:#6e451f;text-transform:uppercase;'
    + 'letter-spacing:.07em;border-bottom:2px solid #8a5a2b;padding-bottom:6px;',
  p: 'margin:0 0 10px;color:#3a3a3a;',
  small: 'font-size:12px;color:#6f6f6f;',
  td: 'padding:9px 10px;border-bottom:1px solid #e6dbd0;vertical-align:top;',
  th: 'text-align:left;padding:8px 10px;background:#fbf4ed;color:#6e451f;font-size:12px;'
    + 'text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e6dbd0;',
  note: 'margin:14px 0;padding:12px 14px;background:#fbf8f5;border-left:4px solid #8a5a2b;'
    + 'border-radius:6px;font-size:12.5px;color:#4a3b2c;',
};

function kvTable(rows) {
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">${rows
    .filter((r) => r && r[1] !== '' && r[1] != null)
    .map((r) => `<tr><td style="${S.td}width:38%;color:#6f6f6f;">${esc(r[0])}</td>`
      + `<td style="${S.td}font-weight:700;">${esc(r[1])}</td></tr>`)
    .join('')}</table>`;
}

/** Free-text list -> <ul>, tolerating commas, newlines, or bullet characters. */
function bulletList(text, emptyNote) {
  const items = String(text || '')
    .split(/[\n;]+|,(?=\s)/)
    .map((s) => s.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);
  if (!items.length) return `<p style="${S.p}">${esc(emptyNote)}</p>`;
  return `<ul style="margin:0 0 10px;padding-left:20px;color:#3a3a3a;">${items
    .map((i) => `<li style="margin-bottom:5px;">${esc(i)}</li>`).join('')}</ul>`;
}

/**
 * Render the full contract as standalone HTML.
 * @param {object} raw  intake payload
 * @param {object} [opt] { signature: dataURL, signerName, signedAt, ip }
 */
export function renderContract(raw, opt) {
  const d = normalize(raw);
  const o = opt || {};
  const c = d.company;

  const balance = Math.max(0, d.price - d.deposit);
  const propertyAddr = [d.address, [d.city, d.state].filter(Boolean).join(', '), d.zip]
    .filter(Boolean).join(' · ');

  const payRows = [];
  if (d.deposit > 0) payRows.push(['Deposit — due upon signing this Agreement', money(d.deposit)]);
  if (d.paymentSchedule && d.paymentSchedule.trim()) {
    String(d.paymentSchedule).split(/\n+/).map((s) => s.trim()).filter(Boolean)
      .forEach((line) => payRows.push([line, '—']));
  } else if (balance > 0) {
    payRows.push(['Balance — due upon substantial completion', money(balance)]);
  }

  const clauses = [

    ['Scope of Work',
      `<p style="${S.p}">The Contractor shall furnish all labor, materials, and equipment necessary to design,
      furnish, and install the following at the Property:</p>`
      + `<p style="${S.p}"><strong>${esc(d.projectType || 'Outdoor structure')}</strong>${
        d.projectDescription ? ` — ${esc(d.projectDescription)}` : ''}</p>`
      + `<p style="${S.p}"><strong>Included in the Contract Price:</strong></p>`
      + bulletList(d.included, 'As described in the project description above.')],

    ['Exclusions',
      `<p style="${S.p}">The following are <strong>not</strong> included in the Contract Price and are the
      Owner's responsibility unless added by written Change Order:</p>`
      + bulletList(d.excluded, 'No specific exclusions were listed at the time of signing.')
      + `<p style="${S.p}">Unless expressly listed as included above, the Contract Price also excludes
      concrete or footing work, structural engineering, electrical and plumbing rough-in, screens or
      enclosures, pavers or decking, drainage work, landscaping restoration, HOA application fees, and
      relocation of irrigation, utilities, or existing structures.</p>`],

    ['Permits & Approvals',
      `<p style="${S.p}">${esc(PERMIT_CLAUSE[d.permit] || PERMIT_CLAUSE['To Be Confirmed'])}</p>`
      + `<p style="${S.p}">Where the Property is subject to a homeowners association or architectural review
      board, the Owner is responsible for obtaining that approval regardless of who obtains the building
      permit, and for any delay or redesign the association requires.</p>`],

    ['Site Conditions & Access',
      `<p style="${S.p}">The Owner shall provide clear access to the work area for crews, materials, and
      equipment, and shall remove or relocate furniture, planters, screens, and other personal property before
      the start date. The Owner is responsible for identifying and marking private underground utilities,
      irrigation lines, low-voltage lighting, septic components, and pool plumbing that are not covered by the
      state's public utility locate service. The Contractor is not liable for damage to unmarked private lines.</p>`
      + `<p style="${S.p}">The Contractor's price assumes the existing slab, footing, or attachment surface is
      structurally sound and suitable for the Work. If inspection or excavation reveals otherwise, the required
      remediation will be quoted as a Change Order before the Work continues.</p>`],

    ['Schedule',
      `<p style="${S.p}">The Work is scheduled to begin on or about <strong>${esc(longDate(d.startDate))}</strong>`
      + (d.durationDays
        ? ` and to reach substantial completion within approximately <strong>${d.durationDays} working day(s)</strong>`
        : '')
      + `, measured from the later of permit issuance and delivery of materials. Completion dates are estimates.
      Delays caused by weather, permitting, HOA review, inspection scheduling, manufacturer lead times, or
      circumstances beyond the Contractor's reasonable control extend the schedule accordingly and do not
      constitute a breach of this Agreement.</p>`],

    ['Change Orders',
      `<p style="${S.p}">Any change to the scope, materials, dimensions, finish, or price must be documented in a
      written Change Order signed by both parties before the additional work begins. Verbal changes are not
      binding. Change Order amounts are due as stated in that Change Order.</p>`],

    ['Warranty',
      `<p style="${S.p}">The Contractor warrants its workmanship against defects for
      <strong>${d.warrantyYears} year(s)</strong> from the date of substantial completion.`
      + (d.manufacturerWarranty
        ? ` Manufactured components carry the manufacturer's warranty: <strong>${esc(d.manufacturerWarranty)}</strong>.`
        : ' Manufactured components carry the applicable manufacturer warranty, which is provided by the'
          + ' manufacturer and not by the Contractor.')
      + `</p>`
      + `<p style="${S.p}">This warranty does not cover normal weathering or fading of finishes, corrosion in
      direct coastal salt exposure where the Owner declined the upgraded finish, damage from named storms, wind
      events exceeding the design rating, impact, structural movement of the host building, work performed by
      others, or failure to perform routine cleaning and maintenance. The warranty is void if the Contract Price
      is not paid in full.</p>`],

    ['Insurance & Liability',
      `<p style="${S.p}">The Contractor carries general liability and workers' compensation insurance;
      certificates are available on request. The Owner is responsible for insuring the Property and its contents.
      The Contractor's total liability under this Agreement shall not exceed the Contract Price, and neither
      party is liable for consequential or incidental damages.</p>`],

    ['Right to Cancel',
      `<p style="${S.p}">The Owner may cancel this Agreement without penalty or obligation within
      <strong>three (3) business days</strong> of the date of signing by delivering written notice to the
      Contractor at ${esc(c.email)} or ${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}. After
      that period, the Owner remains responsible for materials ordered, custom fabrication commenced, and labor
      performed.</p>`],

    ['Default & Collection',
      `<p style="${S.p}">Balances unpaid more than ten (10) days after they become due accrue interest at 1.5%
      per month (18% per annum) or the maximum rate allowed by Florida law, whichever is less. The Owner agrees
      to pay reasonable attorneys' fees and costs incurred in collection. This Agreement is governed by the laws
      of the State of Florida, with venue in the county where the Property is located. This Agreement is the
      entire agreement between the parties and supersedes all prior discussions and proposals.</p>`],
  ];

  const clauseHTML = clauses
    .map((cl, i) => `<h2 style="${S.h2}">${i + 1}. ${esc(cl[0])}</h2>${cl[1]}`)
    .join('');

  const sigBlock = o.signature
    ? `<img src="${esc(o.signature)}" alt="Owner signature" style="max-height:70px;display:block;margin-bottom:4px;">`
      + `<div style="border-top:1px solid #222;padding-top:5px;">${esc(o.signerName || d.clientName)}</div>`
      + `<div style="${S.small}">Signed electronically ${esc(longDate(o.signedAt || new Date().toISOString()))}`
      + (o.ip ? ` · IP ${esc(o.ip)}` : '') + `</div>`
    : `<div style="height:70px;"></div><div style="border-top:1px solid #222;padding-top:5px;">`
      + `${esc(d.clientName || 'Owner')}</div><div style="${S.small}">Date: ____________________</div>`;

  // The contractor countersigns before the contract goes out, so the signature
  // rides along inside the payload rather than being applied at render time.
  const contractorBlock = d.contractorSignature
    ? `<img src="${esc(d.contractorSignature)}" alt="Contractor signature" style="max-height:70px;display:block;margin-bottom:4px;">`
      + `<div style="border-top:1px solid #222;padding-top:5px;">${esc(d.contractorName || c.legal)}`
      + `${c.license ? ` · Lic. #${esc(c.license)}` : ''}</div>`
      + `<div style="${S.small}">Signed electronically ${esc(longDate(d.contractorSignedAt || d.issuedAt))}</div>`
    : `<div style="height:70px;padding-top:26px;font-family:Georgia,serif;font-size:22px;color:#8a5a2b;">${esc(c.name)}</div>`
      + `<div style="border-top:1px solid #222;padding-top:5px;">${esc(c.legal)}${c.license ? ` · Lic. #${esc(c.license)}` : ''}</div>`
      + `<div style="${S.small}">Date: ${esc(longDate(d.issuedAt))}</div>`;

  return `<div style="${S.page}">
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="${S.h1}">${esc((c.name || '').toUpperCase())}</div>
        <div style="${S.small}">${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}<br>
        ${esc(c.phone)} · ${esc(c.email)}${c.license ? `<br>Florida License #${esc(c.license)}` : ''}</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:230px;">
        <div style="font-size:13px;font-weight:800;color:#6e451f;text-transform:uppercase;letter-spacing:.08em;">
          Construction Agreement</div>
        <div style="${S.small}margin-top:4px;">No. <strong style="color:#222;">${esc(d.contractNo)}</strong><br>
        Issued ${esc(longDate(d.issuedAt))}</div>
        ${o.signature ? '<div style="margin-top:8px;display:inline-block;padding:4px 10px;background:#2f6b57;color:#fff;border-radius:99px;font-size:11px;font-weight:700;">SIGNED</div>' : ''}
      </td>
    </tr>
  </table>

  <p style="${S.p}">This Construction Agreement (the &ldquo;Agreement&rdquo;) is entered into between
  <strong>${esc(c.legal)}</strong> (the &ldquo;Contractor&rdquo;) and <strong>${esc(d.clientName || 'the Owner')}</strong>
  (the &ldquo;Owner&rdquo;) for the work described below at the property identified below (the &ldquo;Property&rdquo;).</p>

  <h2 style="${S.h2}">Owner &amp; Property</h2>
  ${kvTable([
    ['Owner', d.clientName],
    ['Email', d.clientEmail],
    ['Phone', d.clientPhone],
    ['Property address', propertyAddr],
  ])}

  <h2 style="${S.h2}">Project Summary</h2>
  ${kvTable([
    ['Project type', d.projectType],
    ['Permits', d.permit],
    ['Estimated start', d.startDate ? longDate(d.startDate) : 'To be scheduled'],
    ['Estimated duration', d.durationDays ? `${d.durationDays} working days` : ''],
    ['Workmanship warranty', `${d.warrantyYears} year(s)`],
  ])}

  <h2 style="${S.h2}">Contract Price &amp; Payment Schedule</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr><th style="${S.th}">Milestone</th><th style="${S.th}width:150px;">Amount</th></tr>
    ${payRows.map((r) => `<tr><td style="${S.td}">${esc(r[0])}</td>`
      + `<td style="${S.td}font-weight:700;">${esc(r[1])}</td></tr>`).join('')}
    <tr><td style="${S.td}font-weight:800;color:#6e451f;">TOTAL CONTRACT PRICE</td>
    <td style="${S.td}font-weight:800;color:#6e451f;font-size:16px;">${money(d.price)}</td></tr>
  </table>
  <p style="${S.small}">Payments are due upon reaching each milestone. Accepted methods: check, ACH, or credit
  card (card payments incur a 3% processing fee).</p>

  ${clauseHTML}

  <div style="${S.note}"><strong>NOTICE TO OWNER — CONSTRUCTION LIEN LAW.</strong> According to Florida law, those
  who work on your property or provide materials and are not paid in full have a right to enforce their claim for
  payment against your property. This claim is known as a construction lien. If your contractor or a subcontractor
  fails to pay subcontractors, suppliers, or laborers, the people who are owed money may look to your property for
  payment, even if you have paid your contractor in full. Protect yourself — ask for a written release of lien from
  anyone who could claim a lien against your property before you make each payment.</div>

  <div style="${S.note}"><strong>NOTICE — FLORIDA HOMEOWNERS' CONSTRUCTION RECOVERY FUND.</strong> Payment may be
  available from the Florida Homeowners' Construction Recovery Fund if you lose money on a project performed under
  contract, where the loss results from specified violations of Florida law by a state-licensed contractor. For
  information about the recovery fund and filing a claim, contact the Florida Construction Industry Licensing Board
  at 2601 Blair Stone Road, Tallahassee, FL 32399-1039, or 850-487-1395.</div>

  <h2 style="${S.h2}">Signatures</h2>
  <p style="${S.p}">By signing below, the Owner acknowledges having read and agreed to every provision of this
  Agreement, including the exclusions, the permit responsibility stated above, and the notices, and authorizes the
  Contractor to proceed with the Work.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:14px;">
    <tr>
      <td style="width:50%;padding-right:24px;vertical-align:bottom;">
        <div style="${S.small}margin-bottom:6px;font-weight:700;color:#6e451f;">OWNER</div>
        ${sigBlock}
      </td>
      <td style="width:50%;vertical-align:bottom;">
        <div style="${S.small}margin-bottom:6px;font-weight:700;color:#6e451f;">CONTRACTOR</div>
        ${contractorBlock}
      </td>
    </tr>
  </table>

  <p style="${S.small}margin-top:24px;text-align:center;">${esc(c.name)} · ${esc(c.phone)} · ${esc(c.site)}
  · Contract ${esc(d.contractNo)}</p>
</div>`;
}

/** Email wrapper. `signUrl` is optional — omit it for the operator's own copy. */
export function renderEmail(raw, signUrl) {
  const d = normalize(raw);
  const c = d.company;
  const cta = signUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${esc(signUrl)}" style="display:inline-block;background:#8a5a2b;color:#ffffff;text-decoration:none;
        padding:14px 30px;border-radius:12px;font-weight:700;font-size:15px;">Review &amp; Sign Your Contract</a>
        <div style="font-size:12px;color:#6f6f6f;margin-top:8px;">Takes about a minute — no account needed.</div>
      </div>`
    : '';
  return `<div style="background:#f8f4ef;padding:24px 12px;">
    <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;
    box-shadow:0 20px 60px rgba(55,35,20,.13);font-family:Arial,Helvetica,sans-serif;">
      <div style="background:#8a5a2b;color:#fff;padding:22px 32px;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.11em;">${esc((c.name || '').toUpperCase())}</div>
        <div style="font-size:13px;color:#f0e2d4;">Contract ${esc(d.contractNo)}</div>
      </div>
      <div style="padding:26px 32px 0;">
        <p style="margin:0 0 10px;color:#3a3a3a;font-size:15px;">Hi ${esc((d.clientName || '').split(' ')[0] || 'there')},</p>
        <p style="margin:0 0 10px;color:#3a3a3a;font-size:15px;">Thanks for choosing ${esc(c.name)}. Your agreement
        for the ${esc(d.projectType || 'project')} at <strong>${esc(d.address || 'your property')}</strong> is below,
        for a total of <strong>${money(d.price)}</strong>. Please review it and reach out with any questions.</p>
        ${cta}
      </div>
      ${renderContract(d)}
    </div>
  </div>`;
}

export default {
  COMPANY, PROJECT_TYPES, PERMIT_OPTIONS,
  renderContract, renderEmail, normalize, money, longDate, esc,
};
