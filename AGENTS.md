# AGENTS.md

## Project

Personal expense tracker for three BoursoBank accounts exported as a single CSV. A Streamlit web app ingests the CSV, drops internal transfers between accounts and the monthly aggregated ULTIM debit, applies user-defined ignore rules, then renders a monthly income/expenses overview with a per-month drill-down.

- Full design: [agents_plans/expense-tracker-plan.md](agents_plans/expense-tracker-plan.md)
- Step-by-step build order: [agents_plans/IMPLEMENTATION.md](agents_plans/IMPLEMENTATION.md)

## Layout

```
expense-tracker/
├── app.py                  # Pure-logic functions + Streamlit UI in one file
├── tests/
│   └── test_logic.py       # pytest over the pure functions
├── sample_data/
│   └── export-operations-11-05-2026_22-19-52.csv
├── agents_plans/
│   ├── expense-tracker-plan.md   # Design doc (don't rewrite)
│   └── IMPLEMENTATION.md         # Build plan
├── pyproject.toml          # uv-managed
├── .gitignore
├── AGENTS.md               # this file
├── CLAUDE.md               # symlink → AGENTS.md
└── ignore_rules.json       # runtime-created, gitignored
```

## Setup

```bash
uv sync
```

Requires Python 3.13+; `uv` will install it if missing.

## Run

```bash
uv run streamlit run app.py
```

Sample CSV: `sample_data/export-operations-11-05-2026_22-19-52.csv`.

## Dev loop

Run before declaring any task done:

```bash
uv run ruff format . && uv run ruff check . && uv run ty check && uv run pytest
```

## Conventions

- **No pandas.** Use `csv.DictReader`, plain `dict`, and `collections.defaultdict`.
- **Pure functions are testable.** Parsing, filtering, and aggregation live as module-level functions in `app.py` so `tests/` can import them. Streamlit calls (`st.*`) sit below the pure-logic block. Importing `app` in tests must not trigger UI side-effects — only call pure functions from tests, never the UI section.
- **French amount parsing**: strip surrounding quotes → remove spaces → replace `,` with `.` → `float()`. Centralise in a single helper.
- **Label matching**: case-insensitive substring (`pattern.lower() in label.lower()`).
- **Type checking**: `ty` covers our logic fully. Streamlit ships partial stubs; a few APIs (e.g. `st.plotly_chart` return value) may need `# type: ignore`. If the same `ignore` repeats more than twice, wrap the call in a small helper instead.

## Data

CSV columns the code consumes:

| Column | Use |
|---|---|
| `dateOp` | Transaction date (`YYYY-MM-DD`) |
| `label` | Free-text description; used for all filtering |
| `category` | Display only |
| `supplierFound` | Display only (mapped to `supplier`) |
| `amount` | French-formatted signed float — see below |
| `accountLabel` | One of the three BoursoBank accounts |

**Amount format examples** from the real export:

- `-6,85` (plain)
- `"-1 617,98"` (quoted, thousands separator is a space)
- `"1 500,00"` (positive, quoted)
- `-295,16` (plain negative)

**Hard-coded drop patterns** (case-insensitive substring match on `label`):

1. `Virement Sylvain` — personal→joint transfer (both legs)
2. `Pret immobilier Sylvain` — mortgage routing transfer (both legs)
3. `Relevé différé Carte` — monthly aggregated ULTIM debit (already captured by per-purchase rows)

The sample CSV contains all three: matched transfer pairs on lines 38/40 (Pret immobilier) and 54/57 (Virement Sylvain), and an aggregated debit on line 72.

## Things to avoid

- Don't add pandas, sqlite, or any database.
- Don't commit `ignore_rules.json` — it's user-local state.
- Don't rewrite `agents_plans/expense-tracker-plan.md` — it's the design record. Add to `IMPLEMENTATION.md` if the build plan evolves.
- Don't skip the dev-loop command before declaring done.
- Don't paste sample CSV contents into external services — it's real personal banking data.

## Sample data

`sample_data/export-operations-11-05-2026_22-19-52.csv` — ~520 KB, ~2730 rows, UTF-8 with BOM, semicolon-separated. Real export; treat as personal data.
