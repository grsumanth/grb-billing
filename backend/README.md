# GRB Pooja Items — Backend API

Node.js + Express + PostgreSQL backend for the GRB Billing System.

---

## Folder Structure

```
grb-backend/
├── server.js              ← Entry point
├── .env                   ← Your config (DB, JWT secret)
├── package.json
├── db/
│   ├── index.js           ← PostgreSQL connection pool
│   └── schema.sql         ← All table definitions
├── middleware/
│   └── auth.js            ← JWT protection middleware
└── routes/
    ├── auth.js            ← Register, Login, Profile
    ├── products.js        ← Products CRUD
    ├── customers.js       ← Customers CRUD
    ├── bills.js           ← Create, List, Delete bills
    └── reports.js         ← Analytics & summaries
```

---

## Setup (Step by Step)

### 1. Install Node.js
Download from https://nodejs.org (LTS version)

### 2. Install PostgreSQL
Download from https://www.postgresql.org/download/
- Remember your username and password during setup

### 3. Create the database
Open pgAdmin or psql terminal and run:
```sql
CREATE DATABASE grb_billing;
```

### 4. Run the schema
Connect to grb_billing and run the contents of `db/schema.sql`
In psql:
```bash
psql -U postgres -d grb_billing -f db/schema.sql
```

### 5. Configure .env
Edit `.env` and fill in your details:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grb_billing
DB_USER=postgres
DB_PASSWORD=your_actual_password
JWT_SECRET=any_long_random_string
```

### 6. Install dependencies
```bash
npm install
```

### 7. Start the server
```bash
# Development (auto-restarts on file change)
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:5000**

---

## API Endpoints

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login, get token |
| GET  | /api/auth/me | Get current user |

**Login body:**
```json
{ "identifier": "email_or_phone", "password": "your_password" }
```

### Products (🔒 requires token)
| Method | URL | Description |
|--------|-----|-------------|
| GET    | /api/products | List all products |
| GET    | /api/products?search=agarbatti | Search |
| POST   | /api/products | Add product |
| PUT    | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |

### Customers (🔒 requires token)
| Method | URL | Description |
|--------|-----|-------------|
| GET    | /api/customers | List all |
| GET    | /api/customers?search=name | Search |
| POST   | /api/customers | Add customer |
| PUT    | /api/customers/:id | Update |
| DELETE | /api/customers/:id | Delete |

### Bills (🔒 requires token)
| Method | URL | Description |
|--------|-----|-------------|
| GET    | /api/bills | All bills |
| GET    | /api/bills?date=2024-12-01 | Filter by date |
| GET    | /api/bills/:id | Single bill + items |
| POST   | /api/bills | Create bill |
| DELETE | /api/bills/:id | Delete bill |

**Create bill body:**
```json
{
  "customer_name": "Ravi Kumar",
  "customer_id": "uuid-optional",
  "gst_percent": 5,
  "items": [
    {
      "product_id": "uuid-optional",
      "product_name": "Agarbatti",
      "type": "Box",
      "quantity": 2,
      "price": 50
    }
  ]
}
```

### Reports (🔒 requires token)
| Method | URL | Description |
|--------|-----|-------------|
| GET | /api/reports/summary | Today + all-time stats |
| GET | /api/reports/daily?days=30 | Day-by-day revenue |
| GET | /api/reports/top-products?limit=5 | Best selling items |
| GET | /api/reports/recent-bills?limit=5 | Today's latest bills |

---

## How to connect your Frontend

After login, store the token and send it with every request:

```javascript
// Save token after login
localStorage.setItem('grb_token', data.token);

// Use token in all API calls
const token = localStorage.getItem('grb_token');

fetch('http://localhost:5000/api/products', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(res => res.json())
.then(products => console.log(products));
```
