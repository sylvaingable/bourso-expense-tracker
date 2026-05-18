const STORAGE_KEY = 'expense-tracker:ignore-rules';

export function loadIgnoreRules() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveIgnoreRules(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}
