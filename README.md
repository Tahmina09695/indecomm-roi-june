# Indecomm ROI Calculator (MVP — Post-Close QC)

A web-based replacement for the Excel ROI models. Lets a sales rep and a prospect/client
together calculate the **true in-house cost** of a mortgage operations function
(headcount, salaries, supervision, benefits, indirect costs) and compare it to
**Indecomm's outsourced pricing**, delivered on the **AuditGenius®** platform.

The MVP ships **one fully polished calculator (PCQC)** end-to-end. The architecture
is config-driven so the other 6 models (PFQC, Servicing QC, PCH Post-Close, PCH
Trailing Docs, PPR, Underwriting) can be added later with a single config file each.

---

## Running locally

Requires Node.js ≥ 18 (recommended: 20.x).

```bash
# 1. install
npm install --ignore-scripts   # --ignore-scripts is only needed in restricted shells

# 2. dev server (http://localhost:3000)
npm run dev

# 3. unit tests (validate engine vs. Excel)
npm run test
```

Production build:

```bash
npm run build
npm run start
```

---

## Verified

- ✅ TypeScript compiles
- ✅ `npm run build` succeeds (static + dynamic routes)
- ✅ Engine unit tests: **10/10 pass** — outputs match the Excel
  PCQC model exactly (Internal $487,640.625 / Indecomm $264,600 / Savings 45.74%)
- ✅ Landing and `/calculator/pcqc` routes return HTTP 200 in production mode

---

## Sharing model (no backend)

- Every change is encoded into the URL hash (`#d=…`) ~250ms after edit.
- "Copy Share Link" copies the current URL — anyone with it sees & can edit
  the exact scenario.
- A copy is also auto-saved to `localStorage` so refreshing keeps your work.
- "Export PDF" triggers the browser print dialog → a one-page executive
  summary with logos, KPIs, assumptions, and per-loan view.
- "Export JSON" downloads a portable file that can be re-shared.

---

## Brand standards (applied)

Source: *Indecomm Brand Standards Guide PowerPoint.docx*

| Token            | Hex      | Used for                             |
|------------------|----------|--------------------------------------|
| Navy Blue        | #002060  | Primary background, headings         |
| Orange           | #F1A421  | **AuditGenius** accent (PCQC primary)|
| Deep Blue        | #2076BA  | Chart accent (Decision/IDXGenius)    |
| Light Blue       | #2BA8E0  | Chart accent                         |
| Green            | #8BCC9A  | BotGenius accent                     |
| Purple           | #8064A2  | DocGenius accent                     |
| Pink             | #FF0066  | IncomeGenius accent                  |
| Open Sans        | —        | Font (loaded from Google Fonts)      |

The PCQC calculator uses **orange (#F1A421)** as the highlight color
because **AuditGenius is the platform powering PCQC** — this is the
sales differentiator surfaced via the platform callout banner and the
"in-house cost composition" chart's hidden-cost segment.

---

## Adding a new ROI model (config-only)

1. Create `src/models/<modelId>.ts` exporting a `ModelConfig` object — see
   `src/models/pcqc.ts` for a worked example.
2. Register it in `src/models/index.ts`:
   ```ts
   import { newModel } from "./newModel";
   export const MODELS = { pcqc, newModel };
   ```
3. Done. The landing page picks it up automatically.

For a model with a different shape (e.g., per-FTE pricing instead of per-loan),
the engine already handles both — see `PerFTEPricing` in `src/models/_types.ts`.

---

## Logos

- `public/logos/indecomm.png` — corporate logo
- `public/logos/auditgenius.svg` — **placeholder** wordmark using brand colors

To swap in the official AuditGenius PNG: drop it at `public/logos/auditgenius.png`
and update `src/models/pcqc.ts` (`platform.logo`) accordingly. Same pattern for
other product logos (BotGenius, DecisionGenius, DocGenius, IDXGenius, IncomeGenius)
when you build their respective calculators.

---

## File map

```
src/
├── app/                       # Next.js App Router pages
│   ├── page.tsx               # landing page with model tiles
│   ├── calculator/[modelId]/  # calculator route
│   └── globals.css            # Tailwind + print styles
├── components/                # React UI components
├── lib/
│   ├── engine.ts              # pure ROI calculation engine
│   ├── engine.test.ts         # 10 vitest assertions vs. Excel numbers
│   ├── share.ts               # URL hash + localStorage
│   └── format.ts              # currency / percent / number formatters
├── models/
│   ├── _types.ts              # ModelConfig type system
│   ├── pcqc.ts                # Post-Close QC model (MVP)
│   └── index.ts               # registry + "coming soon" list
└── store/scenarioStore.ts     # Zustand store for live scenario state
```

---

## Deploy

The app is a standard Next.js project. Easiest path:

- **Vercel**: `vercel` from the project root (zero config).
- **Netlify**: add `npm run build` as the build command, `.next` as the output.
- **GitHub Pages / S3** (static): switch to `output: "export"` in `next.config.mjs`
  — works because there are no server-side dynamic data sources; everything
  lives in the URL hash.

---

## Next steps

When ready, the next models to add (in priority order):
1. **Underwriting** — to be specified by sales (loans/UW/day, salary, Indecomm price).
2. **PCH Post-Close** & **Trailing Docs** — same shape, 4 roles each.
3. **PFQC** — siblings of PCQC, different sample/productivity defaults.
4. **Servicing QC** — perf vs. non-perf loan split.
5. **PPR** — per-FTE pricing model.
