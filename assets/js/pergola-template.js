/* ============================================================
   Easy Pergola — contract model + renderer
   ------------------------------------------------------------
   Consumes the v2 intake data model (services, scope table,
   screen openings, trade sections, approvals, price schedule).
   Same exported shape as contract-template.js so the signing
   page and the Worker can render either kind.
   ============================================================ */

import { money, longDate, esc, contractNumber } from './contract-template.js';

export { money, longDate, esc };

export const COMPANY = {
  name: 'Easy Pergola',
  legal: 'Easy Pergola LLC',
  tagline: 'Backyard Specialists',
  license: 'CBC0000000',
  address: '000 Example Blvd',
  city: 'Hollywood',
  state: 'FL',
  zip: '33020',
  phone: '(954) 000-0000',
  email: 'office@easypergola.com',
  site: 'easypergola.com',
  logo: 'assets/img/easy-pergola-logo.png',
};

/* ---------------- Intake vocabulary ---------------- */

export const SERVICES = [
  { id: 'Aluminum Pergola', note: 'Attached or freestanding' },
  { id: 'Patio Cover', note: 'Insulated roof system' },
  { id: 'Regular Screens', note: 'Standard manual screen openings' },
  { id: 'Motorized Screens', note: 'Powered retractable screens' },
  { id: 'Concrete Slab', note: 'New slab or slab extension' },
  { id: 'Pavers', note: 'Removal, reset, or new pavers' },
  { id: 'Electrical', note: 'Fans, lights, switches, outlets' },
  { id: 'Outdoor Kitchen', note: 'Cabinets, countertop, appliances' },
  { id: 'Outdoor Bathroom', note: 'Toilet, sink, plumbing' },
  { id: 'Decorative Wall / Fence', note: 'Privacy, finish, storage enclosure' },
  { id: 'Flooring / Turf / Landscaping', note: 'Finish work around the project' },
  { id: 'Other', note: 'Any additional improvement' },
];

export const SCOPE_CATEGORIES = [
  'Pergola structure & roof',
  'Engineering / structural plans',
  'Permit / expeditor / city fee',
  'Concrete slab / footings',
  'Paver removal / reset',
  'Electrical / lights / fans',
  'Regular screens',
  'Motorized screens',
  'Outdoor kitchen / plumbing',
  'Outdoor bathroom',
  'Flooring / turf / landscaping',
  'Decorative wall / fence finish',
  'Other',
];

export const STATUS_OPTIONS = [
  'INCLUDED', 'EXCLUDED', 'HOMEOWNER RESPONSIBILITY', 'CONTRACTOR RESPONSIBILITY',
  'BY OTHERS', 'ALLOWANCE', 'NOT APPLICABLE', 'NOT DECIDED',
];

/* Which services light up which scope row. Rows 1 and 2 come from the
   engineering/permit answers instead. */
export const SCOPE_SERVICE_MAP = [
  ['Aluminum Pergola', 'Patio Cover'], [], [],
  ['Concrete Slab'], ['Pavers'], ['Electrical'],
  ['Regular Screens'], ['Motorized Screens'],
  ['Outdoor Kitchen'], ['Outdoor Bathroom'],
  ['Flooring / Turf / Landscaping'], ['Decorative Wall / Fence'], ['Other'],
];

/* ---------------- Normalize ---------------- */

export function normalize(raw) {
  const d = Object.assign({}, raw);
  d.kind = 'pergola';
  d.company = Object.assign({}, COMPANY, raw.company || {});
  d.contractNo = d.contractNo || contractNumber('EP');
  d.agreementDate = d.agreementDate || new Date().toISOString().slice(0, 10);
  d.state = d.state || 'FL';
  d.services = Array.isArray(d.services) ? d.services : [];
  d.scope = Array.isArray(d.scope) ? d.scope : [];
  d.screens = Array.isArray(d.screens) ? d.screens : [];
  d.contractPrice = Number(d.contractPrice || 0);
  d.deposit = Number(d.deposit || 0);
  d.balance = Number(d.balance || 0);
  return d;
}

export function hasService(d, name) {
  return (d.services || []).includes(name);
}

/** Deposit + balance must equal the contract price. Returns '' when fine. */
export function paymentCheck(d) {
  const price = Number(d.contractPrice || 0);
  const dep = Number(d.deposit || 0);
  const bal = Number(d.balance || 0);
  if (price && Math.abs((dep + bal) - price) > 0.005) {
    return `Deposit plus balance is ${money(dep + bal)}, not ${money(price)}.`;
  }
  return '';
}

