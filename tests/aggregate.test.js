import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMonthly } from '../src/aggregate.js';

const txs = [
  { date: '2026-01-05', label: 'Salaire', category: 'Revenus', supplier: '', amount: 2000.0, account: 'Compte perso' },
  { date: '2026-01-20', label: 'Loyer', category: 'Logement', supplier: '', amount: -800.0, account: 'Compte perso' },
  { date: '2026-02-03', label: 'Courses', category: 'Alimentation', supplier: '', amount: -120.0, account: 'Compte perso' },
];

describe('aggregateMonthly', () => {
  it('aggregates income and expenses by month', () => {
    const result = aggregateMonthly(txs);
    assert.ok(Math.abs(result['2026-01'].income - 2000.0) < 0.001);
    assert.ok(Math.abs(result['2026-01'].expenses - 800.0) < 0.001);
    assert.ok(Math.abs(result['2026-02'].income - 0.0) < 0.001);
    assert.ok(Math.abs(result['2026-02'].expenses - 120.0) < 0.001);
  });
});
