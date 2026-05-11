# Expense Tracker — Implementation Plan

Build order for a coding agent. Companion to the design doc at
[expense-tracker-plan.md](expense-tracker-plan.md) and the repo guide at
[../AGENTS.md](../AGENTS.md). Read both first.

Each step lists the file(s) it touches and a check that must pass before
moving on. Run the dev loop after every step:

```bash
uv run ruff format . && uv run ruff check . && uv run ty check && uv run pytest
```

---

## Step 1 — Project skeleton

Files: `pyproject.toml`, `.gitignore` (already present — verify).

`pyproject.toml` contents:

- `requires-python = ">=3.13"`
- Runtime dependencies: `streamlit`, `plotly`
- Dev dependencies (`[dependency-groups.dev]` or `[tool.uv]` dev-deps): `ruff`, `ty`, `pytest`
- `[tool.ruff]` block with the project's preferred line length (default 88 is fine) and `select = ["E", "F", "I", "UP", "B"]` as a starting lint set.
- `[tool.pytest.ini_options]` with `testpaths = ["tests"]`.

Check: `uv sync` exits 0; `uv run python -c "import streamlit, plotly"` succeeds.

---

## Step 2 — Pure-logic core in `app.py`

Write module-level functions only. **No `st.*` calls in this step.**

Types:

```python
class Transaction(TypedDict):
    date: datetime.date
    label: str
    category: str
    supplier: str
    amount: float
    account: str
```

Functions to implement:

| Function | Purpose |
|---|---|
| `parse_amount(raw: str) -> float` | Strip quotes → remove spaces → `,`→`.` → `float()`. |
| `parse_row(row: dict[str, str]) -> Transaction` | Map a `DictReader` row to a `Transaction`. Parses `dateOp` with `datetime.date.fromisoformat`. |
| `load_transactions(file: TextIO) -> list[Transaction]` | `csv.DictReader(file, delimiter=";")` over a file-like object so tests can pass `io.StringIO`. Handle the UTF-8 BOM on the first column header (open files with `encoding="utf-8-sig"` in the UI; tests can pass a header without BOM). |
| `HARDCODED_PATTERNS: tuple[str, ...]` | `("Virement Sylvain", "Pret immobilier Sylvain", "Relevé différé Carte")`. |
| `should_drop(label: str, patterns: Iterable[str]) -> bool` | Case-insensitive substring match against any pattern. |
| `filter_transactions(txs: list[Transaction], ignore_patterns: list[str]) -> list[Transaction]` | Drop rows matching `HARDCODED_PATTERNS` ∪ `ignore_patterns`. |
| `aggregate_monthly(txs: list[Transaction]) -> dict[str, dict[str, float]]` | Bucket by `f"{t['date'].year:04d}-{t['date'].month:02d}"`. Positive amount → `"income"`, negative → `"expenses"` (store as positive number for display). |
| `IGNORE_RULES_PATH = Path("ignore_rules.json")` | Module-level constant. |
| `load_ignore_rules(path: Path = IGNORE_RULES_PATH) -> list[str]` | Read JSON list. Create file with `[]` if missing. |
| `save_ignore_rules(rules: list[str], path: Path = IGNORE_RULES_PATH) -> None` | Write JSON list. |

Check: `uv run python -c "import app; print(app.parse_amount('\"-1 617,98\"'))"` prints `-1617.98`.

---

## Step 3 — Tests in `tests/test_logic.py`

Create `tests/__init__.py` (empty) and `tests/test_logic.py`. Pytest cases:

- `test_parse_amount` — table-driven: `("-6,85", -6.85)`, `('"-1 617,98"', -1617.98)`, `('"1 500,00"', 1500.0)`, `("-295,16", -295.16)`.
- `test_should_drop_case_insensitive` — `"VIR Virement Sylvain"` matches `"virement sylvain"`.
- `test_should_drop_substring` — pattern is a substring inside a longer label.
- `test_filter_drops_both_legs_of_transfer` — build two `Transaction` dicts representing the debit and credit of a `Virement Sylvain`; both are dropped.
- `test_filter_applies_user_rules` — user rule `"netflix"` drops a Netflix row but not a Spotify row.
- `test_aggregate_monthly` — three rows across two months; assert income vs expenses bucketing and that the expenses figure is stored as a positive number.
- `test_load_transactions_inline_csv` — inline 3-row CSV string fed via `io.StringIO`; assert parsed amounts, dates, and account labels.
- `test_load_ignore_rules_creates_missing_file` — point at a `tmp_path / "ignore.json"`; first call returns `[]` and creates the file; `save_ignore_rules` round-trips.

Do NOT load the full 2730-row sample CSV in unit tests. (Optional: one `@pytest.mark.slow` smoke test asserting that loading the real file yields >2000 transactions and that no row whose label contains a hard-coded pattern survives `filter_transactions`.)

Check: `uv run pytest` is green.

---

## Step 4 — Streamlit UI in `app.py`

Append below the pure-logic block. UI structure:

**Sidebar**
- `st.file_uploader("CSV export", type="csv")` — open with `encoding="utf-8-sig"` when reading.
- Ignore rules editor:
  - `st.session_state` mirrors `load_ignore_rules()` on first run.
  - For each rule, render the text and a `🗑` button. Clicking removes the rule and calls `save_ignore_rules`.
  - `st.text_input` + `st.button("Add rule")` appends a rule and persists.

**Main area** (only when a file is uploaded)
- Pipeline: `load_transactions(uploaded)` → `filter_transactions(..., session_rules)` → `aggregate_monthly`.
- **Overview**: Plotly figure with two `go.Bar` traces (income green `#2ca02c`, expenses red `#d62728`) in grouped mode, plus a `go.Scatter` line trace for net (`income - expenses`). X axis = sorted month keys.
- **Drill-down**:
  - `st.selectbox("Month", sorted(month_keys, reverse=True))`.
  - `st.text_input("Search label")` — live filter via `query.lower() in t["label"].lower()`.
  - `st.dataframe` with columns `Date`, `Label`, `Category`, `Supplier`, `Amount`, `Account` (rename keys for display).
  - Footer: two `st.metric`s for the month's income and expenses totals on the filtered set.

Render order matters: UI code must come after all pure functions so `import app` from tests does not execute Streamlit calls (Streamlit only runs the module when invoked via `streamlit run`).

Check: `uv run streamlit run app.py`, upload the sample CSV, confirm the chart renders and the drill-down table populates.

---

## Step 5 — Manual verification

Run the 7-step checklist from
[expense-tracker-plan.md](expense-tracker-plan.md#verification):

1. `uv sync && uv run streamlit run app.py`
2. Upload sample file.
3. Confirm `Vir Virement Sylvain` and `Vir Pret Immobilier Sylvain` rows are absent.
4. Confirm `Relevé Différé Carte` row is absent but individual ULTIM purchases (e.g. `Carrefour | CARTE ...`) are present.
5. Add a label ignore rule (e.g. `"netflix"`) → matching rows disappear immediately and `ignore_rules.json` updates on disk.
6. Pick a month → table renders; sort by amount column; label-substring search filters live.
7. Monthly chart bars reflect the filtered totals (post-rules).

---

## Definition of done

- `uv run ruff format . && uv run ruff check . && uv run ty check && uv run pytest` is clean.
- All 7 manual verification steps pass against the real sample CSV.
- `ignore_rules.json` is gitignored and auto-created on first launch.