/* ---------------- Styles (inline for email clients) ---------------- */

const S = {
  page: 'max-width:820px;margin:0 auto;padding:32px;background:#ffffff;color:#202020;'
    + 'font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;',
  h2: 'margin:24px 0 9px;font-size:13px;font-weight:800;color:#6f451f;text-transform:uppercase;'
    + 'letter-spacing:.07em;border-bottom:2px solid #8a5a2b;padding-bottom:5px;',
  h3: 'margin:14px 0 6px;font-size:12.5px;font-weight:800;color:#202020;text-transform:uppercase;letter-spacing:.04em;',
  p: 'margin:0 0 9px;color:#3a3a3a;',
  small: 'font-size:11.5px;color:#6f6a65;',
  td: 'padding:7px 9px;border-bottom:1px solid #e6dbd0;vertical-align:top;',
  th: 'text-align:left;padding:7px 9px;background:#faf7f3;color:#6f451f;font-size:11px;'
    + 'text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #ddd4cb;',
  note: 'margin:12px 0;padding:11px 13px;background:#faf7f3;border-left:4px solid #8a5a2b;'
    + 'border-radius:6px;font-size:11.5px;color:#4a3b2c;',
};

const STATUS_COLOR = {
  INCLUDED: '#2f6b57',
  EXCLUDED: '#9d3f3f',
  'HOMEOWNER RESPONSIBILITY': '#9d3f3f',
  'CONTRACTOR RESPONSIBILITY': '#2f6b57',
  'BY OTHERS': '#9d3f3f',
  ALLOWANCE: '#8a5a2b',
  'NOT APPLICABLE': '#6f6a65',
  'NOT DECIDED': '#9d3f3f',
};

