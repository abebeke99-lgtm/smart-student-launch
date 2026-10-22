# Smart Cafeteria Ordering System — QA Test Report

**Execution date:** 2026-10-22  
**Scope:** Student, Food Maker, Admin, integration, security, database, API, frontend, automated tests, and deployment  
**Evidence rule:** PASS means the check ran and met its expected result. BLOCKED means the required environment or data was unavailable. NOT TESTED means the check was not executed.

**Continuation check:** 2026-10-22. Re-inspected the current `server/.env` without recording its values, attempted Mongoose connectivity and normal backend startup, and reran server tests and the client build.

## 1. Application structure and technology inspection

The workspace contains a React/Vite client and a Node.js/Express server using Mongoose models. The existing React client was retained, as allowed by the QA prompt. Server routes include authentication, categories, menu/foods, cart, orders, payments, notifications, reports, activity logs, users, and settings. Automated tests use Node's built-in test runner.

The database-backed server startup path requires MongoDB. The local smoke API was started from the Express app directly, without the database startup module, to check health and unauthenticated request handling only.

## 2. Requirements baseline

The referenced internship proposal PDF was not present in the workspace, so PDF-specific requirements could not be independently extracted or verified. The supplied **Complete Software Testing Prompt** was used as the available requirements baseline. This report does not claim that the PDF itself was reviewed.

## 3. Requirements traceability matrix and detailed role results

The requirement IDs below follow the supplied test prompt. Every case is accounted for in the summary metrics in section 13.

### Student

| Test ID | Feature / requirement | Expected result | Actual result | Status | Defect |
|---|---|---|---|---|---|
| S01 | Registration | Valid student is persisted with a hashed password; invalid/duplicate input is rejected. | Registration page was reached, and the API rejected an empty JSON body with HTTP 400. No database was available to verify account creation, hashing, or duplicate-email behavior. | BLOCKED | — |
| S02 | Login | Valid credentials authenticate; invalid credentials fail; protected pages require authentication. | Login page rendered and `/admin` redirected to login. Valid/invalid credential flows were not run because the database was unavailable. | BLOCKED | — |
| S03 | Browse menu | Food is loaded from the API; availability and empty states display correctly. | No MongoDB-backed menu response could be produced. | BLOCKED | — |
| S04 | Search food | Matching and nonmatching searches return appropriate results. | No menu data/API-backed search was available. | BLOCKED | — |
| S05 | Food details | Correct item details render; invalid IDs are handled. | Not exercised against persisted menu data. | BLOCKED | — |
| S06 | Add items to cart | Cart contains selected items and server-calculated subtotal. | Authenticated cart workflow requires MongoDB and a student account. | BLOCKED | — |
| S07 | Update/remove cart items | Quantities and totals update; invalid values are rejected. | Authenticated cart workflow requires MongoDB and a student account. | BLOCKED | — |
| S08 | Place an order | Server validates availability and quantities, calculates authoritative prices, persists and returns an order. | Database-backed order creation and tampered-price scenarios were not run. Relevant unit tests for server-side subtotals and quantities passed; see AUT-02/AUT-03. | BLOCKED | — |
| S09 | Simulated payment | A clearly simulated transaction is persisted and reflected on the order. | No database-backed order or payment records were available. | BLOCKED | — |
| S10 | Notifications | Correct student receives private order/payment notifications; read state works. | No authenticated student or persisted event was available. | BLOCKED | — |
| S11 | Order tracking | Student sees persisted status changes and the implemented refresh behavior. | No database-backed order lifecycle was available. | BLOCKED | — |
| S12 | Order history | Student sees only their own persisted orders and accurate snapshots. | No persisted orders or separate student accounts were available. | BLOCKED | — |
| S13 | Logout | Session is cleared and subsequent protected access is rejected. | A full authenticated logout/session invalidation test was not possible without a working login. | BLOCKED | — |

### Food Maker

