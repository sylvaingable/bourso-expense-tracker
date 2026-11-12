import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, loadTransactions } from '../src/parse.js';

describe('parseAmount', () => {
  it('plain negative', () => assert.equal(parseAmount('-6,85'), -6.85));
  it('quoted with space thousands', () => assert.equal(parseAmount('"-1 617,98"'), -1617.98));
  it('quoted positive thousands', () => assert.equal(parseAmount('"1 500,00"'), 1500.0));
  it('plain negative 2', () => assert.equal(parseAmount('-295,16'), -295.16));
});

const HEADER = '"Date Opération";"Date Valeur";Libellé;"Libellé Suggéré";Catégorie;"Catégorie Parente";Solde;Commentaire;"Numéro Compte";"Libellé Compte";Solde;Pointage';
const INLINE_CSV = [
  HEADER,
  '2026-01-05;2026-01-05;Salaire janvier;Employeur;Revenus;Revenus;"2 000,00";;123;Compte A;5000.00;Non',
  '2026-01-20;2026-01-20;Supermarché;Carrefour;Alimentation;Vie;-45,30;;123;Compte A;4954.70;Non',
  '2026-02-03;2026-02-03;Abonnement;Spotify;Loisirs;Loisirs;"-9,99";;456;Compte B;100.00;Non',
].join('\r\n') + '\r\n';

describe('loadTransactions', () => {
  it('parses 3 rows', () => {
    const txs = loadTransactions(INLINE_CSV);
    assert.equal(txs.length, 3);
    assert.equal(txs[0].date, '2026-01-05');
    assert.equal(txs[0].amount, 2000.0);
    assert.equal(txs[0].account, 'Compte A');
    assert.ok(Math.abs(txs[1].amount - (-45.30)) < 0.001);
    assert.ok(Math.abs(txs[2].amount - (-9.99)) < 0.001);
    assert.equal(txs[2].account, 'Compte B');
    assert.equal(txs[0].label, 'Salaire janvier');
    assert.equal(txs[0].supplier, 'Employeur');
    assert.equal(txs[1].category, 'Alimentation');
  });
});