function kv(rows) {
  const live = rows.filter((r) => r && r[1] !== '' && r[1] != null && r[1] !== 'Not entered');
  if (!live.length) return '';
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">${live
    .map((r) => `<tr><td style="${S.td}width:38%;color:#6f6a65;">${esc(r[0])}</td>`
      + `<td style="${S.td}font-weight:700;">${esc(r[1])}</td></tr>`).join('')}</table>`;
}

function para(text) {
  return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => `<p style="${S.p}">${esc(s)}</p>`).join('');
}

/* ---------------- Trade detail sections ---------------- */

function tradeSections(d) {
  const out = [];

  if (hasService(d, 'Aluminum Pergola') || hasService(d, 'Patio Cover')) {
    out.push(['Structure Specifications', kv([
      ['Dimensions', [d.width, d.depth].filter(Boolean).join(' × ')],
      ['Overall height', d.height],
      ['Attachment', d.attachment],
      ['Frame / color', d.frameColor],
      ['Roof system', d.roofSystem],
      ['Ceiling finish', d.ceilingFinish],
      ['Gutter system', d.gutter],
      ['Posts', d.posts],
      ['Ceiling fans', d.fans],
      ['Recessed lights', d.lights],
      ['Structural layout', d.structuralLayout],
    ])]);
  }

  if (d.screens.length && (hasService(d, 'Regular Screens') || hasService(d, 'Motorized Screens'))) {
    const rows = d.screens.map((s) => `<tr>
      <td style="${S.td}">${esc(s.label || '')}</td>
      <td style="${S.td}">${esc(s.width || '?')} ft × ${esc(s.height || '?')} ft</td>
      <td style="${S.td}">${esc(s.type || '')}</td>
      <td style="${S.td}">${esc(s.sizeClass || '')}</td></tr>`).join('');
    out.push(['Screen Openings',
      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tr><th style="${S.th}">Opening</th><th style="${S.th}">Size</th>
        <th style="${S.th}">Type</th><th style="${S.th}">Class</th></tr>${rows}</table>`
      + kv([
        ['Installed on', d.screenInstalledOn],
        ['Frame / mesh color', d.screenColor],
        ['Power available', hasService(d, 'Motorized Screens') ? d.screenPower : ''],
        ['Operation', hasService(d, 'Motorized Screens') ? d.screenOperation : ''],
        ['Screen electrical', hasService(d, 'Motorized Screens') ? d.screenElectrical : ''],
      ])
      + `<p style="${S.small}">Standard screen openings measure up to 16 ft. Openings marked Jumbo or
      Split reflect that limit. Final sizes are confirmed by field measurement.</p>`]);
  }

  if (hasService(d, 'Concrete Slab') || hasService(d, 'Pavers')) {
    let body = '';
    if (hasService(d, 'Concrete Slab')) {
      body += `<h3 style="${S.h3}">Concrete slab</h3>` + kv([
        ['Approximate area', d.concreteSf ? `${d.concreteSf} sq ft` : ''],
        ['Thickness', d.concreteThickness],
        ['New slab or extension', d.concreteType],
        ['Field preparation', d.fieldPreparation],
        ['Attach to existing slab', d.attachExistingSlab],
        ['Existing concrete demolition', d.concreteDemo],
        ['Reinforcement', d.concreteReinforcement],
        ['Finish', d.concreteFinish],
        ['Truck / pump access', d.concreteAccess],
      ]);
    }
    if (hasService(d, 'Pavers')) {
      body += `<h3 style="${S.h3}">Pavers</h3>` + kv([
        ['Approximate area', d.paverSf ? `${d.paverSf} sq ft` : ''],
        ['Work type', d.paverType],
        ['Matching', d.paverMatch],
      ]);
    }
    out.push(['Concrete &amp; Hardscape', body
      + `<p style="${S.small}">Concrete quantities are approximate and confirmed by field measurement.
      Where a concrete pump or limited-access placement becomes necessary, the added cost is handled by
      written Change Order.</p>`]);
  }

  if (hasService(d, 'Electrical')) {
    out.push(['Electrical', kv([
      ['Existing power nearby', d.powerNearby],
      ['New circuit required', d.newCircuit],
      ['Panel upgrade expected', d.panelUpgrade],
      ['Fans', d.electricalFans],
      ['Lights', d.electricalLights],
      ['Outlets / appliance connections', d.electricalOutlets],
      ['Switch setup', d.switchSetup],
      ['Electrical permit', d.electricalPermit],
      ['Final connections by', d.finalConnections],
    ])
      + `<p style="${S.small}">Electrical work is limited to what is listed above. Panel upgrades, service
      changes, and utility coordination are excluded unless expressly listed as included.</p>`]);
  }

  if (hasService(d, 'Outdoor Kitchen') || hasService(d, 'Outdoor Bathroom')) {
    let body = '';
    if (hasService(d, 'Outdoor Kitchen')) {
      body += `<h3 style="${S.h3}">Outdoor kitchen</h3>` + kv([
        ['Length / layout', d.kitchenLayout],
        ['Cabinet structure', d.kitchenCabinets],
        ['Countertop', d.countertop],
        ['Appliances included', d.appliances],
        ['Plumbing included', d.kitchenPlumbing],
        ['Gas connection included', d.kitchenGas],
      ]);
    }
    if (hasService(d, 'Outdoor Bathroom')) {
      body += `<h3 style="${S.h3}">Outdoor bathroom</h3>` + kv([
        ['Room size', d.bathroomSize],
        ['Fixtures', d.bathroomFixtures],
        ['Waste connection', d.wasteConnection],
        ['Water connection', d.waterConnection],
        ['Walls / roof', d.bathroomStructure],
        ['Interior finish', d.bathroomFinish],
      ]);
    }
    out.push(['Outdoor Rooms', body
      + `<p style="${S.small}">Appliances not listed above are supplied by the Owner. Connection of
      Owner-supplied appliances is included only where stated.</p>`]);
  }

  if (hasService(d, 'Decorative Wall / Fence')) {
    out.push(['Wall / Fence / Enclosure', kv([
      ['Type', d.decorativeType],
      ['Length', d.decorativeLength],
      ['Height', d.decorativeHeight],
      ['Material', d.decorativeMaterial],
      ['Color / finish', d.decorativeFinish],
      ['Gate or access door', d.decorativeGate],
    ])]);
  }

  if (hasService(d, 'Flooring / Turf / Landscaping')) {
    out.push(['Flooring / Turf / Landscaping', kv([
      ['Service type', d.finishService],
      ['Approximate area', d.finishSf ? `${d.finishSf} sq ft` : ''],
      ['Material / style', d.finishMaterial],
    ]) + (d.finishPreparation ? `<h3 style="${S.h3}">Preparation</h3>${para(d.finishPreparation)}` : '')]);
  }

  return out;
}

/* ---------------- Legal clauses ---------------- */

