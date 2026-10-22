# Smart Cafeteria Ordering System

A full-stack campus cafeteria ordering MVP. The API is built with Node.js, Express, and MongoDB/Mongoose. The client uses React, Vite, React Router, and responsive CSS. Payments are academic simulations only; this application does not move real money or provide physical delivery.

## Architecture

```text
client/                         React/Vite web application
  src/
    components/                 Navigation, food cards, route guards
    context/                    Authentication and cart state
    services/api.js             Shared REST client
    App.jsx                     Public, student, kitchen, and admin pages
server/
  src/
    config/                     MongoDB connection
    models/                      User, menu, cart, order, payment, notification, contact message, log
    controllers/                REST request handlers
    routes/                     API route definitions and validation, including public contact submissions
    middleware/                 Authentication, validation, and image uploads
    utils/                       Shared rules, notifications, logging, errors
    scripts/seed.js             Admin, foodmaker, and sample cafeteria data
  test/                          Node built-in tests for order rules
  app.js                         Express app and global middleware
  server.js                      Database connection and API startup
```

## Requirements

- Node.js 20 or newer with npm (React Router 7 runtime requirement)
- MongoDB Atlas, or a local MongoDB instance

## Local setup (Windows PowerShell)

Open two PowerShell terminals in the project root. Check Node and npm:

```powershell
node --version
npm --version
```

### Configure and run the API

```powershell
Set-Location .\server
npm install
Copy-Item .env.example .env
```

Edit `server\.env` and set a reachable MongoDB URI, a long random JWT secret (at least 32 characters), and private seed account passwords. The seed passwords must be 8–72 UTF-8 bytes. Keep this file private and never commit it.

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
JWT_SECRET=<random-secret-at-least-32-characters>
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173
SEED_ADMIN_EMAIL=admin@cafeteria.local
SEED_ADMIN_PASSWORD=<private-password>
SEED_FOODMAKER_EMAIL=foodmaker@cafeteria.local
SEED_FOODMAKER_PASSWORD=<private-password>
```

Configure the Atlas database user and network access list to allow your development environment. For local MongoDB, set `MONGODB_URI=mongodb://127.0.0.1:27017/smart_cafeteria`.

Run seed data once and start the API:

```powershell
npm run seed
npm run dev
```

The seed script creates the configured administrator and foodmaker when absent, plus clearly marked sample categories and food with illustrative ETB prices. Existing accounts are not reset. The API waits for a successful database connection before listening. Check `http://localhost:5000/api/health`.

### Configure and run the client

In the second PowerShell terminal:

```powershell
Set-Location .\client
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`. The client API base URL is `VITE_API_URL` in `client\.env` and defaults to `http://localhost:5000/api`.

## Roles and access

- **Student:** Browse menu, search/filter items, edit their cart, place orders, run simulated payments, view order history and notifications.
- **Foodmaker:** View incoming orders and progress permitted kitchen status transitions.
- **Admin:** View live reports, manage categories and menu items, and access protected user, payment, report, and activity-log APIs.

All protected API routes validate the bearer JWT and enforce authorization on the server. The client keeps the token in `sessionStorage` for the current browser tab/session. This is simple for a demonstration but remains accessible to JavaScript; production deployments should consider HTTP-only secure cookies plus CSRF protections.

The public website is available at `/`, `/about`, `/services`, `/contact`, and `/menu`. Home-page featured food is loaded from the public menu API. Contact form submissions are validated and stored in MongoDB; the system does not send email notifications or display fabricated contact details.

After signing in, the complete student navigation is available at `/student/dashboard`: Dashboard, Browse Food, Food Categories, My Cart, Checkout, My Orders, Track Order, Payment History, Notifications, My Profile, and Logout. Food detail pages are at `/foods/:id`. The order API uses `served` as its completed state; the student interface displays it as **Completed**.

## API overview

