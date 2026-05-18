export function shouldDrop(label, patterns) {
  const lower = label.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

export function filterTransactions(txs, ignorePatterns) {
  return txs.filter(t => !shouldDrop(t.label, ignorePatterns));
}

export function applyDrilldownFilters(txs, { month, flow, category, account, search }) {
  let result = txs;
  if (month) result = result.filter(t => t.date.slice(0, 7) === month);
  if (flow === 'Revenus') result = result.filter(t => t.amount >= 0);
  else if (flow === 'Dépenses') result = result.filter(t => t.amount < 0);
  if (category && category !== 'Toutes') result = result.filter(t => t.category === category);
  if (account && account !== 'Tous') result = result.filter(t => t.account === account);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(t => t.label.toLowerCase().includes(q));
  }
  return result;
}