| Test ID | Feature / requirement | Expected result | Actual result | Status | Defect |
|---|---|---|---|---|---|
| F01 | Food Maker login | Authorized Food Maker reaches kitchen dashboard; other roles do not gain access. | No database-backed credentials were available. | BLOCKED | — |
| F02 | Incoming orders | Newly placed Student orders appear without duplication using the implemented refresh mechanism. | Requires database-backed Student order creation and Food Maker access. | BLOCKED | — |
| F03 | Order details | Correct order number, items, quantities, and relevant details display. | No persisted orders were available. | BLOCKED | — |
| F04 | Status update | Authorized workflow transitions persist and appear in Student tracking. | No authenticated Food Maker or persisted order was available. Transition-rule unit tests passed (AUT-01). | BLOCKED | — |
| F05 | Mark Ready | Eligible order becomes Ready and the Student receives the configured notification. | No persisted order or student was available. | BLOCKED | — |
| F06 | Preparation workflow | Pending, active, completed, and cancelled orders display consistently. | No persisted orders were available. | BLOCKED | — |
| F07 | Order filters | Status, order number, and date filters return correct authorized results. | No database-backed filter dataset was available. | BLOCKED | — |
| F08 | Food Maker authorization | Food Maker is denied Admin-only user, role, and payment operations by the backend. | No valid Food Maker JWT/database account was available to exercise role-level authorization. | BLOCKED | — |

### Admin

| Test ID | Feature / requirement | Expected result | Actual result | Status | Defect |
|---|---|---|---|---|---|
| A01 | Admin login | Valid Admin can log in and access Admin pages; other roles cannot. | Database-backed authentication was unavailable. | BLOCKED | — |
| A02 | Dashboard statistics | Displayed counts and sales match database records, including empty-database behavior. | No database was available for comparison. | BLOCKED | — |
| A03 | User management | Search, details, status, role, and permitted deletion work without exposing password hashes or removing the final active Admin. | No authenticated Admin or persisted users were available. | BLOCKED | — |
| A04 | Menu management | Create, read, update, availability, image, validation, and deletion behavior work. | No database-backed Admin actions were available. | BLOCKED | — |
| A05 | Category management | CRUD works, duplicates are rejected, and categories with dependent food are protected. | No database-backed Admin actions were available. | BLOCKED | — |
| A06 | Order management | Search/filter/details/history work and status changes follow the permitted workflow. | No persisted orders or Admin account were available. | BLOCKED | — |
| A07 | Payment monitoring | Simulated records, statuses, methods, and references match persisted records. | No persisted payment records were available. | BLOCKED | — |
| A08 | Daily order report | Daily totals/statuses match persisted orders for the selected date. | No persisted orders were available. | BLOCKED | — |
| A09 | Sales report | Daily, weekly, and monthly figures follow documented criteria and exclude ineligible payments as designed. | No database records were available for comparison. | BLOCKED | — |
| A10 | Popular food report | Ranking derives from actual recorded order items. | No persisted order items were available. | BLOCKED | — |
| A11 | Customer order report | Customer order details and status match persisted records. | No persisted orders were available. | BLOCKED | — |
| A12 | Payment report | Payment counts and amounts match applicable persisted transactions. | No persisted payment records were available. | BLOCKED | — |
| A13 | System settings | Supported settings save correctly without exposing secrets. | No database-backed setting change was attempted. | BLOCKED | — |
| A14 | Admin authorization | Student and Food Maker requests to Admin-only APIs are denied without side effects. | Anonymous access was tested and rejected; authenticated wrong-role access requires test accounts/database and remains unverified. | BLOCKED | — |

## 4. Test plan and environment

Testing used the existing project, its built-in Node tests, local HTTP requests, and browser smoke checks. No production data was accessed or modified.

