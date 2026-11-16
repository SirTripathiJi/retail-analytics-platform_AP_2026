# Authentication and retail data

## Authentication modes

The application uses Supabase Auth when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. Copy `.env.example` to `.env.local`, supply the public project URL and publishable key, enable email/password sign-in, and add the app URLs to Supabase's redirect allowlist. Never put a Supabase service-role key in a `VITE_` variable.

Without those variables, the app uses a **local demo authentication adapter** so the protected retail workspace can be exercised. Demo accounts are kept only in this browser. Passwords are derived with Web Crypto PBKDF2 and a per-account random salt; plaintext passwords are not saved. This adapter is not production authentication, does not verify email, does not synchronize accounts across devices, and does not provide password recovery. The login and signup screens identify this mode. Use Supabase for hosted accounts and password reset.

Supabase signup behavior follows the project's email-confirmation setting. A signup with no established session displays an instruction to check email; the app enters the dashboard only after an authenticated session exists. “Remember me” selects persistent local or tab-scoped provider storage. Protected retail routes require an actual Supabase session or a local demo session. Sign-out clears the active provider/demo session.

## Retail data storage

No retail API or database is configured in this project. Products, customers, sales, settlements, dashboard card order, and related retail records are stored as versioned JSON in browser local storage, scoped by the authenticated user's ID. The workspace labels this as on-device data. It is not backed up, synchronized, or available on another device. The Settings data reset removes only the current account's ArthSaathi retail key from this browser; it does not remove a Supabase account or remote data.

Invoice totals are calculated from the saved cart lines: subtotal, percentage discount, tax on the discounted subtotal, then total. Product line profit uses the sale-time cost and rate, subtracts the bill discount, and treats a custom charge as having no associated cost. Sales reserve/decrement inventory only after a valid local save. Udhaar and any outstanding amount require a customer. Settlements are applied to that customer's oldest outstanding sale first and cannot exceed the current due.

The dashboard and analytics begin empty. Metrics and charts derive from records entered into this browser; there are no fabricated starter products or business numbers. Configure a protected server data API and authorization rules before using the platform for shared production business data.

## Password recovery

Password-reset requests and password updates work through Supabase Auth when configured. Local demo mode cannot send recovery emails or securely reset the account password; the reset screen explains the missing integration.
