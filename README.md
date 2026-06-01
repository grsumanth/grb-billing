# GRB Billing System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-blue.svg)](https://nodejs.org/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-blue.svg)](https://www.postgresql.org/)
[![Security: Audited](https://img.shields.io/badge/Security-Audited-brightgreen.svg)](#)

A premium, production-ready billing and invoicing management system built for **GRB Pooja Items**. The application uses an offline-first architecture with dynamic synchronization capabilities, secure JWT authentication, real-time PDF generation, and automated transactional billing.

---

## 🏛️ Project Architecture (Separated Deployment)

The project is structured and optimized for a **Separated Deployment** model:
1. **Frontend**: A fast, static Single Page Application (SPA) hosted on **GitHub Pages** (loads instantly from a CDN).
2. **Backend**: An Express.js REST API hosted on **Render** (handles calculations, database connection pooling, PDF generation, and emails).
3. **Database & Storage**: Powered by **Supabase** (PostgreSQL database with secure Row Level Security policies + Supabase Storage for invoice PDF archiving).

```
GRB_BILLING/
├── backend/
│   ├── db/              ← PostgreSQL Pool & Schema migrations
│   ├── middleware/      ← Auth & Rate Limiting middlewares
│   ├── routes/          ← REST API Route Controllers
│   ├── tests/           ← Integration API Tests
│   ├── server.js        ← Express Server Entrypoint
│   └── package.json
└── frontend/
    ├── config.js        ← Dynamic API Routing Switcher
    ├── index.html       ← Login & Signup page
    ├── dashboard.html   ← Main Inventory & Billing Panel
    └── forgot-password.html
```

---

## ⚙️ Local Setup Guide

### 1. Database Setup
Ensure PostgreSQL is installed locally or create a project on Supabase. Run the DDL setup commands in your SQL Editor:
```bash
psql -U postgres -d your_db_name -f backend/db/schema.sql
```

### 2. Backend Installation & Configurations
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your connection secrets:
   ```bash
   cp .env.example .env
   ```

### 3. Start Application
- **Development Mode** (Backend): Runs on `http://localhost:5000` with hot-reloading:
  ```bash
  npm run dev
  ```
- **Production Mode** (Backend):
  ```bash
  npm start
  ```
- **Frontend**: Simply open `frontend/index.html` in your browser. The frontend auto-detects `localhost` and routes API requests to `http://localhost:5000` automatically.

---

## 🧪 Automated Testing & Code Quality

The backend features an integrated test runner and linter config to guarantee quality gates before commits:

- **Run Integration Tests**: Tests auth, customer registries, price formats, and transactional billing:
  ```bash
  npm test
  ```
- **Run ESLint Checker**: Ensures clean code syntax:
  ```bash
  npm run lint
  ```
- **Run Security Audit**: Checks dependencies for vulnerabilities:
  ```bash
  npm audit
  ```

---

## 🚀 Production Deployment Steps

### 1. Backend on Render
- Create a new **Web Service** on Render pointing to your repository.
- Set the **Root Directory** option to `backend`.
- Add all required variables in the **Environment** tab matching `backend/.env.example`.
- Ensure the build command is `npm install` and start command is `node server.js`.

### 2. Frontend on GitHub Pages
- Publish the `frontend` folder to GitHub Pages.
- Ensure the production domain matches `https://your-username.github.io/your-repo-name`.
- Update `frontend/config.js` with your Render backend URL.
- Update `allowedOrigins` in `backend/server.js` with your GitHub Pages URL to allow CORS.

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for more information.
