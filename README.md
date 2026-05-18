# Expense Tracker

Personal expense tracker for BoursoBank CSV exports. Vanilla HTML/CSS/JS — no build step, no server required.

> Vibecoded with [Claude Code](https://claude.ai/code).

## Open

```
open index.html
```

Or serve locally (needed if your browser blocks `file://` ES modules):

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Run tests

Requires Node.js ≥ 18.

```
node --test tests/*.test.js
```

## Usage

1. Export your transactions from BoursoBank as CSV.
2. Open `index.html`, click **Relevé bancaire** and select the CSV.
3. Use the **Règles d'exclusion** sidebar to add patterns — any transaction whose label contains the pattern (case-insensitive) will be hidden.
4. In the drill-down table, select rows and click **Exclure N libellé(s) sélectionné(s)** to bulk-add ignore rules.

Ignore rules are persisted in `localStorage` (key: `expense-tracker:ignore-rules`).

## Stack

- Vanilla ES modules (`src/`), no framework, no build step
- [Chart.js v4](https://www.chartjs.org/) vendored at `vendor/chart.umd.js`
- Tests via `node:test` + `node:assert/strict`

## Data privacy

The CSV contains real banking data. Don't commit it, don't paste it into external services.
