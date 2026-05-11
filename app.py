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


HARDCODED_PATTERNS: tuple[str, ...] = (
    "Virement Sylvain",
    "Pret immobilier Sylvain",
    "Relevé différé Carte",
)


def should_drop(label: str, patterns: Iterable[str]) -> bool:
    lower = label.lower()
    return any(p.lower() in lower for p in patterns)


def filter_transactions(
    txs: list[Transaction], ignore_patterns: list[str]
) -> list[Transaction]:
    all_patterns = list(HARDCODED_PATTERNS) + ignore_patterns
    return [t for t in txs if not should_drop(t.label, all_patterns)]


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
