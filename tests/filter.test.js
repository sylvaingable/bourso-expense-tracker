import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDrop, filterTransactions } from '../src/filter.js';

describe('shouldDrop', () => {
  it('case-insensitive', () => assert.ok(shouldDrop('VIR Virement Sylvain', ['virement sylvain'])));
  it('substring match', () => assert.ok(shouldDrop('ABONNEMENT NETFLIX PARIS', ['netflix'])));
});

const debit = { date: '2026-01-10', label: 'Vir Virement Sylvain compte joint', category: 'Virement', supplier: '', amount: -500.0, account: 'Compte perso' };
const credit = { date: '2026-01-10', label: 'Vir Virement Sylvain depuis perso', category: 'Virement', supplier: '', amount: 500.0, account: 'Compte joint' };
const netflix = { date: '2026-01-15', label: 'ABONNEMENT NETFLIX', category: 'Loisirs', supplier: 'Netflix', amount: -13.99, account: 'Compte perso' };
const spotify = { date: '2026-01-15', label: 'ABONNEMENT SPOTIFY', category: 'Loisirs', supplier: 'Spotify', amount: -9.99, account: 'Compte perso' };

describe('filterTransactions', () => {
  it('drops both legs of transfer', () => {
    assert.equal(filterTransactions([debit, credit], ['Virement Sylvain']).length, 0);
  });
  it('applies user rules', () => {
    const result = filterTransactions([netflix, spotify], ['netflix']);
    assert.equal(result.length, 1);
    assert.equal(result[0].label, 'ABONNEMENT SPOTIFY');
  });
});
