# अर्थ SAATHI — Retail Analytics & Management Platform

\<p align="center">   \*\*Apne Business Ka Apna Saathi.\*\*

A unified retail management platform designed to simplify inventory, billing, customer management, payments, and business analytics for small businesses.

\</p>

---

## About the Project

**अर्थ SAATHI** is a full-stack retail management platform designed to help shopkeepers manage their everyday business operations through a single digital workspace.

Small retail businesses often manage inventory, sales, customer records, billing, and outstanding payments manually. This can lead to inaccurate records, difficulty tracking stock, and limited visibility into business performance.

अर्थ SAATHI aims to solve these challenges by bringing essential retail operations together in one application.

The project consists of a React-based frontend and a Node.js + Express backend, maintained within a single repository. Its planned database architecture uses MongoDB with a Business-Owned Data (BYOD) approach, where each business's operational data is maintained in its own database environment.

## Key Features

### 1. Dashboard & Business Analytics

- Centralized retail dashboard.
- Sales and profit overview.
- Daily transaction tracking.
- Inventory statistics.
- Product and category performance analytics.

### 2. Inventory Management

- Add, update, and delete products.
- Organize products into categories.
- Track available stock quantities.
- Identify low-stock products.
- Monitor expired and upcoming expiry products.

### 3. Billing & Invoice Management

- Create customer invoices.
- Support cash and credit sales.
- Automatic invoice calculations.
- Stock deduction after successful sales.
- Invoice cancellation and reversal handling.
- Support for custom billing items.

### 4. Customer Management

- Maintain customer records.
- Track customer purchase history.
- Manage customer-specific outstanding balances.
- Maintain a digital Khata ledger.

### 5. Payments & Transactions

- Record customer payments.
- Track paid, unpaid, and partially paid invoices.
- Allocate payments against outstanding dues.
- Maintain transaction history.

### 6. Business Profile & Settings

- Manage business profile information.
- Configure business preferences.
- Support business timezone settings.
- Preview and perform supported business-data reset operations.

### 7. User Authentication

- User registration and login APIs.
- Password hashing using bcrypt.
- JWT-based authentication.
- Optional Supabase authentication support in the frontend.
- Local demo authentication when Supabase is not configured.

---

## Technology Stack

| Layer                   | Technologies                     |
| ----------------------- | -------------------------------- |
| Frontend                | React.js                         |
| Build Tool              | Vite                             |
| Routing                 | React Router                     |
| Styling                 | CSS, Tailwind CSS                |
| Charts                  | Recharts                         |
| Icons                   | Lucide React                     |
| Frontend Authentication | Supabase Auth / Local Demo Auth  |
| Backend Runtime         | Node.js                          |
| Backend Framework       | Express.js                       |
| Database Driver         | Official MongoDB Node.js Driver  |
| Planned Database        | MongoDB                          |
| Backend Security        | Helmet, CORS, Express Rate Limit |
| Authentication          | JWT, bcrypt                      |
| Testing                 | Node.js Test Runner              |

---

## Project Architecture

The entire application is maintained in a single GitHub repository, with separate frontend and backend modules.

```text
neo-landing/
│
├── src/                         # React frontend
│   ├── auth/
│   ├── components/
│   ├── pages/
│   ├── retail/
│   ├── services/
│   ├── theme/
│   ├── App.jsx
│   └── main.jsx
│
├── public/                      # Static frontend assets
│
├── backend/                     # Node.js + Express backend
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   └── server.js
│   │
│   ├── test/
│   ├── postman/
│   ├── API_REFERENCE.md
│   ├── DATABASE_INTEGRATION_HANDOVER.md
│   └── package.json
│
├── dbms/                        # Database-related project files
├── AUTH_SETUP.md
├── .env.example
├── package.json
├── vite.config.js
└── README.md
```

### Backend Architecture

The backend follows a layered architecture:

- **Routes:** Define REST API endpoints.
- **Controllers:** Handle HTTP requests and responses.
- **Services:** Implement business logic.
- **Repositories:** Handle data access operations.
- **Middleware:** Handle authentication, security, and errors.
- **Validators:** Validate incoming request data.

### Database Architecture — BYOD

अर्थ SAATHI is designed around a Business-Owned Data (BYOD) architecture.

The planned architecture separates account-level information from individual business data:

- A central database will maintain account and authentication information.
- Each business will have its own MongoDB database environment for operational records.
- Authenticated business context will be resolved on the server.
- Business data will remain isolated between different businesses.

The database integration and tenant-specific repository wiring are currently pending.

---

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js (LTS recommended)
- npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/SirTripathiJi/retail-analytics-platform_AP_2026.git
```

### 2. Open the Project

```bash
cd retail-analytics-platform_AP_2026
```

### 3. Install Frontend Dependencies

```bash
npm install
```

### 4. Configure Frontend Environment Variables

Create a `.env.local` file in the project root if you want to use Supabase authentication.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

If Supabase is not configured, the frontend uses its local demo authentication adapter.

See [AUTH_SETUP.md](./AUTH_SETUP.md) for additional information.

### 5. Start the Frontend

From the project root:

```bash
npm run dev
```

The Vite development server will display the local frontend URL in the terminal. The default Vite port is `5173`.

---

## Running the Backend

The backend is maintained inside the same repository under the `backend/` directory.

### 1. Navigate to Backend

```bash
cd backend
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` directory.

Use the provided example:

```bash
cp .env.example .env
```

Configure the required values:

```env
PORT=3001
NODE_ENV=development