function legalClauses(d) {
  const c = d.company;
  const permitOwner = d.permitResponsibility === 'Homeowner responsibility';

  return [
    ['Permits, Engineering &amp; Approvals',
      kv([
        ['Building permit', d.permitResponsibility],
        ['Engineering / structural plans', d.engineeringResponsibility],
        ['HOA / architectural approval', d.hoaResponsibility],
        ['Survey and property lines', d.surveyResponsibility],
      ])
      + (permitOwner
        ? `<p style="${S.p}"><strong>Homeowner permit responsibility.</strong> The Owner is responsible for
          applying for and obtaining all building permits and governmental approvals, for paying all related
          fees, and for scheduling inspections. The Contractor will not begin work until the Owner provides
          evidence that the required permits have been issued. Any delay, redesign, fine, or additional cost
          arising from permitting is the Owner's responsibility and does not constitute a breach by the
          Contractor.</p>`
        : `<p style="${S.p}">The Contractor shall apply for and obtain the building permits required for the
          Work and shall coordinate municipal inspections. The Owner shall sign any application the permitting
          authority requires from the property owner and shall provide access for inspections.</p>`)
      + `<p style="${S.p}">Unless stated as included above, the Owner is responsible for homeowners
      association and architectural review approval, and for surveys, easements, setbacks, and property-line
      verification. The Contractor does not verify property lines and relies on the Owner's direction as to
      the location of the Work.</p>`],

    ['Site Conditions &amp; Access',
      `<p style="${S.p}">The Owner shall provide clear access for crews, materials, and equipment, and shall
      remove or relocate furniture, planters, screens, and other personal property before work begins. The
      Owner is responsible for identifying and marking private underground utilities, irrigation lines,
      low-voltage lighting, septic components, and pool plumbing not covered by the state's public locate
      service. The Contractor is not liable for damage to unmarked private lines.</p>`
      + `<p style="${S.p}">Prices assume normal soil conditions and that existing slabs, footings, and
      attachment surfaces are structurally sound. Rock, high water table, unsuitable soil, or unsound existing
      construction discovered during the Work is handled by written Change Order.</p>`
      + `<p style="${S.p}">${d.cleanup === 'Yes — specifically included'
        ? 'Whole-property cleanup is specifically included in the Contract Price.'
        : 'Normal jobsite cleanup is included. Whole-property cleanup, pressure washing, and restoration of '
          + 'landscaping or sod disturbed by necessary access are not included.'}</p>`],

    ['Change Orders',
      `<p style="${S.p}">Any change to the scope, materials, dimensions, finish, or price must be documented
      in a written Change Order signed by both parties before the additional work begins. Verbal changes are
      not binding. Amounts stated in a Change Order are due as set out in that Change Order.</p>`],

    ['Warranty',
      `<p style="${S.p}">The Contractor warrants its workmanship against defects for one (1) year from the
      date of substantial completion. Manufactured components carry the applicable manufacturer warranty,
      which is provided by the manufacturer and not by the Contractor.</p>`
      + `<p style="${S.p}">This warranty does not cover normal weathering or fading of finishes, corrosion in
      direct coastal salt exposure, damage from named storms or wind events exceeding the design rating,
      impact, movement or settlement of the host structure or soil, work performed by others, or failure to
      perform routine cleaning and maintenance. The warranty is void if the Contract Price is not paid in
      full.</p>`],

    ['Insurance &amp; Liability',
      `<p style="${S.p}">The Contractor carries general liability and workers' compensation insurance;
      certificates are available on request. The Owner is responsible for insuring the Property and its
      contents. The Contractor's total liability under this Agreement shall not exceed the Contract Price, and
      neither party is liable for consequential or incidental damages.</p>`],

    ['Right to Cancel',
      `<p style="${S.p}">The Owner may cancel this Agreement without penalty or obligation within
      <strong>three (3) business days</strong> of signing`
      + (d.cancellationDeadline ? ` (on or before <strong>${esc(longDate(d.cancellationDeadline))}</strong>)` : '')
      + ` by delivering written notice to the Contractor at ${esc(c.email)} or ${esc(c.address)},
      ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}. After that period, the Owner remains responsible for
      materials ordered, custom fabrication commenced, engineering and permit work performed, and labor
      completed.</p>`],

    ['Default &amp; Collection',
      `<p style="${S.p}">Balances unpaid more than ten (10) days after they become due accrue interest at
      1.5% per month (18% per annum) or the maximum rate allowed by Florida law, whichever is less. The Owner
      agrees to pay reasonable attorneys' fees and costs incurred in collection. This Agreement is governed by
      the laws of the State of Florida, with venue in the county where the Property is located, and
      constitutes the entire agreement between the parties, superseding all prior proposals and
      discussions.</p>`],
  ];
}