| Dependency | Observed state | Testing impact |
|---|---|---|
| `server\.env` | Present and contains MongoDB/JWT configuration keys. Values are intentionally omitted from this report. | The configured MongoDB SRV hostname does not resolve; backend startup fails before opening its API port. |
| Local MongoDB | `127.0.0.1:27017` was not reachable. | Registration, authenticated workflows, persistence, reports, and database integrations are blocked. |
| MongoDB Atlas | A URI is configured, but its SRV hostname fails DNS lookup (`ENOTFOUND`). | A successful Atlas connection was not established. Replace the hostname using the exact Atlas **Connect → Drivers** URI; do not guess the cluster hostname. |
| Proposal PDF | Not present in the workspace. | The attached QA prompt is the requirements baseline. |
| Git repository | Workspace is not a Git repository. | Commit history and tracked-secret scanning could not be verified. |
| Client browser server | Local Vite page loaded. | UI smoke checks were possible; authenticated pages still require backend data. |
| API smoke server | Express app was run without the database startup module. | Health, request validation, and pre-database authorization checks could be tested only. |

## 5. Student test cases

See S01–S13 in section 3. No end-to-end Student workflow could be completed without MongoDB and configured credentials. Registration page navigation and the unauthenticated API validation check are reported separately below; they do not establish successful registration or login.

## 6. Food Maker test cases

See F01–F08 in section 3. Food Maker login, order polling, order state changes, notifications, and backend role enforcement with an authenticated Food Maker were not verified.

## 7. Admin test cases

See A01–A14 in section 3. Admin dashboards, CRUD operations, analytics, settings persistence, and authenticated role restrictions were not verified against MongoDB records.

## 8. Cross-role integration tests

| Test ID | Integration scenario | Expected result | Actual result | Status | Defect |
|---|---|---|---|---|---|
| I01 | Complete Student → payment → kitchen → Student → Admin lifecycle | Shared records, statuses, notifications, and reports remain consistent. | Requires MongoDB and separate role accounts, which were unavailable. | BLOCKED | — |
| I02 | Admin disables food; Student cannot order it | Menu shows unavailable state and backend rejects ordering. | The ordering rule is covered by unit tests, but the cross-role/database workflow was not run. | BLOCKED | D-01 |
| I03 | Kitchen status change creates Student notification | Persisted status and notification match. | Requires authenticated roles and persisted records. | BLOCKED | — |
| I04 | Price consistency and tampering | Backend uses authoritative current prices and stores price snapshots. | Subtotal helper tests passed; full API/database tampering scenario was not run. | BLOCKED | — |
| I05 | Persistence across server restart | Saved order remains available after restart. | MongoDB was unavailable, so no record could be created or inspected. | BLOCKED | — |

## 9. Security test cases

| Test ID | Security requirement | Expected result | Actual result | Status |
|---|---|---|---|---|
| SEC-01 | Password hashing | Password is stored as a bcrypt hash, never plaintext. | No account could be persisted or inspected. | BLOCKED |
| SEC-02 | Invalid login | Invalid credentials are rejected. | Database-backed login was unavailable. | BLOCKED |
| SEC-03 | Missing/invalid JWT | Protected API returns an authentication error. | Missing and malformed JWT requests returned HTTP 401 when the smoke process was given a valid test-only JWT secret. | PASS |
| SEC-04 | Student order ownership | Student cannot read another student's orders. | Requires two persisted Student accounts and valid JWTs. | BLOCKED |
| SEC-05 | Student payment ownership | Student cannot read another student's payments. | Requires two persisted Student accounts and valid JWTs. | BLOCKED |
| SEC-06 | Student notification ownership | Student cannot read another student's notifications. | Requires two persisted Student accounts and valid JWTs. | BLOCKED |
| SEC-07 | Food Maker Admin restrictions | Food Maker cannot perform Admin-only operations. | Requires a persisted Food Maker and authenticated role tests. | BLOCKED |
| SEC-08 | Student role escalation | Student cannot assign themselves Admin. | Requires authenticated API/database test. | BLOCKED |
| SEC-09 | Malformed data and IDs | Invalid values/identifiers fail safely. | Only missing registration fields were tested; malformed IDs were not exercised. | BLOCKED |
| SEC-10 | Backend input validation | Invalid registration body is rejected with structured validation errors. | Empty registration JSON returned HTTP 400 with field details. | PASS |
| SEC-11 | Secret/credential exposure | Secrets are not committed or exposed. | `.env` is present and `.gitignore` excludes `.env`, but the workspace is not a Git repository, so tracked status/history could not be checked. Secret values are omitted here. Rotate any real credentials that may have been exposed during local configuration inspection. | BLOCKED |
| SEC-12 | Production error sanitization | Responses do not reveal stack traces/secrets. | Tested 400/401 JSON responses did not include stack traces; full production/error-path coverage was not executed. | BLOCKED |
| SEC-13 | Payment record integrity | Unauthorized callers cannot alter simulated payment records. | Requires persisted payments and authenticated role tests. | BLOCKED |

