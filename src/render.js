const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function renderMetrics(container, { totalIncome, totalExpenses }) {
  const net = totalIncome - totalExpenses;
  container.innerHTML = `
    <div class="metrics">
      <div class="metric"><span class="metric-label">Total revenus</span><span class="metric-value income">${fmt.format(totalIncome)}</span></div>
      <div class="metric"><span class="metric-label">Total dépenses</span><span class="metric-value expense">${fmt.format(totalExpenses)}</span></div>
      <div class="metric"><span class="metric-label">Solde</span><span class="metric-value ${net >= 0 ? 'income' : 'expense'}">${fmt.format(net)}</span></div>
    </div>`;
}

export function renderSidebar(listEl, rules, onDelete) {
  listEl.innerHTML = '';
  rules.forEach((rule, i) => {
    const li = document.createElement('li');
    li.className = 'rule-item';
    const span = document.createElement('span');
    span.textContent = rule;
    const btn = document.createElement('button');
    btn.className = 'btn-icon';
    btn.textContent = '✕';
    btn.addEventListener('click', () => onDelete(i));
    li.append(span, btn);
    listEl.appendChild(li);
  });
}

export function renderDrilldownFilters(container, { months, categories, accounts, filters }, onChange) {
  const sel = (id, label, options, value) => {
    const opts = options.map(o => `<option${o === value ? ' selected' : ''}>${o}</option>`).join('');
    return `<label>${label}<select id="${id}">${opts}</select></label>`;
  };
  container.innerHTML = `
    <div class="filter-row">
      ${sel('filter-month', 'Mois', months, filters.month || months[0])}
      ${sel('filter-flow', 'Flux', ['Tous', 'Revenus', 'Dépenses'], filters.flow)}
      ${sel('filter-category', 'Catégorie', ['Toutes', ...categories], filters.category)}
      ${sel('filter-account', 'Compte', ['Tous', ...accounts], filters.account)}
    </div>`;
  ['filter-month', 'filter-flow', 'filter-category', 'filter-account'].forEach(id => {
    container.querySelector(`#${id}`).addEventListener('change', e => onChange(id, e.target.value));
  });
}

export function renderDrilldownTable(container, txs, selectedLabels, onToggle, onExclude) {
  const tbody = document.createDocumentFragment();

  txs.forEach(t => {
    const tr = document.createElement('tr');
    const checked = selectedLabels.has(t.label);
    tr.className = checked ? 'selected' : '';
    tr.innerHTML = `
      <td><input type="checkbox" ${checked ? 'checked' : ''}></td>
      <td>${t.date}</td>
      <td class="label-cell">${escHtml(t.label)}</td>
      <td>${escHtml(t.category)}</td>
      <td>${escHtml(t.supplier)}</td>
      <td class="amount ${t.amount >= 0 ? 'income' : 'expense'}">${fmt.format(t.amount)}</td>
      <td>${escHtml(t.account)}</td>`;
    tr.querySelector('input').addEventListener('change', () => onToggle(t.label));
    tbody.appendChild(tr);
  });

  const selectedCount = selectedLabels.size;
  const excludeBtn = selectedCount > 0
    ? `<button id="exclude-btn">Exclure ${selectedCount} libellé(s) sélectionné(s)</button>`
    : '';

  container.innerHTML = `
    ${excludeBtn}
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th></th><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Fournisseur</th><th>Montant</th><th>Compte</th>
        </tr></thead>
        <tbody id="drilldown-tbody"></tbody>
      </table>
    </div>`;

  container.querySelector('#drilldown-tbody').appendChild(tbody);
  if (selectedCount > 0) {
    container.querySelector('#exclude-btn').addEventListener('click', onExclude);
  }
}

export function renderDrilldownMetrics(container, txs) {
  const income = txs.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  container.innerHTML = `
    <div class="metrics metrics-sm">
      <div class="metric"><span class="metric-label">Revenus</span><span class="metric-value income">${fmt.format(income)}</span></div>
      <div class="metric"><span class="metric-label">Dépenses</span><span class="metric-value expense">${fmt.format(expenses)}</span></div>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