/* ---------------- Signature blocks ---------------- */

function sigBlock(name, sigData, signedAt, ip, roleLabel) {
  const inner = sigData
    ? `<img src="${esc(sigData)}" alt="${esc(roleLabel)} signature" style="max-height:64px;display:block;margin-bottom:4px;">`
      + `<div style="border-top:1px solid #202020;padding-top:5px;">${esc(name)}</div>`
      + `<div style="${S.small}">Signed electronically ${esc(longDate(signedAt))}${ip ? ` · IP ${esc(ip)}` : ''}</div>`
    : `<div style="height:64px;"></div><div style="border-top:1px solid #202020;padding-top:5px;">${esc(name || '')}</div>`
      + `<div style="${S.small}">Date: ____________________</div>`;
  return `<div style="${S.small}margin-bottom:6px;font-weight:700;color:#6f451f;">${esc(roleLabel)}</div>${inner}`;
}

/* ---------------- Renderer ---------------- */

/**
 * @param {object} raw   intake payload
 * @param {object} [opt] { signature, signerName, signedAt, ip } for the party signing right now
 */
export function renderContract(raw, opt) {
  const d = normalize(raw);
  const o = opt || {};
  const c = d.company;
  const hasCo = d.hasCoOwner === 'Yes';

  // The party signing now is whoever the caller passes; earlier signatures ride
  // in the payload so they survive into every later copy.
  const ownerSig = d.ownerSignature || (o.role !== 'coOwner' ? o.signature : '');
  const ownerName = d.ownerSignedName || (o.role !== 'coOwner' ? o.signerName : '') || d.clientName;
  const ownerAt = d.ownerSignedAt || (o.role !== 'coOwner' ? o.signedAt : '');
  const ownerIp = d.ownerSignedIp || (o.role !== 'coOwner' ? o.ip : '');

  const coSig = d.coOwnerSignature || (o.role === 'coOwner' ? o.signature : '');
  const coName = d.coOwnerSignedName || (o.role === 'coOwner' ? o.signerName : '') || d.coOwnerName;
  const coAt = d.coOwnerSignedAt || (o.role === 'coOwner' ? o.signedAt : '');
  const coIp = d.coOwnerSignedIp || (o.role === 'coOwner' ? o.ip : '');

  const fullyExecuted = !!(ownerSig && d.contractorSignature && (!hasCo || coSig));

  const scopeRows = (d.scope || []).map((s) => `<tr>
    <td style="${S.td}">${esc(s.category)}</td>
    <td style="${S.td}font-weight:800;color:${STATUS_COLOR[s.status] || '#202020'};white-space:nowrap;">${esc(s.status)}</td>
    <td style="${S.td}${S.small}">${esc(s.detail || '')}</td></tr>`).join('');

  const payRows = [];
  if (d.deposit > 0) payRows.push(['Deposit — due upon signing this Agreement', money(d.deposit)]);
  if (d.balance > 0) payRows.push(['Balance — due upon substantial completion', money(d.balance)]);

  const trades = tradeSections(d);
  const clauses = legalClauses(d);
  let n = 0;
  const section = (title, body) => { n += 1; return `<h2 style="${S.h2}">${n}. ${title}</h2>${body}`; };

  return `<div style="${S.page}">

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="vertical-align:top;">
        <img src="${esc(c.logo)}" alt="${esc(c.name)}" style="height:52px;display:block;margin-bottom:8px;">
        <div style="${S.small}">${esc(c.address)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.zip)}<br>
        ${esc(c.phone)} · ${esc(c.email)}${c.license ? `<br>Florida License #${esc(c.license)}` : ''}</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:230px;">
        <div style="font-size:12.5px;font-weight:800;color:#6f451f;text-transform:uppercase;letter-spacing:.08em;">
          Project Agreement</div>
        <div style="${S.small}margin-top:4px;">No. <strong style="color:#202020;">${esc(d.contractNo)}</strong>
        ${d.projectId ? `<br>Project ${esc(d.projectId)}` : ''}
        <br>Dated ${esc(longDate(d.agreementDate))}</div>
        ${fullyExecuted
          ? '<div style="margin-top:8px;display:inline-block;padding:4px 10px;background:#2f6b57;color:#fff;border-radius:99px;font-size:10.5px;font-weight:700;">FULLY EXECUTED</div>'
          : d.contractorSignature
            ? '<div style="margin-top:8px;display:inline-block;padding:4px 10px;background:#8a5a2b;color:#fff;border-radius:99px;font-size:10.5px;font-weight:700;">AWAITING OWNER</div>'
            : ''}
      </td>
    </tr>
  </table>

  <p style="${S.p}">This Project Agreement (the &ldquo;Agreement&rdquo;) is entered into between
  <strong>${esc(c.legal)}</strong> (the &ldquo;Contractor&rdquo;) and
  <strong>${esc(d.clientName || 'the Owner')}</strong>${hasCo && d.coOwnerName ? ` and <strong>${esc(d.coOwnerName)}</strong>` : ''}
  (the &ldquo;Owner&rdquo;) for the work described below at the property identified below (the
  &ldquo;Property&rdquo;).</p>

  ${section('Owner &amp; Property', kv([
    ['Owner', d.clientName],
    ['Email', d.clientEmail],
    ['Phone', d.clientPhone],
    ['Co-owner', hasCo ? d.coOwnerName : ''],
    ['Co-owner email', hasCo ? d.coOwnerEmail : ''],
    ['Property address', [d.address, [d.city, d.state].filter(Boolean).join(', '), d.zip].filter(Boolean).join(' · ')],
    ['Sales representative', d.salesRep],
  ]))}

  ${section('Scope of Work', `
    <p style="${S.p}"><strong>Services included:</strong> ${esc((d.services || []).join(', ') || 'See scope table below')}</p>
    ${d.projectSummary ? para(d.projectSummary) : ''}
  `)}

  ${trades.map(([title, body]) => section(title, body)).join('')}

  ${section('Included &amp; Excluded Scope', `
    <p style="${S.p}">The table below governs. Anything not marked INCLUDED or CONTRACTOR RESPONSIBILITY is
    not part of the Contract Price.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr><th style="${S.th}">Category</th><th style="${S.th}">Status</th><th style="${S.th}">Detail</th></tr>
      ${scopeRows}
    </table>
    <p style="${S.p}">Unless expressly marked INCLUDED above, the Contract Price excludes structural
    engineering, permit and impact fees, soil or drainage remediation, irrigation and landscape restoration,
    pool or screen enclosure modification, roof or fascia repair, gas and plumbing runs, panel upgrades, and
    HOA application fees.</p>
    ${d.clarifications ? `<h3 style="${S.h3}">Additional exclusions and clarifications</h3>${para(d.clarifications)}` : ''}
  `)}

  ${clauses.slice(0, 1).map(([t, b]) => section(t, b)).join('')}

  ${section('Contract Price &amp; Payment', `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr><th style="${S.th}">Milestone</th><th style="${S.th}width:150px;">Amount</th></tr>
      ${payRows.map((r) => `<tr><td style="${S.td}">${esc(r[0])}</td>
        <td style="${S.td}font-weight:700;">${esc(r[1])}</td></tr>`).join('')}
      <tr><td style="${S.td}font-weight:800;color:#6f451f;">TOTAL CONTRACT PRICE</td>
      <td style="${S.td}font-weight:800;color:#6f451f;font-size:15px;">${money(d.contractPrice)}</td></tr>
    </table>
    ${kv([
      ['Payment method', d.paymentMethod],
      ['Financing company', d.financeCompany],
    ])}
    ${d.paymentTerms ? `<h3 style="${S.h3}">Payment terms</h3>${para(d.paymentTerms)}` : ''}
  `)}

  ${section('Schedule', `
    ${kv([
      ['Estimated start', d.estimatedStart],
      ['Estimated completion', d.estimatedCompletion],
    ])}
    <p style="${S.p}">Dates are good-faith estimates measured from the later of permit issuance, HOA
    approval, and delivery of materials. Delays caused by weather, permitting, association review, inspection
    scheduling, manufacturer lead times, or other circumstances beyond the Contractor's reasonable control
    extend the schedule accordingly and do not constitute a breach.</p>
  `)}

  ${clauses.slice(1).map(([t, b]) => section(t, b)).join('')}

  <div style="${S.note}"><strong>NOTICE TO OWNER — CONSTRUCTION LIEN LAW.</strong> According to Florida law,
  those who work on your property or provide materials and are not paid in full have a right to enforce their
  claim for payment against your property. This claim is known as a construction lien. If your contractor or a
  subcontractor fails to pay subcontractors, suppliers, or laborers, the people who are owed money may look to
  your property for payment, even if you have paid your contractor in full. Protect yourself — ask for a
  written release of lien from anyone who could claim a lien against your property before you make each
  payment.</div>

  <div style="${S.note}"><strong>NOTICE — FLORIDA HOMEOWNERS' CONSTRUCTION RECOVERY FUND.</strong> Payment may
  be available from the Florida Homeowners' Construction Recovery Fund if you lose money on a project performed
  under contract, where the loss results from specified violations of Florida law by a state-licensed
  contractor. For information about the recovery fund and filing a claim, contact the Florida Construction
  Industry Licensing Board at 2601 Blair Stone Road, Tallahassee, FL 32399-1039, or 850-487-1395.</div>

  <h2 style="${S.h2}">Signatures</h2>
  <p style="${S.p}">By signing below, the Owner acknowledges having read and agreed to every provision of this
  Agreement, including the included-and-excluded scope table, the responsibility assignments, and the notices
  above, and authorizes the Contractor to proceed with the Work.</p>

  <table style="width:100%;border-collapse:collapse;margin-top:12px;">
    <tr>
      <td style="width:50%;padding-right:22px;vertical-align:bottom;padding-bottom:18px;">
        ${sigBlock(ownerName, ownerSig, ownerAt || d.agreementDate, ownerIp, 'OWNER')}
      </td>
      <td style="width:50%;vertical-align:bottom;padding-bottom:18px;">
        ${sigBlock(d.contractorName || d.companyRep || c.legal, d.contractorSignature,
          d.contractorSignedAt || d.agreementDate, '', 'CONTRACTOR')}
        ${c.license ? `<div style="${S.small}">${esc(c.legal)} · Lic. #${esc(c.license)}</div>` : ''}
      </td>
    </tr>
    ${hasCo ? `<tr><td style="vertical-align:bottom;padding-right:22px;">
      ${sigBlock(coName, coSig, coAt || d.agreementDate, coIp, 'CO-OWNER')}
    </td><td></td></tr>` : ''}
  </table>

  <p style="${S.small}margin-top:22px;text-align:center;">${esc(c.name)} · ${esc(c.phone)} · ${esc(c.site)}
  · Agreement ${esc(d.contractNo)}</p>
</div>`;
}

/** Email wrapper. `signUrl` omitted for the operator's own copy. */
export function renderEmail(raw, signUrl, opts) {
  const d = normalize(raw);
  const o = opts || {};
  const c = d.company;
  const greeting = o.greetingName || (d.clientName || '').split(' ')[0] || 'there';
  const cta = signUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${esc(signUrl)}" style="display:inline-block;background:#8a5a2b;color:#ffffff;
        text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:700;font-size:15px;">
        Review &amp; Sign Your Agreement</a>
        <div style="font-size:12px;color:#6f6a65;margin-top:8px;">Takes about a minute — no account needed.</div>
      </div>`
    : '';
  return `<div style="background:#faf7f3;padding:24px 12px;">
    <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;
    box-shadow:0 22px 70px rgba(62,42,25,.14);font-family:Arial,Helvetica,sans-serif;">
      <div style="padding:22px 32px 0;">
        <img src="${esc(c.logo)}" alt="${esc(c.name)}" style="height:44px;display:block;margin-bottom:16px;">
        <p style="margin:0 0 10px;color:#3a3a3a;font-size:15px;">Hi ${esc(greeting)},</p>
        <p style="margin:0 0 10px;color:#3a3a3a;font-size:15px;">${esc(o.intro
          || `Thanks for choosing ${c.name}. Your agreement for the work at ${d.address || 'your property'} is below, for a total of ${money(d.contractPrice)}. Please review it and reach out with any questions.`)}</p>
        ${cta}
      </div>
      ${renderContract(d)}
    </div>
  </div>`;
}

export default {
  COMPANY, SERVICES, SCOPE_CATEGORIES, STATUS_OPTIONS, SCOPE_SERVICE_MAP,
  renderContract, renderEmail, normalize, hasService, paymentCheck, money, longDate, esc,
};
