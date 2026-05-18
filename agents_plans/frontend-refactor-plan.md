# Refactor Streamlit/Python → vanilla SPA

## Context

The expense tracker is currently a ~224-line Python/Streamlit app (`app.py`) with a pytest suite over its pure-logic functions. It does three things:

1. Parses BoursoBank CSV exports (French amount formatting, semicolons, UTF-8 BOM).
2. Lets the user maintain a list of label-substring ignore rules persisted to `ignore_rules.json`.
3. Renders a monthly income/expenses grouped-bar chart with a net-balance line, plus a per-month drill-down table with bulk "exclude these labels" action.

The user wants to drop the Python runtime entirely and ship a static single-page app. Constraints: no build step, no JS framework, no CSS framework, vanilla ES modules + plain modern CSS. Ignore rules move from a JSON file to `localStorage`. The UI stays French (matches recent `b99be90 Translate UI to French`).

Note: the AGENTS.md doc mentions three hardcoded drop patterns, but git log shows `72722da Remove hardcoded ignore patterns` — the *code* is authoritative. The rewrite has no hardcoded patterns; everything goes through the user-managed rule list.

## Target file layout

```
expense-tracker/
├── index.html              # static skeleton: sidebar + main, named regions
├── styles.css              # custom properties, layout, components
├── src/
│   ├── main.js             # entry: owns state, wires events, calls update()
│   ├── parse.js            # parseAmount, parseCSV, parseRow, loadTransactions
│   ├── filter.js           # shouldDrop, filterTransactions, applyDrilldownFilters
│   ├── aggregate.js        # aggregateMonthly + month-key helpers
│   ├── store.js            # localStorage wrapper (key: expense-tracker:ignore-rules)
│   ├── chart.js            # renderChart(canvas, monthly) — Chart.js wrapper
│   └── render.js           # renderSidebar / renderOverview / renderDrilldown / renderMetrics
├── vendor/
│   └── chart.umd.js        # pinned Chart.js v4 UMD, committed
├── sample_data/
│   └── export-operations-11-05-2026_22-19-52.csv   # kept for manual smoke-test
├── tests/
│   ├── parse.test.js       # node --test
│   ├── filter.test.js
│   └── aggregate.test.js
├── README.md
├── AGENTS.md   (CLAUDE.md symlink stays)
└── .gitignore
```

## Decisions

- **Chart:** vendor Chart.js v4 UMD (`vendor/chart.umd.js`, loaded via `<script src>` so it works on `file://`). One persistent Chart instance per canvas; call `chart.update()` on data change rather than destroying/recreating.
- **Code layout:** ES modules under `src/`. Modern browsers support `<script type="module">` on `file://`; README documents `python3 -m http.server` as a fallback.
- **Tests:** port the 7 pure-logic pytest tests to `node:test` + `node:assert/strict`. The 8th (`test_load_ignore_rules_creates_missing_file`) is dropped — semantics changed to localStorage. Run with `node --test tests/`.
- **CSV parser:** ~30 LOC state-machine inline in `parse.js`. Handles BOM, quoted fields, embedded delimiters, CRLF/LF, `""` escape. No external dep.
- **No Dockerfile.** Single-user tool. README mentions `python3 -m http.server` if hosting is wanted.
- **No "load sample" button** — `sample_data/` stays for manual testing only.

## Behavior parity checklist (must match `app.py`)