## 10. Database and API test cases

### Database

| Test ID | Database check | Expected result | Actual result | Status |
|---|---|---|---|---|
| DB-01 | Required fields | Stored documents satisfy model requirements. | No MongoDB connection. | BLOCKED |
| DB-02 | Field types and schema validation | Invalid data is rejected by Mongoose. | No database-backed writes. | BLOCKED |
| DB-03 | References and unique indexes | Relations and uniqueness constraints are enforced. | No database connection/index inspection. | BLOCKED |
| DB-04 | User/order ownership links | Documents reference the correct owner/order. | No persisted records. | BLOCKED |
| DB-05 | Order item quantities | Stored items contain valid quantities. | No persisted orders. | BLOCKED |
| DB-06 | Order totals and price snapshots | Totals derive from current server prices and snapshots remain consistent. | Unit calculation tests passed; database writes were not tested. | BLOCKED |
| DB-07 | Payment status and references | Payment fields and order association persist correctly. | No persisted payments. | BLOCKED |
| DB-08 | Order status and history | Status and history entries persist consistently. | No persisted orders. | BLOCKED |
| DB-09 | Notification ownership | Notifications belong to the intended user/order. | No persisted notifications. | BLOCKED |
| DB-10 | Persistence after restart | Records remain available after restart. | No database available. | BLOCKED |
| DB-11 | Invalid data handling | Database rejects invalid documents safely. | No database writes could be attempted. | BLOCKED |

### API

| Test ID | API check | Expected result | Actual result | Status |
|---|---|---|---|---|
| API-01 | `GET /api/health` | HTTP 200 health response. | Returned HTTP 200. | PASS |
| API-02 | Missing authentication on protected endpoints | Consistent JSON HTTP 401 before database access. | `/api/auth/me`, `/api/orders`, `/api/notifications`, `/api/users`, `/api/payments`, `/api/activity-logs`, and `/api/reports` were observed returning HTTP 401. | PASS |
| API-03 | Invalid JWT with correctly configured test secret | HTTP 401; token details are not disclosed. | Invalid token returned HTTP 401 with the standard authentication error. | PASS |
| API-04 | Empty registration request | HTTP 400 with field validation details. | Returned HTTP 400 and validation details for name, email, and password. | PASS |
| API-05 | Valid authentication flows | Valid Student/Food Maker/Admin credentials reach the correct role. | Database and credentials unavailable. | BLOCKED |
| API-06 | Role restrictions | Wrong authenticated role gets HTTP 403 with no side effects. | Requires valid role accounts and database. | BLOCKED |
| API-07 | CRUD methods, filters, and malformed identifiers | Implemented methods/filters validate and return expected results. | Database-backed API cases were not run. | BLOCKED |
| API-08 | Ownership checks and database side effects | Private data is isolated and writes persist only for authorized users. | Requires database and test accounts. | BLOCKED |
| API-09 | Reports | Aggregates match stored records. | No database records. | BLOCKED |
| API-10 | Additional validation/error paths | Invalid request shapes are handled consistently across APIs. | Only registration validation was exercised. | BLOCKED |

