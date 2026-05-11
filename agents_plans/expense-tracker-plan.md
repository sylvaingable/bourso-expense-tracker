# Expense Tracker — Implementation Plan

## Context

Personal expense tracker for 3 BoursoBank accounts exported as a single CSV.
Goal: a Streamlit web app that ingests the CSV, deduplicates internal transfers,
removes the monthly ULTIM aggregated debit, applies user-defined label ignore rules,
then shows a monthly income/expenses overview with drill-down per month.

---

## File Structure

```
expense-tracker/
├── app.py                  # Single-file Streamlit app (UI + logic)
├── ignore_rules.json       # Persisted user-defined ignore rules (auto-created)
├── pyproject.toml          # uv-managed dependencies
└── sample_data/
    └── *.csv
```

---

## CSV Format

- Semicolon-separated, UTF-8, header on row 1
- Columns to import: `dateOp`, `label`, `category`, `supplierFound`, `amount`, `accountLabel`
- `amount` uses French locale: comma as decimal separator, optional space as thousands
  separator, may be quoted (e.g. `"-1 234,45"`).
  Parse: strip surrounding quotes → remove spaces → replace `,` with `.` → `float()`
- Parse with `csv.DictReader(file, delimiter=';')` — no pandas

---

## Data Model (plain Python, no pandas)

```python
# Each transaction is a dict:
{
    "date": datetime.date,
    "label": str,
    "category": str,
    "supplier": str,       # supplierFound column
    "amount": float,
    "account": str,        # accountLabel column
}
```

Aggregates are computed with `collections.defaultdict` into:

```python
monthly = {
    "2026-04": {"income": 0.0, "expenses": 0.0},
    ...
}
```

---

## Filtering Logic (applied in order)

### 1. Hard-coded deduplication rules

| What | Detection | Action |
|------|-----------|--------|
| Personal→joint transfer | `label` contains `"Virement Sylvain"` (case-insensitive) | Drop row |
| Mortgage routing transfer | `label` contains `"Pret immobilier Sylvain"` (case-insensitive) | Drop row |
| Monthly ULTIM aggregated debit | `label` contains `"Relevé différé Carte"` (case-insensitive) | Drop row |

Both sides of a transfer appear in the CSV (debit + credit); dropping by label removes both.

### 2. User-defined ignore rules
- Loaded from `ignore_rules.json` (list of label substrings, created empty if missing)
- Drop any row whose `label` contains any pattern (case-insensitive)

---

## UI (`app.py`)

### Sidebar
1. **File upload** — `st.file_uploader(type="csv")`
2. **Ignore rules panel**
   - Current rules listed with a 🗑 delete button each
   - Text input + "Add rule" button
   - Saved to `ignore_rules.json` on every change

### Main area

#### Overview (after upload)
- Plotly grouped bar chart: one cluster per month, green bar = income, red bar = expenses, line = net
- Data built from `monthly` dict directly (no DataFrame needed for Plotly)

#### Drill-down
- `st.selectbox` to pick a month
- Text input for live label search (Python `str.lower() in label.lower()` filter)
- `st.dataframe` with columns: Date, Label, Category, Supplier, Amount, Account
  — Streamlit sorts natively on column headers
- Footer row: total income / total expenses for the month

---

## Tooling

- **Runtime**: `uv run streamlit run app.py`
- **pyproject.toml** dependencies: `streamlit`, `plotly`
- **Linting/formatting**: `ruff` (configured in `pyproject.toml` under `[tool.ruff]`)
- **Type checking**: `ty` — Streamlit ships partial type stubs so custom logic will be
  fully checked; a few Streamlit-specific APIs (e.g. `st.plotly_chart` return values)
  may require `# type: ignore` annotations
- Dev workflow: `uv run ruff check . && uv run ruff format . && uv run ty check`
- No pandas, no database
