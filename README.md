# Space Roofing Pros — Website

A static, multi-page marketing site for a Los Angeles-area roofing contractor inspired by `spaceroofingpros.com`.

## Stack
- Plain HTML5, modern CSS (custom properties, grid/flex), vanilla JavaScript
- Google Fonts: Inter + Poppins
- No build step — open `index.html` in a browser, or serve the folder statically

## Pages
- `index.html` — Home (hero, services grid, about/why us, process, service area, testimonials, CTA)
- `services.html` — Detailed service rows
- `about.html` — Story, values, credentials
- `contact.html` — Contact info + estimate form + map
- `contract-bot.html` — **Internal** roofing contract bot (see below), `noindex`
- `pergola-contract.html` — **Internal** Easy Pergola contract bot, `noindex`
- `contract-sign.html` — Client-facing review & e-sign page (both brands), `noindex`

## Structure
```
.
├── index.html
├── services.html
├── about.html
├── contact.html
├── contract-bot.html          # internal tool — roofing
├── pergola-contract.html      # internal tool — Easy Pergola
├── contract-sign.html         # client signing page (both brands)
├── assets
│   ├── css/styles.css
│   ├── css/contract-bot.css
│   ├── css/pergola.css
│   ├── js/main.js
│   ├── js/templates.js           # kind -> renderer registry
│   ├── js/contract-template.js   # roofing contract model + renderer
│   ├── js/pergola-template.js    # pergola contract model + renderer
│   ├── js/signature-pad.js       # shared canvas signature capture
│   ├── js/contract-bot.js
│   ├── js/pergola-form.js
│   └── js/contract-sign.js
├── worker/                    # optional Cloudflare Worker for email delivery
└── README.md
```

## Local preview
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

The contract pages load ES modules, so they must be served over HTTP — opening
them via `file://` will not work.

---

# Contract Bot

`contract-bot.html` turns a client into a finished, sent contract in about a
minute. It is an internal tool: `noindex`, blocked in `robots.txt`, and not
linked from the public navigation.

**Flow:** one form for every client and property detail → ten short one-at-a-time
questions (job type, roof material, size, insurance vs. private pay, price,
payment split, schedule, warranty, permits, notes) → review and send. The full
contract renders live beside the questions as you type.

## Sending — two modes

**Works right now, no setup.** The bot builds the contract, opens the print
dialog so you can save a PDF, and opens a pre-written email to the client.
There is also a *copy for Gmail* button that puts the formatted contract on the
clipboard so you can paste it straight into a compose window.

**One-click sending (optional).** Deploy the Cloudflare Worker in `worker/`, then
enter its URL and your operator token under **⚙ הגדרות**. The bot then emails the
contract to the client directly, with a link to review and sign it on their
phone. The signed copy lands in the office inbox and the client's inbox. Setup
takes about ten minutes — see [`worker/README.md`](worker/README.md).

The contract travels inside the signing link, signed with HMAC-SHA256, so there
is no database to run and the price cannot be tampered with in transit.

## Contract content

The template covers scope of work, a wood-replacement allowance with unit rates,
schedule, workmanship and manufacturer warranty, change orders, insurance and
liability, a three-day right to cancel, default and collection terms, and
Florida's required Construction Lien Law and Homeowners' Construction Recovery
Fund notices. Insurance-claim jobs get an extra clause covering the deductible
and the fact that the agreement is not an assignment of benefits.

> **Have a Florida construction attorney review the template once before using
> it in production.** The clauses follow standard Florida residential roofing
> practice, but statutory notice wording and thresholds change, and no lawyer has
> reviewed this text.

Company details, license number, and address used in the contract are editable
under **⚙ הגדרות** and stored in the browser.

## Settings and drafts

Settings and the in-progress draft live in `localStorage` on the operator's
machine — the Worker token is never committed to the repo. Anyone using the bot
from another device enters it once on that device.

---

# Easy Pergola Contract Bot

`pergola-contract.html` is a second bot for a different brand, built on the same
engine. It is the v2 branded intake — 15 intake screens, 12 selectable services
that reveal only the matching trade pages, a screen-opening repeater enforcing
the 16 ft standard-size rule, and a 13-row scope table — carried over as
authored. What used to be a dead end (a text summary that explicitly created
nothing) now continues into a real agreement.

## Flow

1. **Intake** — client and co-owner, property and project tracking, services,
   then only the trade pages the selected services require (structure, screens,
   concrete/pavers, electrical, kitchen/bathroom, wall/fence, flooring),
   approvals, scope table, price, schedule, review.
2. **The agreement** — renders in full. An *Adjust* panel changes price,
   deposit, balance, dates, client details, payment terms, clarifications, and
   any scope row's status or detail, rebuilding the contract as you type. The
   deposit + balance = price rule is enforced here as well as at intake.
   *Email a copy to me* sends it to your own inbox with a link that reopens this
   step on any device.
3. **You sign** — the contractor countersigns on a canvas pad.
4. **The client signs** — they receive the agreement already bearing your
   signature. If the intake recorded a co-owner, the Worker hands the baton to
   them automatically once the first owner signs, and only then is the contract
   marked fully executed and mailed to all parties.

## What the agreement contains

Parties and property, services, per-trade specification tables for whatever was
selected, the governing included/excluded scope table, permit / engineering /
HOA / survey responsibility (with the homeowner-permit clause swapped in when
that option is chosen), standard exclusions, price and payment schedule,
schedule, change orders, site conditions, warranty, liability, three-day right
to cancel, collection terms, and the Florida Construction Lien Law and
Recovery Fund notices.

## Shared engine

Every contract carries a `kind`. `assets/js/templates.js` maps it to a renderer,
so `contract-sign.html` and the Worker serve both brands from one code path —
the signing page takes its name, license, and phone from the contract itself,
and works out whether the visitor is the owner or the co-owner from the
payload's own state rather than trusting the request.

Signatures are trimmed to the ink bounding box and downscaled before encoding,
keeping each one around 7 KB — they have to fit inside the signing link.

> The template has **not** been reviewed by a lawyer. Company details ship as
> placeholders — set the real trade name, legal name, license number, and
> address under *Company settings* before sending anything to a client.

## Known limitation: signing links are reusable

The design is deliberately stateless — the agreement travels inside the link, so
there is no database to run. The cost is that a signing link is a bearer
capability with no server-side record of having been used. Anyone holding the
link can submit a second signature under a different name, producing another
executed copy. The blast radius is small (recipients are fixed to the office
address and the party addresses inside the HMAC-verified payload, so it cannot
be used to mail strangers), but it is real. Closing it properly needs a stored
record of consumed links — a Cloudflare KV namespace and a check in
`handleSign` would do it. Adding an `exp` timestamp to the payload narrows the
window without any storage.