CENTRAL_MONGODB_URI=
CENTRAL_MONGODB_DATABASE=

JWT_SECRET=your-secure-secret
JWT_EXPIRES_IN=1h

CORS_ORIGIN=http://localhost:5173,http://localhost:4173

BUSINESS_TIME_ZONE=UTC
```

**Important:** MongoDB integration is not yet configured. Keep database settings empty until the database integration is completed. A secure JWT secret must be configured before enabling token issuance and verification.

### 4. Start the Backend Server

```bash
npm run dev
```

The Express server starts on port `3001` by default.

### 5. Check Backend Health

Open:

```text
http://localhost:3001/api/health
```

The health endpoint currently reports whether the API is running and whether a database connection has been configured.

---

## API Documentation

The backend provides REST API endpoints for the following modules:

| Module                      | API Base Path       |
| --------------------------- | ------------------- |
| Health                      | `/api/health`       |
| Authentication              | `/api/auth`         |
| Products                    | `/api/products`     |
| Categories                  | `/api/categories`   |
| Customers                   | `/api/customers`    |
| Khata                       | `/api/khata`        |
| Invoices                    | `/api/invoices`     |
| Payments                    | `/api/payments`     |
| Transactions                | `/api/transactions` |
| Dashboard                   | `/api/dashboard`    |
| Analytics                   | `/api/analytics`    |
| Business Profile & Settings | `/api/business`     |

For complete endpoint details, request bodies, response formats, and error codes, refer to:

- [Backend API Reference](./backend/API_REFERENCE.md)
- [Database Integration Handover](./backend/DATABASE_INTEGRATION_HANDOVER.md)
- [Postman Collection](./backend/postman/arth-saathi-api.postman_collection.json)

**Note:** Database-dependent production API operations return `503 Service Unavailable` until the MongoDB persistence and tenant-specific repository integration is completed. The health endpoint can still respond successfully without a database connection.

---

## Testing

### Frontend Tests

From the project root:

```bash
npm test
```

### Backend Tests

Navigate to the backend directory:

```bash
cd backend
npm test
```

The backend test suite uses Node.js's built-in test runner and test-only in-memory repositories.

Passing automated tests validates the tested application logic. It does not establish that real MongoDB persistence or complete frontend-backend integration is working.

---

## Current Development Status

| Component                            | Status                  |
| ------------------------------------ | ----------------------- |
| React frontend                       | Developed               |
| Retail dashboard and UI              | Developed               |
| Inventory workflows                  | Implemented in frontend |
| Customer and Khata workflows         | Implemented in frontend |
| Billing and sales workflows          | Implemented in frontend |
| Frontend local data storage          | Implemented             |
| Backend REST API foundation          | Developed               |
| Authentication and JWT logic         | Developed               |
| Inventory and category APIs          | Developed               |
| Customer and Khata APIs              | Developed               |
| Billing and invoice APIs             | Developed               |
| Payments and transaction APIs        | Developed               |
| Dashboard and analytics APIs         | Developed               |
| Business profile and settings APIs   | Developed               |
| Backend security and validation      | Implemented             |
| Backend automated tests              | Implemented             |
| MongoDB runtime connection           | Pending                 |
| Tenant-specific database integration | Pending                 |
| Frontend-to-backend API integration  | Pending                 |
| End-to-end testing                   | Pending                 |

### Current Implementation Notes

- The frontend currently uses browser Local Storage for retail data.
- Supabase authentication is optional; local demo authentication is available when Supabase is not configured.
- The backend is a separately runnable Express application inside the same repository.
- The backend has not yet been connected to the frontend.
- MongoDB connection configuration and tenant-specific repository selection are pending.
- The backend's automated tests use test-only in-memory repositories; these are not used by the running production application.

---

## Future Scope

The next development stage focuses on completing the integration of the existing modules:

1. Configure the central MongoDB account database.
2. Implement business-specific MongoDB connection management.
3. Wire tenant-specific repositories into authenticated backend requests.
4. Connect the React frontend with backend REST APIs.
5. Replace frontend-only retail persistence with backend-backed data.
6. Perform frontend, backend, and database integration testing.
7. Complete end-to-end testing and deployment.

---

## Academic Project Information

**Project Name:** अर्थ SAATHI — Retail Analytics & Management Platform

**Academic Year:** 2026

**Repository:** [retail-analytics-platform_AP_2026](https://github.com/SirTripathiJi/retail-analytics-platform_AP_2026)

**Project Objective:** To develop a practical retail management platform that simplifies everyday shop operations and provides better visibility into inventory, sales, customers, and payments.

---

\<p align="center">
&#x20; \*\*अर्थ SAATHI\*\*

Apne Business Ka Apna Saathi.

Simplifying Retail. Empowering Businesses.

\</p>
