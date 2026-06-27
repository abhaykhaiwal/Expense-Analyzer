const API = 'http://localhost:3000/api';

const categoryColors = {
  Food: '#F59E0B', Transport: '#3B82F6', Entertainment: '#8B5CF6',
  Utilities: '#10B981', Healthcare: '#EC4899', Shopping: '#EF4444',
  Income: '#00A651', Other: '#9CA3AF',
};

const categoryIcons = {
  Food: '🍔', Transport: '🚗', Entertainment: '🎬',
  Utilities: '⚡', Healthcare: '💊', Shopping: '🛍️',
  Income: '💰', Other: '📌',
};

let monthlyChartInstance = null;
let categoryChartInstance = null;
let budgetEditMode = false;
let currentBudgets = {};

// ─── Summary ────────────────────────────────────────────────────────────────

async function fetchSummary() {
  const res = await fetch(`${API}/summary`);
  const data = await res.json();

  document.getElementById('totalIncome').textContent = fmt(data.totalIncome);
  document.getElementById('totalExpenses').textContent = fmt(data.totalExpenses);
  const balEl = document.getElementById('balance');
  balEl.textContent = fmt(data.balance);
  balEl.style.color = data.balance >= 0 ? 'var(--green)' : 'var(--red)';

  const rate = data.totalIncome > 0
    ? Math.round(((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100)
    : 0;
  const rateEl = document.getElementById('savingsRate');
  rateEl.textContent = `${rate}%`;
  rateEl.style.color = rate >= 20 ? 'var(--green)' : rate >= 0 ? 'var(--blue)' : 'var(--red)';

  const expCats = Object.entries(data.byCategory)
    .filter(([cat, amt]) => cat !== 'Income' && amt < 0)
    .sort((a, b) => a[1] - b[1]);
  document.getElementById('topExpense').textContent = expCats.length
    ? `${categoryIcons[expCats[0][0]] || '📌'} ${expCats[0][0]}`
    : '—';

  renderBreakdown(data.byCategory);
  updateCategoryChart(data.byCategory);
}

function renderBreakdown(byCategory) {
  const container = document.getElementById('categoryBreakdown');
  const entries = Object.entries(byCategory).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);

  container.innerHTML = entries.map(([cat, amt]) => `
    <div class="category-item">
      <div class="category-dot" style="background:${categoryColors[cat] || '#9CA3AF'}"></div>
      <span class="category-name">${cat}</span>
      <div class="category-bar-wrap">
        <div class="category-bar" style="width:${(Math.abs(amt)/maxAbs*100).toFixed(1)}%;background:${categoryColors[cat] || '#9CA3AF'}"></div>
      </div>
      <span class="category-amount" style="color:${amt >= 0 ? 'var(--green)' : 'var(--red)'}">${amt >= 0 ? '+' : ''}${fmt(amt)}</span>
    </div>
  `).join('');
}

// ─── Transactions ────────────────────────────────────────────────────────────

async function fetchTransactions() {
  const search = document.getElementById('searchInput').value;
  const type = document.getElementById('filterType').value;
  const category = document.getElementById('filterCategory').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (category) params.set('category', category);

  const res = await fetch(`${API}/transactions?${params}`);
  renderTransactions(await res.json());
}

function renderTransactions(transactions) {
  const list = document.getElementById('transactionList');
  const empty = document.getElementById('emptyState');

  if (!transactions.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(t => `
    <div class="transaction-item" data-id="${t.id}">
      <div class="tx-icon ${t.type}">${categoryIcons[t.category] || '📌'}</div>
      <div class="tx-info">
        <div class="tx-description">${escHtml(t.description)}</div>
        <div class="tx-meta">${formatDate(t.date)}</div>
      </div>
      <span class="tx-badge cat-${t.category}">${t.category}</span>
      <span class="tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</span>
      <button class="tx-edit" onclick="openEditModal(${t.id})" title="Edit">✎</button>
      <button class="tx-delete" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
    </div>
  `).join('');
}

async function deleteTransaction(id) {
  await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
  refresh();
}

document.getElementById('transactionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('formMessage');
  const body = {
    description: document.getElementById('description').value.trim(),
    amount: parseFloat(document.getElementById('amount').value),
    type: document.getElementById('type').value,
    category: document.getElementById('category').value,
    date: document.getElementById('date').value,
  };
  const res = await fetch(`${API}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    e.target.reset();
    document.getElementById('date').value = todayStr();
    showMessage(msgEl, 'Transaction added!', 'success');
    refresh();
  } else {
    const err = await res.json();
    showMessage(msgEl, err.error || 'Failed to add.', 'error');
  }
});

['searchInput', 'filterType', 'filterCategory'].forEach(id => {
  document.getElementById(id).addEventListener('input', fetchTransactions);
  document.getElementById(id).addEventListener('change', fetchTransactions);
});

// ─── Edit Modal ──────────────────────────────────────────────────────────────

async function openEditModal(id) {
  const res = await fetch(`${API}/transactions/${id}`);
  const t = await res.json();
  document.getElementById('editId').value = t.id;
  document.getElementById('editDescription').value = t.description;
  document.getElementById('editAmount').value = Math.abs(t.amount);
  document.getElementById('editType').value = t.type;
  document.getElementById('editCategory').value = t.category;
  document.getElementById('editDate').value = t.date;
  document.getElementById('editFormMessage').classList.add('hidden');
  document.getElementById('editModalOverlay').classList.remove('hidden');
  document.getElementById('editDescription').focus();
}

function closeEditModal() {
  document.getElementById('editModalOverlay').classList.add('hidden');
}

document.getElementById('editModalClose').addEventListener('click', closeEditModal);
document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
document.getElementById('editModalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditModal(); });

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const msgEl = document.getElementById('editFormMessage');
  const body = {
    description: document.getElementById('editDescription').value.trim(),
    amount: parseFloat(document.getElementById('editAmount').value),
    type: document.getElementById('editType').value,
    category: document.getElementById('editCategory').value,
    date: document.getElementById('editDate').value,
  };
  const res = await fetch(`${API}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) { closeEditModal(); refresh(); }
  else { const err = await res.json(); showMessage(msgEl, err.error || 'Failed to save.', 'error'); }
});

// ─── Charts ──────────────────────────────────────────────────────────────────

function initCharts() {
  const mCtx = document.getElementById('monthlyChart').getContext('2d');
  monthlyChartInstance = new Chart(mCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Income',   data: [], backgroundColor: '#00A651', borderRadius: 5 },
        { label: 'Expenses', data: [], backgroundColor: '#D0021B', borderRadius: 5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } },
      },
      scales: {
        y: { ticks: { callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) }, grid: { color: '#F3F4F6' } },
        x: { grid: { display: false } },
      },
    },
  });

  const cCtx = document.getElementById('categoryChart').getContext('2d');
  categoryChartInstance = new Chart(cCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 }, padding: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` } },
      },
      cutout: '65%',
    },
  });
}

function updateMonthlyChart(months) {
  monthlyChartInstance.data.labels = months.map(m => fmtMonth(m.month));
  monthlyChartInstance.data.datasets[0].data = months.map(m => m.income);
  monthlyChartInstance.data.datasets[1].data = months.map(m => m.expenses);
  monthlyChartInstance.update();
}

function updateCategoryChart(byCategory) {
  const entries = Object.entries(byCategory)
    .filter(([cat, amt]) => cat !== 'Income' && amt < 0)
    .map(([cat, amt]) => [cat, Math.abs(amt)])
    .sort((a, b) => b[1] - a[1]);
  categoryChartInstance.data.labels = entries.map(([cat]) => cat);
  categoryChartInstance.data.datasets[0].data = entries.map(([, amt]) => amt);
  categoryChartInstance.data.datasets[0].backgroundColor = entries.map(([cat]) => categoryColors[cat] || '#9CA3AF');
  categoryChartInstance.update();
}

// ─── Monthly Table ────────────────────────────────────────────────────────────

async function fetchMonthly() {
  const res = await fetch(`${API}/monthly`);
  const data = await res.json();
  renderMonthly(data);
  updateMonthlyChart(data);
}

function renderMonthly(months) {
  const container = document.getElementById('monthlyTable');
  if (!months.length) { container.innerHTML = '<p class="empty-state">No data yet.</p>'; return; }

  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expenses)), 1);

  container.innerHTML = `
    <div class="monthly-grid">
      <div class="monthly-head">Month</div>
      <div class="monthly-head">Income</div>
      <div class="monthly-head">Expenses</div>
      <div class="monthly-head">Balance</div>
      <div class="monthly-head">Trend</div>
      ${months.map(m => `
        <div class="monthly-cell month-label">${fmtMonth(m.month)}</div>
        <div class="monthly-cell income-val">${fmt(m.income)}</div>
        <div class="monthly-cell expense-val">${fmt(m.expenses)}</div>
        <div class="monthly-cell balance-val ${m.balance >= 0 ? 'pos' : 'neg'}">${m.balance >= 0 ? '+' : ''}${fmt(m.balance)}</div>
        <div class="monthly-cell">
          <div class="trend-bars">
            <div class="trend-bar income-bar" style="width:${(m.income/maxVal*100).toFixed(1)}%" title="Income: ${fmt(m.income)}"></div>
            <div class="trend-bar expense-bar" style="width:${(m.expenses/maxVal*100).toFixed(1)}%" title="Expenses: ${fmt(m.expenses)}"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

async function fetchAndRenderBudget() {
  const [budgetRes, txRes] = await Promise.all([
    fetch(`${API}/budget`),
    fetch(`${API}/transactions`),
  ]);
  currentBudgets = await budgetRes.json();
  const txList = await txRes.json();

  const thisMonth = new Date().toISOString().slice(0, 7);
  const spent = {};
  txList.forEach(t => {
    if (t.type === 'expense' && t.date.startsWith(thisMonth)) {
      spent[t.category] = (spent[t.category] || 0) + Math.abs(t.amount);
    }
  });
  renderBudget(currentBudgets, spent);
}

function renderBudget(budgets, spent) {
  const container = document.getElementById('budgetList');
  const cats = Object.keys(budgets).filter(c => c !== 'Income');

  if (budgetEditMode) {
    container.innerHTML = cats.map(cat => `
      <div class="budget-item">
        <div class="budget-cat-name">${categoryIcons[cat] || '📌'} ${cat}</div>
        <input class="budget-input" type="number" min="0" step="100"
          data-cat="${cat}" value="${budgets[cat] ?? ''}" placeholder="No limit" />
        <div></div><div></div>
      </div>
    `).join('');
    return;
  }

  container.innerHTML = cats.map(cat => {
    const limit = budgets[cat];
    const spentAmt = spent[cat] || 0;
    if (!limit) return `
      <div class="budget-item">
        <div class="budget-cat-name">${categoryIcons[cat] || '📌'} ${cat}</div>
        <div class="budget-no-limit">No limit set</div>
        <div class="budget-amounts">${fmt(spentAmt)}</div>
        <div></div>
      </div>`;

    const pct = Math.min((spentAmt / limit) * 100, 100).toFixed(1);
    const isOver = spentAmt > limit;
    const isNear = !isOver && pct >= 80;
    const barClass = isOver ? 'over-budget' : isNear ? 'near-budget' : '';

    return `
      <div class="budget-item">
        <div class="budget-cat-name">${categoryIcons[cat] || '📌'} ${cat}</div>
        <div class="budget-track">
          <div class="budget-bar-wrap">
            <div class="budget-bar ${barClass}" style="width:${pct}%"></div>
          </div>
          <div class="budget-meta">${fmt(spentAmt)} of ${fmt(limit)}</div>
        </div>
        <div class="budget-amounts ${isOver ? 'over' : ''}">
          ${isOver ? fmt(spentAmt - limit) + ' over' : fmt(limit - spentAmt) + ' left'}
        </div>
        <div class="budget-warning">${isOver ? '⚠ Over budget' : isNear ? '⚠ Near limit' : ''}</div>
      </div>`;
  }).join('');
}

async function toggleBudgetEdit() {
  const btn = document.getElementById('editBudgetBtn');
  if (!budgetEditMode) {
    budgetEditMode = true;
    btn.textContent = 'Save Limits';
    btn.classList.replace('btn-outline', 'btn-primary');
    fetchAndRenderBudget();
  } else {
    const inputs = document.querySelectorAll('.budget-input[data-cat]');
    const updates = {};
    inputs.forEach(inp => {
      const val = inp.value.trim();
      updates[inp.dataset.cat] = val === '' ? null : parseFloat(val);
    });
    await fetch(`${API}/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    budgetEditMode = false;
    btn.textContent = 'Edit Limits';
    btn.classList.replace('btn-primary', 'btn-outline');
    fetchAndRenderBudget();
  }
}