All endpoints are prefixed by `/api`. Errors use `{ "success": false, "error": { "message": "..." } }`; validation errors can also include `details`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API health |
| POST | `/auth/register` | Public | Register as student; submitted roles are ignored |
| POST | `/auth/login` | Public | Login and receive a JWT |
| GET | `/auth/me` | Authenticated | Current public profile |
| POST | `/auth/logout` | Authenticated | Client-side stateless logout |
| POST | `/contact` | Public | Validate and store a cafeteria contact message in MongoDB (5 requests per hour per IP; no email is sent) |
| GET/POST | `/categories` | Public / Admin | List or create categories |
| PUT/DELETE | `/categories/:id` | Admin | Edit/delete (deletion blocked when menu items exist) |
| GET | `/menu`, `/foods` | Public | Search/filter/paginated menu |
| GET | `/menu/:id`, `/foods/:id` | Public | Menu details |
| POST/PUT/DELETE | `/menu`, `/menu/:id` | Admin | Manage menu items |
| PATCH | `/menu/:id/availability` | Admin | Toggle availability |
| GET | `/cart` | Student | Read own cart with current prices and total |
| POST | `/cart/items` | Student | Add/increase quantity (1–20) |
| PUT/DELETE | `/cart/items/:menuItemId` | Student | Set quantity or remove item |
| DELETE | `/cart` | Student | Clear own cart |
| POST | `/orders` | Student | Place order using current database prices; requires a unique `Idempotency-Key` header |
| GET | `/orders/my` | Student | Own order history |
| GET | `/orders` | Admin/Foodmaker | Filter orders by status, order number (`search`), customer (`customerSearch`), date (`startDate`, `endDate`), and pagination (`page`, `limit`) |
| GET | `/orders/:id` | Owner/Admin/Foodmaker | Read order subject to ownership |
| PATCH | `/orders/:id/status` | Admin/Foodmaker | Progress a valid order status |
| PATCH | `/orders/:id/cancel` | Owner/Admin | Cancel an eligible unpaid order |
| POST | `/payments/simulate` | Student | Record a simulated payment |
| GET | `/payments/my` | Student | Own payment history |
| GET | `/payments` | Admin | Read-only simulated payments; filter by reference, result, method, and date |
| GET/PATCH | `/notifications`, `/notifications/:id/read` | Authenticated | List and mark own notifications |
| PATCH | `/notifications/read-all` | Authenticated | Mark own notifications read |
| GET | `/reports/dashboard`, `/orders`, `/sales`, `/popular-foods`, `/payments` | Admin | Database-backed reports with date ranges and pagination |
| GET | `/activity-logs` | Admin | Filtered, paginated append-only activity history |
| GET | `/settings` | Admin | Safe effective configuration (no secrets) |
| GET | `/users`, `/users/:id` | Admin | Search, filter, paginate, and inspect safe user details |
| PATCH/DELETE | `/users/:id/status`, `/users/:id/role`, `/users/:id` | Admin | Protects the last active administrator; accounts with order/payment history cannot be deleted |
| GET | `/categories/admin`, `/foods/admin` | Admin | List all categories/menu items including inactive or unpublished |
| PATCH | `/categories/:id`, `/foods/:id` | Admin | Edit and activate/deactivate categories; edit/publish food items |

Menu listing supports `search`, `category`/`categoryId`, `availability`/`isAvailable`, `page`, and `limit`. `GET /api/foods/` aliases the public menu endpoint; cart quantity updates accept both `PATCH` and `PUT`. Reporting sales count only orders with successful simulated payments. Order placement requires an `Idempotency-Key` so network retries return the existing order rather than creating a duplicate; carts are cleared after the order record is persisted. Payment simulation creates a unique transaction reference and prevents a second payment record for the same order. The simulation accepts `simulatedResponse: "success"` or `"failure"`; both are demonstration outcomes only. No PIN, password, or OTP is accepted.

## Administrator module

Sign in at `/login` with an account whose server-side role is `admin`. Create the first administrator through the configured seed variables (`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`) and run `npm run seed` as described above. Student registration always forces the student role; the admin UI does not create administrator accounts. Administrator pages are nested under `/admin` and guarded by the React role gate. Every administrative API independently requires a valid JWT and `admin` role.