- French amount parsing: strip `"`, remove spaces, replace `,` with `.`, `parseFloat`. Test cases: `-6,85`, `"-1 617,98"`, `"1 500,00"`, `-295,16`.
- Date parsing: `dateOp` is ISO `YYYY-MM-DD`. Use `Date.parse` or split-by-`-`.
- Column mapping: `dateOp→date`, `label→label`, `category→category`, `supplierFound→supplier`, `amount→amount`, `accountLabel→account`.
- `shouldDrop`: case-insensitive substring of any pattern in label.
- Income vs expenses split: `amount >= 0` → income, else expense (expense stored as positive magnitude). **Match Python's `>=`, not `>`** — `-0` edge case.
- Aggregate key: `"YYYY-MM"` string (lexicographic sort = chronological — no `Date` needed).
- Drill-down filter order: month → flow (Tous/Revenus/Dépenses) → category (Toutes/…) → account (Tous/…).
- Bulk "Exclure N libellé(s) sélectionné(s)" button: append each unique selected label to ignore rules, persist, re-render. **Clear selection on filter change** (matches Streamlit's keyed dataframe behavior).
- Money formatting: `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })` — yields `1 617,98 €`, slightly better than the Python `f"€{x:,.2f}"`.

## State and rendering

Single mutable `state` object in `main.js`:

```js
const state = {
  transactions: [],
  ignoreRules: loadIgnoreRules(),
  filters: { month: null, flow: 'Tous', category: 'Toutes', account: 'Tous' },
  selectedLabels: new Set(),
};
```

One orchestrator `update()` is the single entrypoint for any state change. It computes `filterTransactions` once, then `aggregateMonthly`, then calls the relevant `render*()` functions which replace the contents of fixed `data-region` containers in `index.html`. The Chart.js instance is updated in-place, not recreated. The `<tbody>` of the drill-down table is built off-DOM and swapped to avoid per-row reflow (~2,700 rows is fine).

Filter `<select>`s persist in the DOM; their `change` handlers write to `state.filters` and call `update()`. Renders read from `state`, never from the DOM.

## CSS approach

- Minimal reset (`box-sizing: border-box`, body margin 0, system font stack).
- `:root` custom properties: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-border`, `--color-income: #2ca02c`, `--color-expense: #d62728`, `--color-accent`, plus `--space-*`, `--radius`, `--shadow-sm`.
- Body is `display: grid; grid-template-columns: 280px 1fr`. Collapses to single column under `760px`.
- System font stack for UI, monospace for amounts. No web fonts (works offline).
- Table styled with `border-collapse` + sticky `thead`. Income amounts in green, expenses in red.

## Files to delete

- `app.py`
- `tests/__init__.py`, `tests/test_logic.py`
- `pyproject.toml`, `uv.lock`
- `Dockerfile`
- `agents_plans/` (entire directory — design record is obsolete)
- `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`
- `ignore_rules.json` if present at runtime (state lives in localStorage)

## Files to modify

- `README.md` — rewrite around "open `index.html`" + `python3 -m http.server` fallback + `node --test tests/`.
- `AGENTS.md` — rewrite the Layout / Setup / Run / Dev loop / Conventions sections for the new stack. Drop the pandas/Streamlit/uv references. Keep the data section. Add: "no build step, no framework, ES modules, Chart.js vendored, tests via `node --test`".
- `.gitignore` — drop Python entries; add `node_modules/` defensively; keep `.DS_Store`.

## Risks / gotchas

1. **BOM:** defensively strip leading `﻿` in `parseCSV` even though `FileReader` with UTF-8 usually strips it.
2. **`-0` edge case:** use `amount >= 0 ? income : expense` to match Python.
3. **localStorage quota** (~5 MB) is not a concern; rules are short strings.
4. **`file://` + ES modules:** works in modern Chromium/Firefox/Safari. README mentions the `http.server` fallback.
5. **Selection state across filter changes:** clear on any filter change, matches the Streamlit UX.
6. **Chart.js instance management:** keep one, call `chart.update()` — don't recreate.

## Implementation order

1. Scaffold `index.html` + empty `styles.css` + `src/main.js` "hello" log; verify `file://` open works.
2. Port pure logic: `parse.js`, `filter.js`, `aggregate.js`, `store.js`. Write `node --test` files alongside. Get tests green before any DOM work.
3. Drop in `vendor/chart.umd.js`; write `chart.js` with hardcoded data — verify chart renders.
4. Wire file upload → `state.transactions` → first render (overview chart + 3 metric cards).
5. Drilldown: filter selectors, table, per-month footer metrics.
6. Sidebar: ignore-rules editor (list + add input + delete button) and "Exclure N libellés" bulk-add button. Both go through `store.js` and call `update()`.
7. Styling pass: tokens, layout, table polish, sidebar.
8. Rewrite `README.md` + `AGENTS.md`. Delete the Python world (app.py, tests/test_logic.py, pyproject.toml, uv.lock, Dockerfile, agents_plans/, caches).

## Verification

- `node --test tests/` — all ported tests pass.
- Open `index.html` directly in a browser, upload `sample_data/export-operations-11-05-2026_22-19-52.csv`. Confirm: chart renders 3 series, totals match what the Streamlit version showed for the same file, drilldown filters narrow correctly, multi-row select + "Exclure" adds rules and re-renders, sidebar shows persisted rules across page reload.
- Also test under `python3 -m http.server 8000` to confirm the served path works.
- `git status` clean; no orphan Python files, no `agents_plans/`.

## Critical files

- `/Users/sylvain/projects/expense-tracker/index.html`
- `/Users/sylvain/projects/expense-tracker/styles.css`
- `/Users/sylvain/projects/expense-tracker/src/main.js`
- `/Users/sylvain/projects/expense-tracker/src/parse.js`
- `/Users/sylvain/projects/expense-tracker/src/filter.js`
- `/Users/sylvain/projects/expense-tracker/src/aggregate.js`
- `/Users/sylvain/projects/expense-tracker/src/store.js`
- `/Users/sylvain/projects/expense-tracker/src/chart.js`
- `/Users/sylvain/projects/expense-tracker/src/render.js`
- `/Users/sylvain/projects/expense-tracker/vendor/chart.umd.js`
- `/Users/sylvain/projects/expense-tracker/README.md`
- `/Users/sylvain/projects/expense-tracker/AGENTS.md`
