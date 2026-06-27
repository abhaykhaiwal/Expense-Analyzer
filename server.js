require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Create a .env file — see .env.example');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB Init ────────────────────────────────────────────────────────────────

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id        SERIAL PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      amount    DECIMAL(10,2) NOT NULL,
      category  VARCHAR(100) NOT NULL,
      date      DATE NOT NULL,
      type      VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS budgets (
      category     VARCHAR(100) PRIMARY KEY,
      limit_amount DECIMAL(10,2)
    );
  `);

  const { rowCount: bc } = await pool.query('SELECT 1 FROM budgets LIMIT 1');
  if (!bc) {
    await pool.query(`
      INSERT INTO budgets (category, limit_amount) VALUES
        ('Food',6000),('Transport',2000),('Entertainment',2000),
        ('Utilities',4000),('Healthcare',3000),('Shopping',5000),
        ('Income',NULL),('Other',2000)
    `);
  }

  const { rowCount: tc } = await pool.query('SELECT 1 FROM transactions LIMIT 1');
  if (!tc) {
    await pool.query(`
      INSERT INTO transactions (description, amount, category, date, type) VALUES
        ('Monthly Salary',   85000,  'Income',        '2026-04-01', 'income'),
        ('Groceries',        -4200,  'Food',           '2026-04-05', 'expense'),
        ('Netflix',          -649,   'Entertainment',  '2026-04-07', 'expense'),
        ('Electricity Bill', -1850,  'Utilities',      '2026-04-10', 'expense'),
        ('Freelance Project',22000,  'Income',         '2026-04-15', 'income'),
        ('Monthly Salary',   85000,  'Income',         '2026-05-01', 'income'),
        ('Restaurant Dinner',-1800,  'Food',           '2026-05-08', 'expense'),
        ('Metro Pass',       -600,   'Transport',      '2026-05-10', 'expense'),
        ('Amazon Shopping',  -3200,  'Shopping',       '2026-05-14', 'expense'),
        ('Internet Bill',    -999,   'Utilities',      '2026-05-18', 'expense'),
        ('Monthly Salary',   85000,  'Income',         '2026-06-01', 'income'),
        ('Groceries',        -3800,  'Food',           '2026-06-05', 'expense'),
        ('Gym Membership',   -1500,  'Healthcare',     '2026-06-08', 'expense'),
        ('Freelance Project',18000,  'Income',         '2026-06-12', 'income'),
        ('Electricity Bill', -2100,  'Utilities',      '2026-06-15', 'expense')
    `);
  }
}

// ─── Transactions ────────────────────────────────────────────────────────────

app.get('/api/transactions', async (req, res) => {
  try {
    const { category, type, search } = req.query;
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    if (category) { params.push(category);        query += ` AND category = $${params.length}`; }
    if (type)     { params.push(type);            query += ` AND type = $${params.length}`; }
    if (search)   { params.push(`%${search}%`);   query += ` AND description ILIKE $${params.length}`; }
    query += ' ORDER BY date DESC, id DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { description, amount, category, date, type } = req.body;
    if (!description || amount === undefined || !category || !date || !type)
      return res.status(400).json({ error: 'All fields are required' });
    if (!['income','expense'].includes(type))
      return res.status(400).json({ error: 'Type must be income or expense' });
    const amt = type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
    const { rows } = await pool.query(
      'INSERT INTO transactions (description,amount,category,date,type) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [description, amt, category, date, type]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { description, amount, category, date, type } = req.body;
    if (!description || amount === undefined || !category || !date || !type)
      return res.status(400).json({ error: 'All fields are required' });
    if (!['income','expense'].includes(type))
      return res.status(400).json({ error: 'Type must be income or expense' });
    const amt = type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
    const { rows } = await pool.query(
      'UPDATE transactions SET description=$1,amount=$2,category=$3,date=$4,type=$5 WHERE id=$6 RETURNING *',
      [description, amt, category, date, type, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Transaction not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Summary & Monthly ───────────────────────────────────────────────────────

app.get('/api/summary', async (req, res) => {
  try {
    const { rows: [s] } = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income'  THEN amount      ELSE 0 END), 0) AS "totalIncome",
        COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0) AS "totalExpenses"
      FROM transactions
    `);
    const { rows: cats } = await pool.query(`
      SELECT category, SUM(amount) AS total FROM transactions GROUP BY category
    `);
    const byCategory = {};
    cats.forEach(r => { byCategory[r.category] = parseFloat(r.total); });
    const totalIncome   = parseFloat(s.totalIncome);
    const totalExpenses = parseFloat(s.totalExpenses);
    res.json({ totalIncome, totalExpenses, balance: totalIncome - totalExpenses, byCategory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/monthly', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(date,'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount      ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0) AS expenses
      FROM transactions
      GROUP BY TO_CHAR(date,'YYYY-MM')
      ORDER BY month
    `);
    res.json(rows.map(r => ({
      month:    r.month,
      income:   parseFloat(r.income),
      expenses: parseFloat(r.expenses),
      balance:  parseFloat(r.income) - parseFloat(r.expenses),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Budget ───────────────────────────────────────────────────────────────────

app.get('/api/budget', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT category, limit_amount FROM budgets');
    const budgets = {};
    rows.forEach(r => { budgets[r.category] = r.limit_amount ? parseFloat(r.limit_amount) : null; });
    res.json(budgets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/budget', async (req, res) => {
  try {
    for (const [cat, val] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO budgets (category,limit_amount) VALUES ($1,$2) ON CONFLICT (category) DO UPDATE SET limit_amount=$2',
        [cat, val]
      );
    }
    const { rows } = await pool.query('SELECT category, limit_amount FROM budgets');
    const budgets = {};
    rows.forEach(r => { budgets[r.category] = r.limit_amount ? parseFloat(r.limit_amount) : null; });
    res.json(budgets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Insights (Gemini) ────────────────────────────────────────────────────

app.get('/api/ai/insights', async (req, res) => {
  if (!genAI) return res.status(503).json({ error: 'GEMINI_API_KEY not set in .env' });
  try {
    const [{ rows: txRows }, { rows: [s] }] = await Promise.all([
      pool.query('SELECT * FROM transactions ORDER BY date DESC'),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount      ELSE 0 END),0) AS income,
          COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END),0) AS expenses
        FROM transactions
      `),
    ]);

    const totalIncome   = parseFloat(s.income);
    const totalExpenses = parseFloat(s.expenses);
    const savingsRate   = totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

    const catSpend = {};
    txRows.filter(t => t.type === 'expense').forEach(t => {
      catSpend[t.category] = (catSpend[t.category] || 0) + Math.abs(parseFloat(t.amount));
    });
    const catSummary = Object.entries(catSpend)
      .sort((a, b) => b[1] - a[1])
      .map(([c, a]) => `${c}: ₹${a.toLocaleString('en-IN')}`)
      .join(', ');

    const prompt = `You are a friendly personal finance advisor for an Indian user. Analyze this data:

Total Income: ₹${totalIncome.toLocaleString('en-IN')}
Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
Net Balance: ₹${(totalIncome - totalExpenses).toLocaleString('en-IN')}
Savings Rate: ${savingsRate}%
Spending by Category: ${catSummary}
Total Transactions: ${txRows.length}

Respond in this exact format:
**Overall Assessment**
[2-3 sentences on financial health]

**Key Insights**
• [specific insight with rupee amounts]
• [specific insight with rupee amounts]
• [specific insight with rupee amounts]

**Savings Tips**
• [actionable tip]
• [actionable tip]

**Financial Health Score: X/10**
[one sentence explanation]

Be specific, concise, and use Indian rupee context.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    res.json({ insights: result.response.text() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────

initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err.message); process.exit(1); });