The admin sidebar provides database-backed dashboard analytics, user management, category management, food menu management, order management, payment monitoring, reports, activity logs, system settings, and logout. The dashboard sales figures include paid, non-cancelled order totals only; sales reports group by order creation date in UTC. Popular-food rankings use item quantity and saved order-item price snapshots across non-cancelled orders, including unpaid orders. Payment monitoring is read-only and all payments are simulations.

Safety rules: the backend prevents deactivation, demotion, or deletion of the final active administrator. Accounts with any order or payment history cannot be deleted; deactivate them instead to preserve transaction references. Category deletion is blocked while any food references that category. Deactivating a category removes it from public category/menu browsing without rewriting the food records. Food image upload validates content type/signature and is limited to 5 MB. The settings endpoint returns only safe runtime, currency, payment-simulation, image, and order-status metadata; JWT secrets and database credentials stay server-side.

### Admin API checks (PowerShell)

First sign in and copy the JWT from the login response. Then use the token to exercise admin-only endpoints:

```powershell
$token = "<admin-jwt>"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/reports/dashboard" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/users?search=student&role=student&page=1&limit=20" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/orders?status=pending&startDate=2026-10-01&endDate=2026-10-31" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/payments?status=successful&method=telebirr&page=1" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/activity-logs?entity=Order&page=1&limit=20" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/settings" -Headers $headers
```

Use the client forms to create/update categories and food; direct write requests are validated and role-protected by the API. Confirm that a non-admin JWT receives `403` for `/api/users`, `/api/reports/dashboard`, `/api/payments`, `/api/activity-logs`, and `/api/settings`. No real payment data or credentials are accepted.

### Admin feature verification

1. Seed the database and sign in with the configured admin account. Confirm the dashboard values match the database, including empty-state behavior on an empty database.
2. Search/filter users, inspect a user, change roles and activation status. Verify attempts to remove or deactivate/demote the last active admin are rejected, and accounts with order/payment history can only be deactivated.
3. Create and edit a category; deactivate and reactivate it; verify inactive categories and their items are hidden from public student browsing. Verify deletion fails when menu items refer to the category.
4. Create/edit food with either a URL or uploaded image. Toggle availability and publication separately and verify unpublished items are absent from the student menu. Delete an item and confirm historical order item names/prices remain unchanged.
5. Filter orders by number, customer, status and dates; inspect the detail/status timeline; test valid and invalid transitions and verify student notifications are generated by valid changes.
6. Filter payment simulations by reference, method, status, and dates. Verify records are read-only and visibly labeled simulated.
7. Run each report for populated and empty date ranges. Compare successful-sales totals with paid orders; review popular foods and customer filters.
8. Search/filter/paginate activity logs and verify they include admin changes and remain read-only. Open Settings and confirm no server secrets are returned.

## Student-module manual verification

With MongoDB, the API, and the client running:

1. Register a student, verify the dashboard opens, then test login/logout.
2. Browse food and categories, search by name, inspect a detail page, and confirm unavailable meals cannot be added.
3. Add an item, increase/decrease quantity, remove it, and verify server-calculated totals.
4. Checkout with self-pickup and campus location selection. Verify the order confirmation displays the order number and server-calculated amount.
5. Simulate successful and failed payments on separate orders. Confirm each receipt reference persists in Payment History. Never enter real financial credentials.
6. Sign in as a foodmaker and progress a paid order through kitchen stages. Return as the student and check the tracking timeline and notifications.
7. Verify student authorization by requesting an admin endpoint with a student JWT and confirm one student cannot read another student's records.

PowerShell cart check (replace the token with a student JWT):

```powershell
$token = "<student-jwt>"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/cart" -Headers $headers
```

## Food Maker (kitchen) manual verification

Sign in with the configured foodmaker seed account, or an account assigned the `foodmaker` role by an administrator. The role is enforced by the API as well as the React route guard; foodmakers cannot open student or admin dashboards. Kitchen navigation includes Dashboard Overview, Incoming Orders, Pending Orders, Preparing Orders, Ready for Pickup, Completed Orders, Notifications, My Profile, and Logout.

