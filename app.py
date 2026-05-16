from __future__ import annotations

import csv
import datetime
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable
    from typing import TextIO


@dataclass
class Transaction:
    date: datetime.date
    label: str
    category: str
    supplier: str
    amount: float
    account: str


def parse_amount(raw: str) -> float:
    return float(raw.strip('"').replace(" ", "").replace(",", "."))


def parse_row(row: dict[str, str]) -> Transaction:
    return Transaction(
        date=datetime.date.fromisoformat(row["dateOp"]),
        label=row["label"],
        category=row["category"],
        supplier=row["supplierFound"],
        amount=parse_amount(row["amount"]),
        account=row["accountLabel"],
    )


def load_transactions(file: TextIO) -> list[Transaction]:
    reader = csv.DictReader(file, delimiter=";")
    return [parse_row(row) for row in reader]


def should_drop(label: str, patterns: Iterable[str]) -> bool:
    lower = label.lower()
    return any(p.lower() in lower for p in patterns)


def filter_transactions(
    txs: list[Transaction], ignore_patterns: list[str]
) -> list[Transaction]:
    return [t for t in txs if not should_drop(t.label, ignore_patterns)]


def aggregate_monthly(
    txs: list[Transaction],
) -> dict[tuple[int, int], dict[str, float]]:
    buckets: dict[tuple[int, int], dict[str, float]] = defaultdict(
        lambda: {"income": 0.0, "expenses": 0.0}
    )
    for t in txs:
        key = (t.date.year, t.date.month)
        if t.amount >= 0:
            buckets[key]["income"] += t.amount
        else:
            buckets[key]["expenses"] += -t.amount
    return dict(buckets)


IGNORE_RULES_PATH = Path("ignore_rules.json")


def load_ignore_rules(path: Path = IGNORE_RULES_PATH) -> list[str]:
    if not path.exists():
        path.write_text("[]", encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def save_ignore_rules(rules: list[str], path: Path = IGNORE_RULES_PATH) -> None:
    path.write_text(json.dumps(rules), encoding="utf-8")


# ---------------------------------------------------------------------------
# Streamlit UI — must stay below all pure functions so `import app` in tests
# does not trigger st.* calls.
# ---------------------------------------------------------------------------

import plotly.graph_objects as go  # noqa: E402
import streamlit as st  # noqa: E402


def _month_label(key: tuple[int, int]) -> str:
    return f"{key[0]:04d}-{key[1]:02d}"


def main() -> None:
    st.set_page_config(page_title="Suivi des dépenses", layout="wide")

    # --- Sidebar ---
    with st.sidebar:
        st.header("Import")
        uploaded = st.file_uploader("Relevé bancaire", type="csv")

        st.header("Règles d'exclusion")
        if "ignore_rules" not in st.session_state:
            st.session_state.ignore_rules = load_ignore_rules()

        rules: list[str] = st.session_state.ignore_rules
        for i, rule in enumerate(rules):
            col1, col2 = st.columns([5, 1])
            col1.text(rule)
            if col2.button("🗑", key=f"del_{i}"):
                rules.pop(i)
                save_ignore_rules(rules)
                st.rerun()

        new_rule = st.text_input("Nouvelle règle", key="new_rule_input")
        if st.button("Ajouter") and new_rule.strip():
            rules.append(new_rule.strip())
            save_ignore_rules(rules)
            st.rerun()

    if uploaded is None:
        st.info("Importez un export CSV BoursoBank pour commencer.")
        return

    # --- Data pipeline ---
    import io

    text_file = io.TextIOWrapper(uploaded, encoding="utf-8-sig")
    txs = load_transactions(text_file)
    txs = filter_transactions(txs, st.session_state.ignore_rules)
    monthly = aggregate_monthly(txs)
    sorted_keys = sorted(monthly)

    # --- Overview chart ---
    st.subheader("Vue d'ensemble mensuelle")
    labels = [_month_label(k) for k in sorted_keys]
    income = [monthly[k]["income"] for k in sorted_keys]
    expenses = [monthly[k]["expenses"] for k in sorted_keys]
    net = [i - e for i, e in zip(income, expenses, strict=True)]

    fig = go.Figure()
    fig.add_trace(go.Bar(x=labels, y=income, name="Revenus", marker_color="#2ca02c"))
    fig.add_trace(go.Bar(x=labels, y=expenses, name="Dépenses", marker_color="#d62728"))
    fig.add_trace(go.Scatter(x=labels, y=net, name="Solde", mode="lines+markers"))
    fig.update_layout(barmode="group", xaxis_title="Mois", yaxis_title="€")
    st.plotly_chart(fig, width="stretch")  # type: ignore[no-untyped-call]

    total_income = sum(income)
    total_expenses = sum(expenses)
    mc1, mc2, mc3 = st.columns(3)
    mc1.metric("Total revenus", f"€{total_income:,.2f}")
    mc2.metric("Total dépenses", f"€{total_expenses:,.2f}")
    mc3.metric("Solde", f"€{total_income - total_expenses:,.2f}")

    # --- Drill-down ---
    st.subheader("Détail")
    all_categories = sorted({t.category for t in txs})
    all_accounts = sorted({t.account for t in txs})

    fcol1, fcol2, fcol3, fcol4 = st.columns(4)
    selected_label = fcol1.selectbox(
        "Mois", [_month_label(k) for k in sorted(sorted_keys, reverse=True)]
    )
    selected_flow = fcol2.selectbox("Flux", ["Tous", "Revenus", "Dépenses"])
    selected_category = fcol3.selectbox("Catégorie", ["Toutes", *all_categories])
    selected_account = fcol4.selectbox("Compte", ["Tous", *all_accounts])

    selected_key = (int(selected_label[:4]), int(selected_label[5:7]))
    month_txs = [t for t in txs if (t.date.year, t.date.month) == selected_key]
    if selected_flow == "Revenus":
        month_txs = [t for t in month_txs if t.amount >= 0]
    elif selected_flow == "Dépenses":
        month_txs = [t for t in month_txs if t.amount < 0]
    if selected_category != "Toutes":
        month_txs = [t for t in month_txs if t.category == selected_category]
    if selected_account != "Tous":
        month_txs = [t for t in month_txs if t.account == selected_account]

    rows = [
        {
            "Date": t.date,
            "Libellé": t.label,
            "Catégorie": t.category,
            "Fournisseur": t.supplier,
            "Montant": t.amount,
            "Compte": t.account,
        }
        for t in month_txs
    ]
    selection = st.dataframe(
        rows,
        width="stretch",
        selection_mode="multi-row",
        on_select="rerun",
        key=f"df_{selected_label}_{selected_flow}_{selected_category}_{selected_account}",
    )  # type: ignore[no-untyped-call]

    selected_indices: list[int] = (getattr(selection, "selection", None) or {}).get(
        "rows", []
    )
    if selected_indices:
        selected_labels = [month_txs[i].label for i in selected_indices]
        if st.button(f"Exclure {len(selected_labels)} libellé(s) sélectionné(s)"):
            rules = st.session_state.ignore_rules
            for lbl in selected_labels:
                if lbl not in rules:
                    rules.append(lbl)
            save_ignore_rules(rules)
            st.rerun()

    month_income = sum(t.amount for t in month_txs if t.amount >= 0)
    month_expenses = sum(-t.amount for t in month_txs if t.amount < 0)
    c1, c2 = st.columns(2)
    c1.metric("Revenus", f"€{month_income:,.2f}")
    c2.metric("Dépenses", f"€{month_expenses:,.2f}")


if __name__ == "__main__":
    main()
