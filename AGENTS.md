# AGENTS.md

## Project

Personal expense tracker for three BoursoBank accounts exported as a single CSV. A static single-page app ingests the CSV, applies user-defined ignore rules persisted in `localStorage`, then renders a monthly income/expenses overview chart with a per-month drill-down table.

## Layout

```
expense-tracker/
├── index.html              # static skeleton: sidebar + main, named data-region containers
├── styles.css              # custom properties, layout, components
├── src/
│   ├── main.js             # entry: owns state, wires events, calls update()
│   ├── parse.js            # parseAmount, parseCSV, parseRow, loadTransactions
│   ├── filter.js           # shouldDrop, filterTransactions, applyDrilldownFilters
│   ├── aggregate.js        # aggregateMonthly + sortedMonthKeys
│   ├── store.js            # localStorage wrapper (key: expense-tracker:ignore-rules)
│   ├── chart.js            # renderChart(canvas, monthly, keys) — Chart.js v4 wrapper
│   └── render.js           # renderSidebar / renderMetrics / renderDrilldownFilters / renderDrilldownTable / renderDrilldownMetrics
├── vendor/
│   └── chart.umd.js        # pinned Chart.js v4 UMD, committed
├── sample_data/
│   └── export-operations-11-05-2026_22-19-52.csv   # real export — treat as personal data
├── tests/
│   ├── parse.test.js
│   ├── filter.test.js
│   └── aggregate.test.js
├── README.md
├── AGENTS.md
└── CLAUDE.md               # symlink → AGENTS.md
```

## Setup

No install step. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
```

## Run tests

Requires Node.js ≥ 18.

```bash
node --test tests/*.test.js
```

## Dev loop

Run before declaring any task done:

```bash
node --test tests/*.test.js
```

Then open `index.html`, upload the sample CSV, and verify the UI end-to-end.

## Conventions

- **No build step, no framework.** ES modules under `src/`, loaded via `<script type="module">` in `index.html`.
- **Chart.js vendored.** `vendor/chart.umd.js` is committed. One persistent `Chart` instance; call `chart.update()` on data change — don't destroy/recreate.
- **Single `update()` orchestrator.** All state changes go through `update()` in `main.js`. Renders read from `state`, never from the DOM.
- **French amount parsing**: strip surrounding quotes → remove spaces → replace `,` with `.` → `parseFloat`. See `src/parse.js:parseAmount`.
- **Label matching**: case-insensitive substring (`label.toLowerCase().includes(pattern.toLowerCase())`). See `src/filter.js:shouldDrop`.
- **Income vs expenses split**: `amount >= 0` → income, else expense (stored as positive magnitude). Matches Python `>=` to handle `-0`.
- **Aggregate key**: `"YYYY-MM"` string from `date.slice(0, 7)`. Lexicographic sort = chronological.
- **Selection state**: clear `state.selectedLabels` on any filter change.
- **No pandas, no SQLite, no backend.**

## Data

CSV columns consumed:

| Column | Use |
|---|---|
| `dateOp` | Transaction date (`YYYY-MM-DD`) |
| `label` | Free-text description; used for all filtering |
| `category` | Display only |
| `supplierFound` | Display only (mapped to `supplier`) |
| `amount` | French-formatted signed float |
| `accountLabel` | One of the three BoursoBank accounts |

**Amount format examples:**

- `-6,85` (plain)
- `"-1 617,98"` (quoted, space thousands separator)
- `"1 500,00"` (positive, quoted)
- `-295,16` (plain negative)

## Things to avoid

- Don't add a build step, bundler, or JS framework.
- Don't add a backend or database.
- Don't commit `sample_data/` — it's gitignored personal banking data.
- Don't destroy and recreate the Chart.js instance on updates; call `chart.update()`.
- Don't skip `node --test tests/*.test.js` before declaring done.
- Don't paste sample CSV contents into external services.