## 11. Frontend usability tests

| Test ID | UI check | Expected result | Actual result | Status |
|---|---|---|---|---|
| FE-01 | Navigation | Public login/registration navigation opens the corresponding page. | Login and registration pages rendered; the registration link navigated to `/register`. | PASS |
| FE-02 | Login/registration validation | Invalid form input is explained and not submitted. | Forms rendered, but frontend validation behavior was not submitted/tested. | NOT TESTED |
| FE-03 | Search | Search returns matches and empty states. | No usable backend menu data. | NOT TESTED |
| FE-04 | Cart controls | Add, quantity, remove, and clear actions work. | Not exercised with an authenticated student. | NOT TESTED |
| FE-05 | Checkout | Checkout shows correct items/totals and submits safely. | No persisted cart/order. | NOT TESTED |
| FE-06 | Dashboard tables | Tables display accurate role-specific records. | No role data was available. | NOT TESTED |
| FE-07 | Buttons/actions | Buttons perform their advertised backend actions. | Database-backed actions were not exercised. | NOT TESTED |
| FE-08 | Loading indicators | Loading state appears during async requests. | Not measured. | NOT TESTED |
| FE-09 | Success/error messages | Messages are clear and accurately reflect API outcomes. | API JSON errors were checked; UI message rendering was not. | NOT TESTED |
| FE-10 | Empty states | Empty lists render useful states without crashing. | Not tested with backend responses. | NOT TESTED |
| FE-11 | Protected-page behavior | Unauthenticated users cannot view protected Admin pages. | Direct `/admin` visit redirected to `/login`. | PASS |
| FE-12 | Responsive layout | Desktop/tablet/mobile layouts remain usable. | A mobile viewport was set, but layout dimensions/interaction were not systematically verified. | NOT TESTED |
| FE-13 | Browser console/network failure | Network failures are surfaced without crashing; console errors are investigated. | No complete console/network-failure audit was performed. | NOT TESTED |

## 12. Automated test implementation

The project has server tests using Node's built-in `node:test` runner. No client test script or discovered VS Code test controller was available. The menu eligibility regression tests were added to the existing server suite:

- `server/test/menuRules.test.js`
- `server/src/utils/menuRules.js`
- Relevant ordering checks in `server/src/controllers/cartController.js` and `server/src/controllers/orderController.js`

The five automated test cases below correspond to the five tests actually run. Database-backed tests for authentication, CRUD, payment, notification, reporting, and ownership remain unavailable.

| Test ID | Automated test | Expected result | Actual result | Status |
|---|---|---|---|---|
| AUT-01 | Order status progression allows only adjacent workflow transitions. | Valid transitions pass; skipped transitions fail. | Test passed. | PASS |
| AUT-02 | Order subtotal uses server-side item prices. | Client values cannot determine subtotal. | Test passed. | PASS |
| AUT-03 | Empty orders and invalid quantities are rejected by subtotal rules. | Invalid order inputs fail validation. | Test passed. | PASS |
| AUT-04 | Orderable menu item must be available, published, and in an active category. | Any explicitly unavailable condition blocks ordering. | Test passed. | PASS |
| AUT-05 | Legacy menu records without explicit publication/category flags remain orderable. | Existing legacy records remain compatible. | Test passed. | PASS |

## 13. Actual execution results

### Summary metrics

| Metric | Result |
|---|---:|
| Total test cases | 100 |
| Passed | 14 |
| Failed | 2 |
| Blocked | 73 |
| Not tested | 11 |
| Not applicable | 0 |
| Confirmed critical defects | 0 |

The 14 passes are SEC-03, SEC-10, API-01–API-04, FE-01, FE-11, and AUT-01–AUT-05. The 2 failures are DEP-02 and DEP-03: configured backend startup and MongoDB Atlas connectivity. The 73 blocked cases are S01–S13, F01–F08, A01–A14, I01–I05, SEC-01/02/04–09/11–13, DB-01–DB-11, API-05–API-10, and DEP-04–DEP-08. The 11 not-tested cases are FE-02–FE-10, FE-12, and FE-13.

