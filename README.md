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

## Structure
```
.
├── index.html
├── services.html
├── about.html
├── contact.html
├── assets
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

## Local preview
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```