1. Place a student order. It appears in Incoming Orders and creates a notification for active foodmaker accounts. Kitchen order lists and the overview poll the API every 15 seconds; this is polling, not push-based real-time delivery.
2. For an unpaid order, verify the kitchen displays its payment status and does not allow acceptance. Simulate a successful payment while signed in as the student; refresh/poll the kitchen view and accept the now-paid pending order.
3. Advance the order in sequence: **Pending → Confirmed → Preparing → Ready → Completed**. `Completed` is stored as `served` by the shared API. Each transition is validated server-side, recorded in `statusHistory`, and creates a student notification. Student tracking views poll every 15 seconds and display updated status without a manual refresh.
4. Open order details to review order number, student name, item names and quantities, notes, pickup/delivery location, payment status, and status history. Kitchen responses do not expose student email or payment mutation controls.
5. Search by order number and filter by status or date. Try a reversed date range and verify the API reports a validation error. Verify the notification list and mark a notification read.
6. Verify a student or administrator JWT cannot access `/api/orders` as a kitchen user, and verify a foodmaker cannot call student-only payment simulation or administrator APIs. Logout clears the client session token.

PowerShell API smoke checks (sign in through the client or call `/api/auth/login` with the configured foodmaker credentials, then substitute the returned JWT):

```powershell
$token = "<foodmaker-jwt>"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/orders?status=pending&search=SC-&page=1&limit=20" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/notifications" -Headers $headers
```

To advance an eligible paid order, use its order `_id` and only the next valid state:

```powershell
$orderId = "<order-id>"
$body = @{ status = "confirmed"; note = "Accepted by kitchen staff" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/orders/$orderId/status" -Headers $headers -ContentType "application/json" -Body $body
```

Menu image create/update accepts either an `imageUrl` or `multipart/form-data` field `image`. Uploads allow JPEG/PNG/GIF/WebP, verify the file signature, and cap size at 5 MB. Files are stored in `server/uploads` and served under `/uploads`.

Campus delivery captures a location string only. Physical delivery operations are outside this application.

## Testing and builds

Backend order-rule tests use Node's built-in test runner:

```powershell
Set-Location .\server
npm test
```

Build the client:

```powershell
Set-Location .\client
npm run build
```

Test against a dedicated database before running integration tests or seeding shared data. Automated integration and browser tests are not yet included.

## Deployment

### MongoDB Atlas

Create a database user with only the required database permissions, configure network access narrowly, and set the URI as a private backend environment variable.

### Render API

Create a Node web service with root directory `server`, build command `npm install`, and start command `npm start` (or use the supplied `render.yaml`). Configure `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `NODE_ENV=production`, and private seed variables in Render's environment settings. Run `npm run seed` manually once if demo accounts/data are required. Confirm the deployed `/api/health` endpoint.

### Netlify client

Create a site with base directory `client`, build command `npm run build`, and publish directory `dist`. Set `VITE_API_URL` to the deployed backend's `/api` URL. `client/netlify.toml` provides the SPA fallback. Set the API's `CLIENT_URL` to the deployed site's origin.

### GitHub

From the project root:

```powershell
git init
git add .
git commit -m "Build smart cafeteria ordering MVP"
git branch -M main
git remote add origin <your-private-or-public-repository-url>
git push -u origin main
```

The root `.gitignore` excludes dependencies, `.env` files, uploaded images, and build output. Review `git status` before committing to ensure no credentials are staged.

## Known implementation boundaries

This is a functional MVP foundation, not every page in the broader proposal. The React client includes menu browsing, auth, cart/checkout, payment simulation and history, student orders/profile/notifications, a kitchen dashboard with order detail and status history, and an admin dashboard with charts, category/menu/user/order/payment management, activity logs, reports, and safe system settings. Automated database integration/browser tests, physical delivery operations, and push-based real-time updates remain outside the current implementation. API-side authorization is enforced for protected functionality.