### Commands and observed results

- `Set-Location .\server; npm test` — **5 passed, 0 failed**.
- Current MongoDB URI shape check — scheme, host, and database path are present; no URI value was printed.
- Current Mongoose connection attempt — **failed**, `ENOTFOUND` during DNS SRV lookup.
- Current `node server.js` startup — **failed** at MongoDB DNS resolution; backend did not start listening.
- Current frontend/backend listener check — no service was listening on ports 5000, 5173, or 27017 at the time checked.
- Server JavaScript parse checks — **47 files checked successfully** with `node --check`.
- Current `Set-Location .\client; npm run build` — **passed**, Vite production build completed.
- Client `npm audit` — **0 vulnerabilities**.
- Server `npm audit` after the dev-watcher change — **0 vulnerabilities**.
- Local Express smoke checks — health returned HTTP 200; unauthenticated protected routes returned HTTP 401; empty registration request returned HTTP 400.
- Controlled invalid JWT check with a test-only JWT secret — returned HTTP 401.
- Browser smoke checks — login and registration pages rendered; registration navigation worked; direct `/admin` access redirected to `/login`.
- VS Code test discovery — unavailable (no registered test controllers); the configured `npm test` command was used instead.

An initial invalid-token request against the unconfigured smoke process returned HTTP 500 because `JWT_SECRET` was absent. This was an environment-configuration error, not a token-validation regression: repeating the check with a temporary test-only secret returned HTTP 401. No secret was saved to a file.

## 14. Defect reports

### D-01 — Ordering checks did not enforce menu publication/category activation

- **Related requirements:** S06–S08, I02; menu availability and publication rules.
- **Affected role:** Student; Admin menu state is the prerequisite.
- **Severity:** Medium.
- **Preconditions:** A caller knows an item ID where `isAvailable` is true but the item is unpublished or its category is inactive.
- **Reproduction evidence:** Code inspection found cart/order eligibility checked availability but did not consistently enforce publication and category activation. A database-backed HTTP reproduction was unavailable.
- **Expected:** The cart/order APIs reject items that are unavailable, unpublished, or in an inactive category.
- **Actual before fix:** The eligibility checks could admit such a known item ID.
- **Likely cause:** Cart and order paths did not share a complete menu-orderability rule.
- **Fix:** Added a shared `isMenuItemOrderable` rule, populated publication/category state in the cart path, and constrained order lookup to orderable items.
- **Retest:** AUT-04 and AUT-05 passed; full database-backed retest remains blocked.

### D-02 — Vulnerable development watcher dependency chain

- **Related requirement:** Secure dependencies and reliable local execution.
- **Affected role:** Developers/operators.
- **Severity:** High (reported advisory severity; development-only dependency chain).
- **Evidence:** `npm audit` reported high advisories through nodemon → chokidar → braces.
- **Expected:** The development dependency tree has no known reported vulnerabilities.
- **Actual before fix:** The audit found three high advisories.
- **Likely cause:** The nodemon dependency chain resolved vulnerable transitive watcher packages; the available `braces` version had no clean patched resolution.
- **Fix:** Removed nodemon and changed the development script to Node's built-in `--watch` mode, compatible with the project's Node 20+ runtime requirement.
- **Retest:** Server audit now reports **0 vulnerabilities**. `server/package-lock.json` was updated.

### D-03 — Configured MongoDB Atlas hostname does not resolve