document.getElementById('editBudgetBtn').addEventListener('click', toggleBudgetEdit);

// ─── CSV Export ───────────────────────────────────────────────────────────────

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  fetch(`${API}/transactions`)
    .then(r => r.json())
    .then(txList => {
      const rows = [
        ['ID', 'Date', 'Description', 'Category', 'Type', 'Amount (₹)'],
        ...[...txList]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(t => [t.id, t.date, `"${t.description.replace(/"/g, '""')}"`, t.category, t.type, t.amount]),
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
        download: `expenseiq-${todayStr()}.csv`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function fmt(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMonth(str) {
  const [y, m] = str.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function refresh() {
  fetchSummary();
  fetchTransactions();
  fetchMonthly();
  fetchAndRenderBudget();
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

document.getElementById('getInsightsBtn').addEventListener('click', async () => {
  const btn       = document.getElementById('getInsightsBtn');
  const loadingEl = document.getElementById('aiLoading');
  const insightsEl = document.getElementById('aiInsights');

  btn.disabled = true;
  btn.textContent = '⏳ Analyzing...';
  insightsEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    const res  = await fetch(`${API}/ai/insights`);
    const data = await res.json();
    insightsEl.innerHTML = res.ok ? formatInsights(data.insights) : `<p class="ai-error">⚠ ${data.error}</p>`;
  } catch {
    insightsEl.innerHTML = '<p class="ai-error">⚠ Could not reach the server.</p>';
  } finally {
    loadingEl.classList.add('hidden');
    insightsEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '✨ Get AI Insights';
  }
});

function formatInsights(text) {
  return text
    .split('\n')
    .map(line => {
      if (/^\*\*(.+)\*\*$/.test(line)) return `<h4>${line.replace(/\*\*/g, '')}</h4>`;
      if (/^[•\-\*] /.test(line))      return `<li>${line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`;
      if (line.trim() === '')           return '';
      return `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('')
    .replace(/(<li>[\s\S]*?<\/li>)+/g, m => `<ul>${m}</ul>`);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('date').value = todayStr();
initCharts();
refresh();
