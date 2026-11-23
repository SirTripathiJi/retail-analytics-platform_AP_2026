# अर्थ SAATHI — Retail Analytics & Management Platform

**Apne Business Ka Apna Saathi.**

A unified retail workspace for inventory, billing, customer khata, payments, and business insights.

[GitHub Repository](https://github.com/SirTripathiJi/retail-analytics-platform_AP_2026) · React + Vite · Node.js + Express · MongoDB Node.js Driver

---

## Overview

**अर्थ SAATHI** is a retail management application designed to help small businesses keep their everyday shop operations organized. It brings product and stock management, customer records, billing, credit (Udhaar/Khata), payment tracking, and business analytics into one application.

This repository contains both application modules in one project:

- **Frontend:** a React single-page application built with Vite.
- **Backend:** a separately runnable Express REST API in the `backend/` directory.
- **Database layer:** MongoDB repository adapters and tenant-aware persistence code built with the official MongoDB Node.js Driver.

The frontend and backend live in the **same Git repository**, but run as separate development processes.

## Product capabilities

### Retail workspace

- Product and category management.
- Stock quantity adjustments and low-stock status.
- Expiry-date tracking.
- Customer records and purchase history.
- Sales and invoice workflows, including cash and credit sales.
- Customer Udhaar / Khata balances and payment settlements.
- Sales, profit, inventory, product, and category analytics.
- Business profile and configurable settings.
- Dashboard language and theme preferences.

> **Current frontend data boundary:** the retail workspace currently stores products, customers, sales, settlements, and dashboard preferences in browser Local Storage. The frontend retail data provider has not yet been switched to the backend REST API. The UI and backend API modules exist in the same repository, but this should not be interpreted as completed end-to-end frontend/API integration.

### Backend API modules

| Module | Base path | Purpose |
|---|---|---|
| Health | `/api/health` | API process health |
| Authentication | `/api/auth` | Registration and login |
| Products | `/api/products` | Product and stock operations |
| Categories | `/api/categories` | Product categories |
| Customers | `/api/customers` | Customer records and history |
| Khata | `/api/khata` | Customer credit ledger |
| Invoices | `/api/invoices` | Billing, invoice lifecycle, invoice payments |
| Payments | `/api/payments` | Customer payments and allocations |
| Transactions | `/api/transactions` | Derived transaction history |
| Dashboard | `/api/dashboard` | Business dashboard metrics |
| Analytics | `/api/analytics` | Sales, product, category, and inventory analytics |
| Business | `/api/business` | Profile, settings, and reset operations |

See [Backend API Reference](./backend/API_REFERENCE.md) for request/response contracts, validation rules, authentication requirements, and error codes.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, React Router |
| UI and styling | CSS, Tailwind CSS, Lucide React |
| Charts | Recharts |
| Frontend authentication | Supabase Auth or local demo adapter |
| Backend runtime | Node.js |
| Backend framework | Express 5 |
| Database driver | Official MongoDB Node.js Driver |
| Backend authentication | JWT and bcrypt |
| Backend security | Helmet, CORS allowlist, express-rate-limit |
| Tests | Node.js built-in test runner |

## Repository structure

```text
retail-analytics-platform_AP_2026/
│
├── src/                         # React + Vite frontend
│   ├── auth/                    # Frontend session provider
│   ├── components/              # Shared UI and layout components
│   ├── pages/                   # Authentication and dashboard pages
│   ├── retail/                  # Retail workspace and local data logic
│   ├── services/                # Frontend authentication services
│   └── theme/                   # Theme provider
│
├── public/                      # Static assets
│
├── backend/                     # Express REST API
│   ├── src/
│   │   ├── config/              # DB connection, tenant provider, provisioning
│   │   ├── controllers/
│   │   ├── errors/
│   │   ├── middleware/
│   │   ├── repositories/        # MongoDB and unavailable adapters
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── app.js
│   │   └── server.js
│   ├── test/
│   ├── postman/
│   ├── API_REFERENCE.md
│   ├── DATABASE_INTEGRATION_HANDOVER.md
│   └── package.json
│
├── dbms/                        # Database/DBMS project material
├── AUTH_SETUP.md
├── .env.example
├── package.json                 # Frontend dependencies and scripts
└── vite.config.js
```

## Architecture

### Frontend

The frontend is a React single-page application. Its main areas are authentication, shared layout/UI components, retail workspace pages, theme and language providers, and browser-local retail data handling.

### Backend

The backend follows a layered Express architecture:

- **Routes** register HTTP endpoints.
- **Controllers** translate HTTP requests and responses.
- **Services** contain validation and business workflows.
- **Repositories** provide data-access interfaces and MongoDB implementations.
- **Middleware** handles authentication, tenant context, security, and errors.
- **Configuration** manages central database connection, tenant repository provisioning, and tenant database setup.

### Tenant-aware database design

The backend code includes a tenant repository provider. It uses the authenticated request context, checks active membership in the central database, resolves a server-side tenant connection mapping, obtains the configured database, provisions tenant collections and indexes, and creates tenant-scoped repository instances for the request.

The tenant provisioning module defines these operational collections:

- `products`
- `categories`
- `customers`
- `customerLedger`
- `invoices`
- `payments`
- `businessProfiles`
- `businessSettings`
- `businessResetAudits`
- `invoiceSequences`

Invoice items are stored as snapshots embedded in invoice documents. Transaction history is derived from invoices, payments, and Khata ledger records rather than stored in a separate transactions collection.

**Deployment and verification note:** the repository contains MongoDB connection, tenant-provider, and provisioning implementations. However, source-code presence does not prove that a live Atlas environment is configured or that production persistence has been verified. Configure the required credentials and central membership/tenant mapping records, then run live integration tests before treating the service as production-ready. Billing, payment, Khata, and reset workflows use MongoDB transactions and require a replica set or sharded cluster; a standalone MongoDB server is not sufficient.

## Getting started

### Prerequisites

- Node.js (use a currently supported LTS release).
- npm.
- Git.
- A MongoDB Atlas or other MongoDB deployment when exercising persistent backend operations.

### 1. Clone the repository

```bash
git clone https://github.com/SirTripathiJi/retail-analytics-platform_AP_2026.git
cd retail-analytics-platform_AP_2026
```

### 2. Install frontend dependencies

Run from the repository root:

```bash
npm install
```

### 3. Configure frontend authentication (optional)

The frontend uses Supabase Auth when both variables below are configured. Without them, it falls back to a browser-local demo authentication adapter.

Create `.env.local` in the repository root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use only the Supabase publishable/anon key in frontend configuration. **Never put a Supabase service-role key in a `VITE_` variable.**

In local demo mode, accounts and retail records remain in that browser. They are not shared with the backend, synchronized to another device, or backed up remotely. Password recovery is not available in local demo mode.

See [AUTH_SETUP.md](./AUTH_SETUP.md) for details about authentication modes and retail data storage.

### 4. Start the frontend

From the repository root:

```bash
npm run dev
```

Vite prints the local URL in the terminal (normally `http://localhost:5173`).

## Running the backend

The backend is a separate Node.js application inside this same repository.

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure backend environment

Copy the example environment file:

```bash
cp .env.example .env
```

The backend environment file documents these variables:

| Variable | Description |
|---|---|
| `PORT` | API port; defaults to `3001` |
| `NODE_ENV` | Runtime environment |
| `CENTRAL_MONGODB_URI` | Central account database connection URI |
| `CENTRAL_MONGODB_DATABASE` | Central database name |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | MongoDB server selection timeout |
| `TENANT_DB_CACHE_LIMIT` | Maximum cached tenant database entries |
| `TENANT_DB_IDLE_TIMEOUT_MS` | Idle tenant connection eviction interval |
| `TENANT_MONGODB_URI__DEV` | Optional URI referenced by a server-side tenant secret reference |
| `JWT_SECRET` | Secret used to sign and verify backend JWTs |
| `JWT_EXPIRES_IN` | JWT expiry; defaults to `1h` |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `BUSINESS_TIME_ZONE` | Global analytics timezone fallback; defaults to `UTC` |

Set a strong `JWT_SECRET` and configure MongoDB values through your local environment or deployment secret manager. Do not commit `.env`, database URIs, passwords, signing secrets, or customer data.

The tenant provider resolves membership and tenant connection metadata from the central database. Tenant mappings refer to a server-side secret reference and database name; never accept a MongoDB URI or tenant database selector from a browser request.

### 3. Start the backend

```bash
npm run dev
```

The API listens on port `3001` by default. For a production-style process, use:

```bash
npm start
```

### 4. Health endpoint

With the backend running, open:

```text
http://localhost:3001/api/health
```

The health endpoint reports API process status. A successful health response alone does **not** prove that the central database, tenant mappings, or all business operations are ready.

## Running both applications

Open two terminal windows from the repository root.

**Terminal 1 — Frontend**

```bash
npm run dev
```

**Terminal 2 — Backend**

```bash
cd backend
npm run dev
```

The applications are part of one repository but run as separate processes: Vite serves the frontend, and Express serves the API.

## Tests and build

### Frontend

Run from the repository root:

```bash
npm test
npm run build
```

### Backend

Run from the `backend/` directory:

```bash
npm test
```

The backend tests use Node's built-in test runner and include test fixtures/in-memory repositories for isolated logic tests. Passing unit tests does not by itself verify a live MongoDB deployment, transaction support, tenant isolation against real databases, or complete frontend-to-backend workflows.

## API testing and documentation

An importable Postman collection is available at:

[Backend Postman collection](./backend/postman/arth-saathi-api.postman_collection.json)

Related documentation:

- [Backend API Reference](./backend/API_REFERENCE.md)
- [Database Integration Handover](./backend/DATABASE_INTEGRATION_HANDOVER.md)
- [Backend-specific README](./backend/README.md)
- [Frontend Authentication and Storage Notes](./AUTH_SETUP.md)

## Current integration boundaries

The repository contains substantial frontend and backend implementations. Keep these boundaries in mind during demos and deployment:

1. **Retail data:** the frontend retail provider currently persists products, customers, sales, settlements, and dashboard ordering in browser Local Storage. It is not yet using the backend REST API as its retail persistence layer.
2. **Authentication:** the frontend uses Supabase Auth when configured, or a local demo adapter otherwise. The backend has separate email/password, bcrypt, and JWT authentication endpoints. A verified bridge between the frontend session and backend JWT must be completed before the two identity flows can be treated as one production authentication system.
3. **MongoDB runtime:** the backend contains central connection, tenant mapping, tenant database provisioning, and request-scoped repository-provider code. These require valid environment configuration, central membership and tenant mapping records, and live deployment verification.
4. **Transactions:** billing, payments, Khata, and reset workflows require MongoDB transaction support from a replica set or sharded cluster.
5. **Health vs readiness:** API health indicates that the Express process is running; verify database readiness and core business workflows separately.

## Security notes

- Never commit `.env` files or secrets.
- Never expose MongoDB connection strings to the frontend.
- Never trust a client-provided `businessId`, database name, or MongoDB URI to select a tenant.
- Keep tenant selection tied to verified authentication and active central membership.
- Configure explicit CORS origins for deployment; do not use wildcard origins.
- Use TLS, least-privilege database credentials, secret rotation, backups, and safe log redaction in deployed environments.

## Project information

**Project:** अर्थ SAATHI — Retail Analytics & Management Platform  
**Academic year:** 2026  
**Repository:** [SirTripathiJi/retail-analytics-platform_AP_2026](https://github.com/SirTripathiJi/retail-analytics-platform_AP_2026)

---

**अर्थ SAATHI**  
*Apne Business Ka Apna Saathi.*  
Simplifying Retail. Empowering Businesses.