- **Related requirements:** DB-01–DB-11, API-05–API-10, DEP-02–DEP-03, and all persisted Student/Food Maker/Admin workflows.
- **Affected roles:** Student, Food Maker, Admin, and operator.
- **Severity:** High; the backend cannot start, so database-dependent functionality is unavailable.
- **Preconditions:** `server/.env` contains a MongoDB URI.
- **Reproduction:** Run `Set-Location .\server; node server.js`, or call `mongoose.connect` using the configured URI.
- **Expected:** The Atlas SRV record resolves, Mongoose connects, and the API starts on port 5000.
- **Actual:** DNS SRV lookup returns `ENOTFOUND`; backend startup exits before opening the API port. The report deliberately omits the configured hostname and all credentials.
- **Likely cause:** The hostname in `MONGODB_URI` is not a resolvable Atlas cluster hostname (for example, a placeholder, typo, or stale cluster hostname). This is a DNS/host configuration failure; Atlas IP allowlisting should also be checked after the hostname is corrected.
- **Recommended fix:** Copy the current URI from MongoDB Atlas **Connect → Drivers**, use the exact host, URL-encode reserved characters in the database username/password, and ensure the database user and Atlas Network Access IP allowlist are valid.
- **Retest:** Not yet possible without a valid, resolvable URI. Mongoose must report connected and the API health endpoint must respond before database workflows can be retested.

No other application-code defect was confirmed in this continuation. Unverified behavior remains BLOCKED or NOT TESTED rather than reported as a defect.

## 15. Fixes applied

1. Added the shared menu-orderability guard and applied it consistently to cart additions/updates and order creation.
2. Added focused regression tests for unavailable, unpublished, inactive-category, and legacy menu records.
3. Removed the vulnerable nodemon dependency chain and switched the `dev` script to `node --watch`.

No database data was changed. The QA prompt attachment was not edited.

## 16. Retesting and regression results

- Menu-rule regression tests: **PASS** (AUT-04 and AUT-05).
- Existing order workflow and subtotal tests: **PASS** (AUT-01–AUT-03).
- Combined server suite: **5/5 passed**.
- Server syntax checks: **47/47 passed**.
- Server dependency audit: **0 vulnerabilities** after removing nodemon.
- Client production build and audit: **PASS**, **0 vulnerabilities**.
- Current Mongoose/database retest: **FAIL**, configured Atlas SRV hostname is not resolvable (`ENOTFOUND`).
- Full cart/order retest against MongoDB: **BLOCKED** until the MongoDB URI is corrected and the database connection succeeds.

## 17. Deployment verification

| Test ID | Deployment check | Expected result | Actual result | Status |
|---|---|---|---|---|
| DEP-01 | Frontend production build | Client bundle builds. | Vite build completed successfully. | PASS |
| DEP-02 | Normal backend startup | Backend starts with valid configuration and connects to MongoDB. | `node server.js` attempted startup and failed before listening because the configured Atlas SRV hostname returned `ENOTFOUND`. | FAIL |
| DEP-03 | MongoDB Atlas connectivity | Server connects to the configured Atlas database. | Mongoose attempted the configured URI but DNS SRV lookup failed with `ENOTFOUND`. No URI or credential values are reproduced here. | FAIL |
| DEP-04 | Frontend-to-deployed API | Deployed client reaches deployed API. | No deployment URLs were supplied. | BLOCKED |
| DEP-05 | Deployment environment variables | Required variables are set securely. | No deployment environment access. | BLOCKED |
| DEP-06 | Deployment CORS | Intended deployed client origin is allowed. | No deployed origins/configuration to test. | BLOCKED |
| DEP-07 | Deployed authentication | JWT login/protected routes work in deployment. | No deployment or database credentials. | BLOCKED |
| DEP-08 | Deployed public/protected pages | Pages behave correctly against deployed services. | No deployment URLs were supplied. | BLOCKED |

### MongoDB configuration and safe PowerShell setup

The current blocker is **not a missing environment-variable name**: `MONGODB_URI` is present, but the configured Atlas hostname does not resolve. Retrieve the authoritative URI in Atlas (**Connect → Drivers**) and verify the cluster is active, the database user is valid, reserved password characters are percent-encoded, and the client IP is allowed in **Network Access**.

