import { loadTransactions } from './parse.js';
import { filterTransactions, applyDrilldownFilters } from './filter.js';
import { aggregateMonthly, sortedMonthKeys } from './aggregate.js';
import { loadIgnoreRules, saveIgnoreRules } from './store.js';
import { renderChart } from './chart.js';
import {
  renderMetrics,
  renderSidebar,
  renderDrilldownFilters,
  renderDrilldownTable,
} from './render.js';

const state = {
  transactions: [],
  ignoreRules: loadIgnoreRules(),
  filters: { month: null, flow: 'Tous', category: 'Toutes', account: 'Tous', search: '' },
  selectedLabels: new Set(),
};

const canvas = document.getElementById('overview-chart');
const emptyState = document.getElementById('empty-state');
const overviewSection = document.getElementById('overview-section');
const drilldownSection = document.getElementById('drilldown-section');

function update() {
  const filtered = filterTransactions(state.transactions, state.ignoreRules);
  const monthly = aggregateMonthly(filtered);
  const keys = sortedMonthKeys(monthly);

  // Sidebar rules
  renderSidebar(
    document.getElementById('rules-list'),
    state.ignoreRules,
    (i) => {
      state.ignoreRules.splice(i, 1);
      saveIgnoreRules(state.ignoreRules);
      update();
    }
  );

  if (state.transactions.length === 0) {
    emptyState.hidden = false;
    overviewSection.hidden = true;
    drilldownSection.hidden = true;
    return;
  }
  emptyState.hidden = true;
  overviewSection.hidden = false;
  drilldownSection.hidden = false;

  // Ensure selected month is valid before computing drilldown
  const reversedKeys = [...keys].reverse();
  if (!state.filters.month || !keys.includes(state.filters.month)) {
    state.filters.month = reversedKeys[0] || null;
  }

  // Overview metrics + current month metrics side by side
  const totalIncome = keys.reduce((s, k) => s + monthly[k].income, 0);
  const totalExpenses = keys.reduce((s, k) => s + monthly[k].expenses, 0);
  const drillTxs = applyDrilldownFilters(filtered, state.filters);
  const monthIncome = drillTxs.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const monthExpenses = drillTxs.filter(t => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  renderMetrics(document.querySelector('[data-region="metrics"]'), {
    totalIncome, totalExpenses,
    month: state.filters.month, monthIncome, monthExpenses,
  });

  renderChart(canvas, monthly, keys, (month) => {
    state.filters.month = month;
    state.selectedLabels.clear();
    update();
  });

  const categories = [...new Set(filtered.map(t => t.category))].sort();
  const accounts = [...new Set(filtered.map(t => t.account))].sort();

  renderDrilldownFilters(
    document.querySelector('[data-region="drilldown-filters"]'),
    { months: reversedKeys, categories, accounts, filters: state.filters },
    (id, value) => {
      if (id === 'filter-month') state.filters.month = value;
      else if (id === 'filter-flow') state.filters.flow = value;
      else if (id === 'filter-category') state.filters.category = value;
      else if (id === 'filter-account') state.filters.account = value;
      state.selectedLabels.clear();
      update();
    }
  );

  renderDrilldownTable(
    document.querySelector('[data-region="drilldown-table"]'),
    drillTxs,
    state.selectedLabels,
    (label) => {
      if (state.selectedLabels.has(label)) state.selectedLabels.delete(label);
      else state.selectedLabels.add(label);
      update();
    },
    () => {
      for (const label of state.selectedLabels) {
        if (!state.ignoreRules.includes(label)) state.ignoreRules.push(label);
      }
      saveIgnoreRules(state.ignoreRules);
      state.selectedLabels.clear();
      update();
    }
  );
}

// File upload
document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.transactions = loadTransactions(ev.target.result);
    state.selectedLabels.clear();
    update();
  };
  reader.readAsText(file, 'UTF-8');
});

// Search
document.getElementById('filter-search').addEventListener('input', e => {
  state.filters.search = e.target.value;
  update();
});

// Add ignore rule
document.getElementById('add-rule-btn').addEventListener('click', () => {
  const input = document.getElementById('new-rule-input');
  const val = input.value.trim();
  if (!val) return;
  if (!state.ignoreRules.includes(val)) {
    state.ignoreRules.push(val);
    saveIgnoreRules(state.ignoreRules);
  }
  input.value = '';
  update();
});
document.getElementById('new-rule-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-rule-btn').click();
});

// Initial render (shows empty state + rules from localStorage)
overviewSection.hidden = true;
drilldownSection.hidden = true;
update();
