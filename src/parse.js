export function parseAmount(raw) {
  return parseFloat(raw.replace(/^"|"$/g, '').replace(/\s/g, '').replace(',', '.'));
}

// "Libellé Suggéré" -> "libellesuggere"
export function normalizeHeader(h) {
  return h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseRow(row) {
  return {
    date: row['dateoperation'],
    label: row['libelle'],
    category: row['categorie'],
    supplier: row['libellesuggere'],
    amount: parseAmount(row['solde']),
    account: row['libellecompte'],
  };
}

export function parseCSV(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headers = splitLine(lines[0]).map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = splitLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      // "Solde" appears twice (amount, then balance): keep the first.
      if (!(h in row)) row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function splitLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ';') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

export function loadTransactions(text) {
  return parseCSV(text).map(parseRow);
}
