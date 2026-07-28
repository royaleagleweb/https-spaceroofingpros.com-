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
- `contract-bot.html` — **Internal** contract bot (see below), `noindex`
- `contract-sign.html` — Client-facing review & e-sign page, `noindex`

## Structure
```
.
├── index.html
├── services.html
├── about.html
├── contact.html
├── contract-bot.html          # internal tool
├── contract-sign.html         # client signing page
├── assets
│   ├── css/styles.css
│   ├── css/contract-bot.css
│   ├── js/main.js
│   ├── js/contract-template.js   # contract model + renderer (shared)
│   ├── js/contract-bot.js
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
