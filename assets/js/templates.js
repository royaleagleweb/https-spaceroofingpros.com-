/* ============================================================
   Contract template registry
   ------------------------------------------------------------
   Every contract carries a `kind`. The signing page and the
   Worker use it to pick the matching renderer, so one signing
   flow and one delivery endpoint serve all contract types.
   ============================================================ */

import * as roofing from './contract-template.js';
import * as pergola from './pergola-template.js';

const TEMPLATES = {
  roofing,
  pergola,
};

export const KINDS = Object.keys(TEMPLATES);

/** Resolve a template by kind. Falls back to roofing for legacy payloads. */
export function getTemplate(kind) {
  return TEMPLATES[kind] || TEMPLATES.roofing;
}

/** Render any contract, whatever its kind. */
export function renderAny(contract, opt) {
  return getTemplate(contract && contract.kind).renderContract(contract, opt);
}

/** Normalize any contract, whatever its kind. */
export function normalizeAny(contract) {
  return getTemplate(contract && contract.kind).normalize(contract);
}

/** Build the delivery email for any contract kind. */
export function renderEmailAny(contract, signUrl, opts) {
  return getTemplate(contract && contract.kind).renderEmail(contract, signUrl, opts);
}
