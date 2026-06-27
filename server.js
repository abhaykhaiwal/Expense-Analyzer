const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let transactions = [
  { id: 1,  description: 'Monthly Salary',     amount:  85000,   category: 'Income',        date: '2026-04-01', type: 'income'  },
  { id: 2,  description: 'Groceries',           amount: -4200,    category: 'Food',          date: '2026-04-05', type: 'expense' },
  { id: 3,  description: 'Netflix',             amount: -649,     category: 'Entertainment', date: '2026-04-07', type: 'expense' },
  { id: 4,  description: 'Electricity Bill',    amount: -1850,    category: 'Utilities',     date: '2026-04-10', type: 'expense' },
  { id: 5,  description: 'Freelance Project',   amount:  22000,   category: 'Income',        date: '2026-04-15', type: 'income'  },
  { id: 6,  description: 'Monthly Salary',      amount:  85000,   category: 'Income',        date: '2026-05-01', type: 'income'  },
  { id: 7,  description: 'Restaurant Dinner',   amount: -1800,    category: 'Food',          date: '2026-05-08', type: 'expense' },
  { id: 8,  description: 'Metro Pass',          amount: -600,     category: 'Transport',     date: '2026-05-10', type: 'expense' },
  { id: 9,  description: 'Amazon Shopping',     amount: -3200,    category: 'Shopping',      date: '2026-05-14', type: 'expense' },
  { id: 10, description: 'Internet Bill',       amount: -999,     category: 'Utilities',     date: '2026-05-18', type: 'expense' },
  { id: 11, description: 'Monthly Salary',      amount:  85000,   category: 'Income',        date: '2026-06-01', type: 'income'  },
  { id: 12, description: 'Groceries',           amount: -3800,    category: 'Food',          date: '2026-06-05', type: 'expense' },
  { id: 13, description: 'Gym Membership',      amount: -1500,    category: 'Healthcare',    date: '2026-06-08', type: 'expense' },
  { id: 14, description: 'Freelance Project',   amount:  18000,   category: 'Income',        date: '2026-06-12', type: 'income'  },
  { id: 15, description: 'Electricity Bill',    amount: -2100,    category: 'Utilities',     date: '2026-06-15', type: 'expense' },
];
let nextId = 16;

let budgets = {
  Food: 6000, Transport: 2000, Entertainment: 2000,
  Utilities: 4000, Healthcare: 3000, Shopping: 5000,
  Income: null, Other: 2000,
};

app.get('/api/transactions', (req, res) => {
  const { category, type, search } = req.query;
  let result = [...transactions];

  if (category) result = result.filter(t => t.category === category);
  if (type) result = result.filter(t => t.type === type);
  if (search) result = result.filter(t => t.description.toLowerCase().includes(search.toLowerCase()));

  res.json(result);
});

app.get('/api/transactions/:id', (req, res) => {
  const transaction = transactions.find(t => t.id === parseInt(req.params.id));
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  res.json(transaction);
});

app.post('/api/transactions', (req, res) => {
  const { description, amount, category, date, type } = req.body;

  if (!description || amount === undefined || !category || !date || !type) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Type must be income or expense' });
  }

  const transaction = {
    id: nextId++,
    description,
    amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
    category,
    date,
    type,
  };
  transactions.push(transaction);
  res.status(201).json(transaction);
});

app.put('/api/transactions/:id', (req, res) => {
  const index = transactions.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Transaction not found' });

  const { description, amount, category, date, type } = req.body;
  if (!description || amount === undefined || !category || !date || !type) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Type must be income or expense' });
  }

  transactions[index] = {
    ...transactions[index],
    description,
    amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
    category,
    date,
    type,
  };
  res.json(transactions[index]);
});

app.delete('/api/transactions/:id', (req, res) => {
  const index = transactions.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Transaction not found' });
  transactions.splice(index, 1);
  res.status(204).send();
});

app.get('/api/monthly', (req, res) => {
  const monthly = transactions.reduce((acc, t) => {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    if (!acc[key]) acc[key] = { income: 0, expenses: 0 };
    if (t.type === 'income') acc[key].income += t.amount;
    else acc[key].expenses += Math.abs(t.amount);
    return acc;
  }, {});

  const result = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data, balance: data.income - data.expenses }));

  res.json(result);
});

app.get('/api/summary', (req, res) => {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  const byCategory = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  res.json({ totalIncome, totalExpenses, balance, byCategory });
});

app.get('/api/budget', (req, res) => res.json(budgets));

app.put('/api/budget', (req, res) => {
  const updates = req.body;
  Object.keys(updates).forEach(cat => {
    budgets[cat] = updates[cat] === null ? null : Number(updates[cat]);
  });
  res.json(budgets);
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
