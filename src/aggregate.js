export function aggregateMonthly(txs) {
  const buckets = {};
  for (const t of txs) {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    if (!buckets[key]) buckets[key] = { income: 0, expenses: 0 };
    if (t.amount >= 0) buckets[key].income += t.amount;
    else buckets[key].expenses += -t.amount;
  }
  return buckets;
}

export function sortedMonthKeys(monthly) {
  return Object.keys(monthly).sort();
}