From the project root, this prompts for the URI as hidden input, replaces `MONGODB_URI`, rotates `JWT_SECRET`, and keeps `PORT`/`CLIENT_URL` aligned in the gitignored `server\.env`. The URI and generated JWT secret are not echoed to the terminal or written to this report. Rotating the JWT secret invalidates existing login tokens. `.env` remains plaintext on disk and must stay private:

```powershell
$envFile = Join-Path (Get-Location) 'server\.env'
$secureUri = Read-Host 'Paste the MongoDB Atlas connection URI from Connect > Drivers' -AsSecureString
$uriPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
try {
    $uri = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($uriPtr)
    $jwtSecret = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
    if (-not $jwtSecret) { throw 'Could not generate JWT_SECRET' }
    $lines = @(Get-Content -LiteralPath $envFile)
    $updates = @{
        MONGODB_URI = $uri
        JWT_SECRET = $jwtSecret
        PORT = '5000'
        CLIENT_URL = 'http://localhost:5173'
    }
    foreach ($key in $updates.Keys) {
        $found = $false
        $lines = @($lines | ForEach-Object {
            if ($_ -match "^$key=") {
                $found = $true
                "$key=$($updates[$key])"
            } else {
                $_
            }
        })
        if (-not $found) { $lines += "$key=$($updates[$key])" }
    }
    Set-Content -LiteralPath $envFile -Value $lines -Encoding UTF8
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($uriPtr)
    Remove-Variable uri, secureUri, jwtSecret, updates -ErrorAction SilentlyContinue
}
```

Then test the actual backend and database connection:

```powershell
Set-Location 'C:\Users\user.MKAU\Videos\smart student launch\server'
node server.js
```

Proceed only if the console reports a successful MongoDB connection and the API is listening on port 5000. In another PowerShell window:

```powershell
Invoke-RestMethod 'http://localhost:5000/api/health'
```

The client defaults to `http://localhost:5000/api`; serve it on the configured `CLIENT_URL` origin:

```powershell
Set-Location 'C:\Users\user.MKAU\Videos\smart student launch\client'
npm run dev -- --host localhost
```

Never paste the URI, passwords, JWT secret, or seed credentials into chat or a report. Rotate any real Atlas/database and seed-account credentials that may have been exposed during local configuration inspection before using a non-disposable database. Keep seed credentials private, and do not rerun the seed command against production without confirming its behavior.

## 18. Final acceptance report

### Successfully verified

- Server's existing order status and subtotal unit rules.
- New menu visibility/orderability rules and legacy compatibility.
- Client production build and zero-vulnerability client audit.
- Server JavaScript syntax and zero-vulnerability server audit after the watcher change.
- Earlier standalone health endpoint response, unauthenticated request rejection, malformed-registration validation, and invalid-token rejection with valid test configuration.
- Login/registration page rendering and unauthenticated redirect from `/admin`.

### Failed

- No executed test case remains failed after the fixes and retests.

### Blocked

- Student registration/login persistence, carts, order creation, payments, notifications, and tracking.
- Food Maker authenticated order management and state transitions.
- Admin CRUD, role changes, analytics, payment monitoring, and settings persistence.
- Cross-role order/payment/notification lifecycle and MongoDB persistence.
- Corrected MongoDB URI, backend startup, and database-backed workflows: currently FAIL/BLOCKED because the configured Atlas hostname does not resolve.
- Netlify/Render deployment checks.
- PDF-specific traceability because the proposal PDF was unavailable.

### Not tested

- Frontend validation interaction, search, cart/checkout UI, populated dashboard tables, UI success/error states, loading/empty states, responsive layout verification, and browser console/network failure audit.

### Acceptance decision

**Not yet accepted for a complete internship-project demonstration.** The code-level unit tests and frontend build passed, but the configured MongoDB connection currently fails DNS resolution and the backend cannot start. Correct the URI locally using the commands above; after the health check succeeds, rerun the blocked role workflows with non-production Student/Food Maker/Admin accounts against an isolated test database. Do not use production credentials or real payment accounts.
