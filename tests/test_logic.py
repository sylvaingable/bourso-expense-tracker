from __future__ import annotations

import datetime
import io
from pathlib import Path

import pytest

from app import (
    Transaction,
    aggregate_monthly,
    filter_transactions,
    load_ignore_rules,
    load_transactions,
    parse_amount,
    save_ignore_rules,
    should_drop,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("-6,85", -6.85),
        ('"-1 617,98"', -1617.98),
        ('"1 500,00"', 1500.0),
        ("-295,16", -295.16),
    ],
)
def test_parse_amount(raw: str, expected: float) -> None:
    assert parse_amount(raw) == expected


def test_should_drop_case_insensitive() -> None:
    assert should_drop("VIR Virement Sylvain", ["virement sylvain"])


def test_should_drop_substring() -> None:
    assert should_drop("ABONNEMENT NETFLIX PARIS", ["netflix"])


def test_filter_drops_both_legs_of_transfer() -> None:
    debit = Transaction(
        date=datetime.date(2026, 1, 10),
        label="Vir Virement Sylvain compte joint",
        category="Virement",
        supplier="",
        amount=-500.0,
        account="Compte perso",
    )
    credit = Transaction(
        date=datetime.date(2026, 1, 10),
        label="Vir Virement Sylvain depuis perso",
        category="Virement",
        supplier="",
        amount=500.0,
        account="Compte joint",
    )
    assert filter_transactions([debit, credit], []) == []


def test_filter_applies_user_rules() -> None:
    netflix = Transaction(
        date=datetime.date(2026, 1, 15),
        label="ABONNEMENT NETFLIX",
        category="Loisirs",
        supplier="Netflix",
        amount=-13.99,
        account="Compte perso",
    )
    spotify = Transaction(
        date=datetime.date(2026, 1, 15),
        label="ABONNEMENT SPOTIFY",
        category="Loisirs",
        supplier="Spotify",
        amount=-9.99,
        account="Compte perso",
    )
    result = filter_transactions([netflix, spotify], ["netflix"])
    assert result == [spotify]


def test_aggregate_monthly() -> None:
    txs = [
        Transaction(
            date=datetime.date(2026, 1, 5),
            label="Salaire",
            category="Revenus",
            supplier="",
            amount=2000.0,
            account="Compte perso",
        ),
        Transaction(
            date=datetime.date(2026, 1, 20),
            label="Loyer",
            category="Logement",
            supplier="",
            amount=-800.0,
            account="Compte perso",
        ),
        Transaction(
            date=datetime.date(2026, 2, 3),
            label="Courses",
            category="Alimentation",
            supplier="",
            amount=-120.0,
            account="Compte perso",
        ),
    ]
    result = aggregate_monthly(txs)
    assert result[(2026, 1)]["income"] == pytest.approx(2000.0)
    assert result[(2026, 1)]["expenses"] == pytest.approx(800.0)
    assert result[(2026, 2)]["income"] == pytest.approx(0.0)
    assert result[(2026, 2)]["expenses"] == pytest.approx(120.0)


INLINE_CSV = """\
dateOp;label;category;supplierFound;amount;accountLabel
2026-01-05;Salaire janvier;Revenus;Employeur;2000,00;Compte A
2026-01-20;Supermarché;Alimentation;Carrefour;-45,30;Compte A
2026-02-03;Abonnement;Loisirs;Spotify;"-9,99";Compte B
"""


def test_load_transactions_inline_csv() -> None:
    txs = load_transactions(io.StringIO(INLINE_CSV))
    assert len(txs) == 3
    assert txs[0].date == datetime.date(2026, 1, 5)
    assert txs[0].amount == pytest.approx(2000.0)
    assert txs[0].account == "Compte A"
    assert txs[1].amount == pytest.approx(-45.30)
    assert txs[2].amount == pytest.approx(-9.99)
    assert txs[2].account == "Compte B"


def test_load_ignore_rules_creates_missing_file(tmp_path: Path) -> None:
    path = tmp_path / "ignore.json"
    assert not path.exists()
    rules = load_ignore_rules(path)
    assert rules == []
    assert path.exists()
    save_ignore_rules(["netflix", "spotify"], path)
    assert load_ignore_rules(path) == ["netflix", "spotify"]
