# ExpenseIQ — Smart Expense Tracker

> A full-stack personal finance dashboard built with Node.js, Express, PostgreSQL, and AI-powered insights using Groq · Llama 3.3.

🔗 **Live Demo:** [https://expense-analyzer-5qyg.onrender.com](https://expense-analyzer-5qyg.onrender.com)

---

## Screenshots

### Dashboard & Charts
![Dashboard](screenshots/dashboard.png)

### AI Financial Advisor
![AI Insights](screenshots/ai-insights.png)

### Budget Tracker & Month-wise Tracking
![Budget](screenshots/budget.png)

### Transactions List
![Transactions](screenshots/transactions.png)

---

## Features

| Feature | Description |
|---|---|
| 📊 **Live Dashboard** | 5 KPI cards — Income, Expenses, Balance, Savings Rate, Top Expense |
| 🤖 **AI Financial Advisor** | Personalized spending insights powered by Groq · Llama 3.3 70B |
| 📈 **Charts** | Monthly Income vs Expenses bar chart + Category doughnut chart |
| 💰 **Budget Tracker** | Set per-category monthly limits with colour-coded progress bars |
| 🗓️ **Month-wise Tracking** | Compare income, expenses, and balance across months with trend bars |
| ✏️ **Full CRUD** | Add, edit, delete transactions with validation |
| 🔍 **Filter & Search** | Filter by type, category, or keyword in real time |
| ⬇️ **Export CSV** | Download all transactions as a `.csv` file |
| 🗄️ **Cloud Database** | Persistent storage with Neon PostgreSQL — data survives restarts |

---

## Tech Stack

### Backend
- **Node.js** + **Express.js** — REST API
- **PostgreSQL** (Neon) — Cloud database
- **Groq SDK** — AI insights via Llama 3.3 70B
- **dotenv** — Environment variable management

### Frontend
- **Vanilla HTML5 / CSS3 / JavaScript** — No frameworks
- **Chart.js** — Interactive bar and doughnut charts
- CSS Grid + Flexbox — Fully responsive layout

### DevOps
- **GitHub** — Version control
- **Render** — Cloud deployment
- **Neon** — Serverless PostgreSQL

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transactions` | List all (supports `?search`, `?type`, `?category`) |
| `POST` | `/api/transactions` | Add new transaction |
| `PUT` | `/api/transactions/:id` | Edit a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/summary` | Total income, expenses, balance, by-category |
| `GET` | `/api/monthly` | Month-wise aggregated data |
| `GET` | `/api/budget` | Get budget limits |
| `PUT` | `/api/budget` | Update budget limits |
| `GET` | `/api/ai/insights` | AI-generated financial analysis |

---

## Run Locally

### Prerequisites
- Node.js v18+
- A [Neon](https://neon.tech) PostgreSQL database (free)
- A [Groq](https://console.groq.com) API key (free)

### Setup

```bash
# Clone the repo
git clone https://github.com/abhaykhaiwal/Expense-Analyzer.git
cd Expense-Analyzer

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Fill in your DATABASE_URL and GROQ_API_KEY

# Start the server
node server.js
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=3000
```

---

## Project Structure

```
├── server.js          # Express REST API + DB + AI endpoint
├── public/
│   ├── index.html     # App shell & layout
│   ├── style.css      # All styles (CSS variables, Grid, animations)
│   └── app.js         # Frontend logic (fetch, charts, modals)
├── .env.example       # Environment variable template
├── Procfile           # Deployment config
└── package.json
```

---

## Skills Demonstrated

- REST API design with proper HTTP status codes and validation
- PostgreSQL — schema design, parameterised queries, aggregations
- Gen AI integration — LLM prompt engineering, structured output parsing
- Chart.js — dynamic data visualisation
- Responsive UI — CSS Grid, Flexbox, media queries
- Cloud deployment — Render + Neon free tier
- Security — XSS prevention, environment variable management, `.gitignore`

---

*Built with Node.js · Express · PostgreSQL · Groq AI · Chart.js*
