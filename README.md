![ObsidianFlow Logo](./logo.png)
> **Production-grade Next.js 14 Boilerplate** with authentication, role-based access, admin panel, and a self-hosted setup wizard.

---

## Features

| Area | Details |
|---|---|
| **Auth** | RS256 JWT (15m access + 30d refresh), httpOnly cookies, bcrypt cost-12 passwords, atomic account lockout, timing-safe login, email verification |
| **Database** | MongoDB via Mongoose — AES-256-GCM field-level encryption, auto-soft-delete plugin, TTL-enforced audit logs, and dedicated login history collection |
| **Roles** | Fully configurable roles from wizard — per-role permissions stored in DB |
| **Admin Panel** | Standalone local dark-mode UI (port 3002) for User management, Feature Toggles, Auth config, and Live Activity Logging — DOM XSS-safe via HTML escaping |
| **Setup Wizard** | 7-step React wizard at `localhost:3001` — generates `project.config.ts` from your choices |
| **Security** | Redis-backed distributed rate limiting, spoof-proof IP resolver, AST endpoint registry guard, CSP headers, strict input sanitization (password-safe) |
| **Architecture** | Decoupled Zero-Trust Backend — local admin GUI holds no secrets; API verifies all JWTs & Permissions natively |
| **Anti-Debug** | Optional — DevTools detection, console poisoning, React DevTools hook poisoning |
| **Design System** | CSS variables (primary/accent/dark mode), theme injected at runtime from config |

---

## Quick Start

### 1 — Prerequisites

- Node.js ≥ 20
- A MongoDB connection string (local or Atlas)

### 2 — Install root dependencies

```bash
npm install
```

### 3 — First run (launches setup wizard)

```bash
node start.js
```

The wizard at `http://localhost:3001` guides you through:
1. Project metadata & branding
2. Auth settings (identifier, password rules, session limits)
3. Registration fields (enable firstName, username, phone, etc.)
4. Roles & default role
5. Theme (primary color, accent, dark mode, font)
6. Security settings (rate limits, lockout, anti-debug)
7. Review & initialise (seeds DB, writes `project.config.ts`, writes `.setup-done`)

After the wizard, the app automatically reloads at `http://localhost:3000`.

### 4 — Subsequent runs

```bash
node start.js        # detects .setup-done, starts next.js directly
# or
cd main-app && npm run dev
```

### 🌍 Running Multiple Projects Simultaneously (Port Collisions)
If you clone this repository twice to build two separate apps, running `node start.js` on both will trigger `EADDRINUSE` port clashes. The system uses 4 distinct ports. You can cleanly override **all of them** by adding these variables to your `main-app/.env.local`:

| Component | Default Port | Override Environment Variable |
|---|---|---|
| **Next.js Web App** | `3000` | `PORT=4000` |
| **Setup Wizard** | `3001` | `SETUP_PORT=4001` |
| **Admin Panel** | `3002` | `ADMIN_PORT=4002` |

*(Note: If you override the `PORT` variable, you need to launch Next.js manually using `npm run dev -- -p <PORT>` instead of `node start.js` to properly bind the web app socket!)*

---

## Environment Variables

Copy `.env.example` → `main-app/.env.local` and fill in values:

```bash
cp .env.example main-app/.env.local
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_PRIVATE_KEY` | ✅ | RS256 PEM private key (generate below) |
| `JWT_PUBLIC_KEY` | ✅ | RS256 PEM public key |
| `AES_ENCRYPTION_KEY` | ✅ | 32-byte key as 64-char hex or base64-44 |
| `NODE_ENV` | ⬜ | `development` (default) or `production` |
| `UPSTASH_REDIS_REST_URL` | ⬜ | Redis URL (Production distributed rate-limiting fallback) |
| `UPSTASH_REDIS_REST_TOKEN` | ⬜ | Redis Token |

**Generate RS256 key pair:**
```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Then paste the contents (with \n escaped) into .env.local
```

**Generate AES key:**
```bash
openssl rand -hex 32
```

---

## Project Structure

```
ObsidianFlow/
├── start.js                   # Entry point — setup vs app detection
├── package.json               # Root scripts
├── .env.example               # Template for .env.local
│
├── setup-server/              # Express setup server (port 3001)
│   ├── server.js
│   ├── api/                   # test-db, initialise (SSE)
│   ├── metrics/               # Local dev performance monitor (port 2999)
│   │   ├── cache-optimizer.js
│   │   └── ui/index.html
│   └── ui/                    # React wizard (built with esbuild)
│
├── main-app/                  # Next.js 14 application (port 3000)
│   ├── app/                   # App Router
│   │   ├── (auth)/            # Login, Register, Forgot/Reset Password
│   │   ├── (protected)/       # Auth-guarded routes (Profile)
│   │   └── api/               # API route handlers
│   │       ├── auth/          # register, login, logout, refresh, me, ...
│   │       ├── admin/         # stats, users, roles, config, audit
│   │       └── user/          # profile PATCH
│   ├── components/ui/         # AppNavbar, ThemeProvider, ErrorBoundary, Skeleton
│   ├── config/
│   │   └── project.config.ts  # ⚠️ Generated by wizard — do not edit manually
│   ├── lib/
│   │   ├── auth/              # jwt.ts, password.ts, context.tsx, providers/
│   │   ├── client/            # anti-debug.ts
│   │   ├── db/                # connect.ts, encryption.ts, plugins/
│   │   ├── middleware/        # withAuth, withRole, rateLimit, endpointGuard
│   │   ├── api/               # response.ts, schemas.ts
│   ├── models/                # user, session, role, system_config, audit_log, login_history
│   ├── middleware.ts           # Edge setupGuard, Admin CORS checks
│   └── next.config.mjs        # Security headers, no source maps, CSP
│
├── admin-app/                 # Local admin panel (port 3002)
│   ├── server.js              # Express static server
│   └── ui/index.html          # Admin SPA UI
│
└── scripts/                   # test-jwt.js, test-password.js
```

---

## Scripts

| Command | Description |
|---|---|
| `node start.js` | Bootstrapper: Starts Next.js + Admin Panel + Cache Sidecar automatically. |
| `npm run dev` | (Run inside `main-app/`) Starts ONLY the Next.js target server manually. |
| `node admin-app/server.js` | Starts ONLY the local admin panel on port 3002. |
| `npm run setup` | Starts just the setup wizard server manually. |
| `npm run build:wizard` | Rebuilds wizard UI bundle with esbuild |

---

## Auth Flow

```
Register → POST /api/auth/register
  → Zod validation (schema from projectConfig)
  → Duplicate check (email/username)
  → bcrypt hash (cost 12)
  → Create User + Session
  → Set __refresh httpOnly cookie
  → Return { accessToken (15m), user }

Login → POST /api/auth/login
  → loginWithEmail provider
  → Timing-safe dummy hash when user not found (prevent enumeration)
  → Atomic $inc lockout tracking (5 attempts → 15 min, race-condition-safe)
  → bcrypt verify
  → Max concurrent session enforcement
  → Create Session (tokenHash stored, not token)
  → Set __refresh httpOnly cookie
  → Return { accessToken (15m), user }

Token refresh → POST /api/auth/refresh
  → Read __refresh cookie
  → Verify RS256 signature
  → rotateRefreshToken (invalidate old session, create new)
  → Return new accessToken (15m), rotate cookie
```

## Administration Control

This boilerplate completely separates administrative control away from the Next.js `main-app` so zero admin code executes or leaks onto your production domain. To manage the system locally:

**Standalone Admin Panel (Port 3002)**
- Starts via `node admin-app/server.js` (or automatically via `node start.js`).
- Accessible via `http://localhost:3002`.
- Offers a fully featured dark-mode interface: Dashboard stats, realtime Activity Feed, Dynamic Endpoint Route toggling, User CRUD, and direct disk configuration editing for Auth Settings.
- Requires you to log in with an `admin` role account.

### ⚠️ Important: Modifying the Admin Panel
If you choose to update the standalone Admin Panel (`admin-app/ui/index.html`), follow these rules so you don't break the cross-application bridging:
1. **Preserve Next.js Core Routes:** The admin panel heavily relies on the `/api/admin/*` endpoints inside the `main-app` NextJS application. Do not delete or rename these backend routes unless you also update the frontend Javascript fetch calls!
2. **CORS Credentials:** The Admin Panel runs on port 3002 but fetches data from port 3000. All custom `fetch()` calls you write MUST use `credentials: 'include'` to pass the Next.js `HttpOnly` authentication cookies properly across origins.
3. **DOM IDs:** The JavaScript auto-binders rely on strict HTML ID attributes (like `id="user-tbody"`). If you redesign the UI tables, ensure the JavaScript functions at the bottom of the script still match your new layout IDs.

### ⚠️ Important: Start Script & Setup Core Warning
Do **NOT** randomly modify `start.js` or any files within the `setup-server/` directory! These scripts orchestrate crucial inter-process lifecycle bindings, hot-module-reloading cache streams, and the initial NextJS compilation telemetry. 
- Altering the `spawn()` pipelines inside `start.js` will likely orphan background zombie processes running on port 3000.
- Tampering with the setup-server logic may forcefully inject corrupted AST (Abstract Syntax Tree) nodes into `project.config.ts`, permanently bricking your React client build.

---

## Developer Guide: Continuing Your Web App

ObsidianFlow provides the heavy-lifting (user database, authentication, setup pipelines, and security foundation). Now you can build your actual application logic! Here is exactly where to put your code:

### 1. Adding New UI Pages (Frontend)
Next.js 14 uses the **App Router** paradigm where directories dictate your URL path, and files inside them define the UI. All frontend routes live inside `main-app/app/`.

**A. Public Pages**  
Add new folders directly inside `main-app/app/`.
- Creating `main-app/app/pricing/page.tsx` automatically maps to `http://localhost:3000/pricing`.
- All pages are **Server Components** by default. This means they cannot use React hooks (`useState`, `useEffect`, `onClick`).
- **Client Components:** If your page needs interactivity (like a button click or forms), you MUST add `"use client";` to the absolute top of your file.

**B. Protected Dashboard Pages**  
We've established a special folder called `(protected)`. Anything placed inside `main-app/app/(protected)/` is automatically guarded by the Next.js `middleware.ts`.
- If an unauthenticated user tries to visit `http://localhost:3000/dashboard`, they are instantly bounced to `/login`.
- Example: Create `main-app/app/(protected)/dashboard/page.tsx`.

### 2. Creating Custom API Endpoints (Backend)
If your frontend React client (or external mobile app) needs to securely talk to the database, you build REST handlers inside `main-app/app/api/`.

Next.js route schemas require you to export functions named after HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`).

**Secure Authenticated Endpoint Example (`main-app/app/api/posts/route.ts`):**
```typescript
import { withAuth } from '@/lib/middleware/withAuth';
import { NextResponse, NextRequest } from 'next/server';

// `withAuth` guarantees the request has a valid Session!
// If the user isn't logged in, it intercepts and returns a 401 instantly.
export const POST = withAuth(async (req: NextRequest) => {
    // req.user is guaranteed to exist and contains the decoded JWT (id, email, role)
    const { email, id } = req.user;
    
    // Parse the JSON payload securely
    const body = await req.json();

    // Do database logic here...
    return NextResponse.json({ 
        success: true, 
        message: `Task created by ${email}`,
        data: body 
    });
});
```

### 3. Creating MongoDB Models (Database Layer)
When you need to store custom data (like Posts, Products, Tasks), you don't need to write SQL. We use **Mongoose** object modeling.

1. Create a file in `main-app/models/` (e.g. `main-app/models/task.model.ts`).
2. Build your schema and ALWAYS import our `basePlugin` from `@/lib/db/plugins/basePlugin`.
3. The `basePlugin` automatically strips `__v` tags, converts `_id` to `id` for nice JSONs, and adds `isDeleted`/`createdAt` timestamps automatically!

```typescript
import mongoose from 'mongoose';
import { basePlugin } from '@/lib/db/plugins/basePlugin';

const TaskSchema = new mongoose.Schema({
    // Store relations using ObjectId
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    priority: { type: String, enum: ['low', 'high'], default: 'low' },
    completed: { type: Boolean, default: false }
});

// Attach the boilerplate schema transformer!
TaskSchema.plugin(basePlugin);

export const TaskModel = mongoose.models.Task || mongoose.model('Task', TaskSchema);
```

### 4. React Server Components (The Full-Stack Magic)
Because Next.js 14 supports **React Server Components**, you don't actually need to write API routes if you just want to read data and display it! You can securely run server-side database code *directly inside your React component* before it ships HTML to the user.

```tsx
import { connectDB } from '@/lib/db/connect';
import { TaskModel } from '@/models/task.model';

export default async function DashboardPage() {
    // 1. Establish the connection singleton instantly
    await connectDB();
    
    // 2. Fetch directly from mongo (we use .lean() to make it standard JSON)
    const tasks = await TaskModel.find({ completed: false }).lean();
    
    // 3. Render HTML cleanly on the server and ship it to the client!
    return (
        <div style={{ padding: '2rem' }}>
            <h1>Your To-Do List</h1>
            <p>Direct MongoDB Render. No APIs required!</p>
            <ul>
                {tasks.map(t => (
                    <li key={t._id}>{t.title} - {t.priority}</li>
                ))}
            </ul>
        </div>
    )
}
```

---

## Production Deployment

Deploying ObsidianFlow requires splitting the architecture: **The Web App goes live to the internet, but the Admin Panel strictly stays on your local machine.**

### 1. Deploying the Main Web App (Vercel / VPS)
1. Commit your project and push it to GitHub.
2. In your Vercel Dashboard (or VPS server), set the build directory to `main-app`.
3. The build command should automatically trigger `next build`.
4. **CRITICAL:** Copy the production `MONGODB_URI`, `JWT_SECRET`, and `AES_ENCRYPTION_KEY` variables from your local `.env.local` into your Vercel/VPS Environment Variables settings!

*(Note: Never deploy the root `/start.js` or the `/setup-server` folder to the internet. They are intended exclusively for local initialization.)*

### 2. Managing the Live Database via Local Admin Panel
When your application is live on the internet, you do **not** upload the admin panel. 
To manage your live users, run the admin panel locally on your own computer:
1. Open a terminal and run `node admin-app/server.js` on your computer.
2. Open `http://localhost:3002`.
3. On the login screen, change the **Main App URL** from `http://localhost:3000` to your live Vercel domain (e.g., `https://my-app.vercel.app`).
4. Log in using your admin credentials. The local UI will seamlessly route all commands (User Creation, CSV Data Imports, etc.) directly to your production NextJS backend over HTTPS!

---

## Peak Handling & Capacity Guide

This section explains how the stack performs under peak traffic and what to tune when scaling.

### Baseline Capacity (Single Node, Default Config)

| Layer | What limits it | Default |
|---|---|---|
| **Next.js server** | Node.js event loop / CPU | ~500 concurrent requests before queue forms |
| **MongoDB connection pool** | `maxPoolSize` in `connect.ts` | 10 connections (tune up for high traffic) |
| **Auth rate limiter** | 10 req / 15 min per IP (login endpoint) | Enforced via Upstash Redis in prod |
| **Admin rate limiter** | 5 req / 15 min per IP | Enforced via Upstash Redis in prod |
| **Access token TTL** | 15 minutes | Reduces revocation window; refresh is transparent |
| **CSV import batch** | 500 rows per commit | Streamed via `multipart/form-data`, no full-buffer allocation |

### Scaling the Database Pool

Open `main-app/lib/db/connect.ts` and increase `maxPoolSize`:

```typescript
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 50,          // increase from 10 for high concurrency
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});
```

For Atlas deployments, ensure your cluster tier supports the target pool size (M10 supports ~500 connections).

### Distributed Rate Limiting (Redis — Required for Multi-Instance)

The in-memory rate limiter is **per process**. If you run multiple Next.js instances (Vercel serverless, pm2 cluster, k8s replicas), each process has its own isolated counter. An attacker can bypass the limit by round-robining across instances.

**Fix:** Provide Upstash Redis credentials in `.env.local`. The `rateLimitStore.ts` automatically switches to the Redis backend when these are set:

```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...
```

With Redis, all instances share a single counter and the rate limiter is globally enforced.

### IP Spoofing Protection (Proxy-Aware)

The rate limiter reads `x-forwarded-for` from right to left, skipping private/loopback ranges, and returns the rightmost non-private IP (the last trusted proxy hop). This is set automatically:

- **Development:** falls back to `req.ip` / `127.0.0.1`
- **Production:** reads the rightmost public IP from `x-forwarded-for`

Ensure your reverse proxy (Nginx, Cloudflare, Vercel Edge) does **not** strip `x-forwarded-for`. Vercel and Cloudflare both preserve it correctly.

### Lockout Race Condition Protection

Failed login increments use atomic MongoDB `$inc` — even under thousands of concurrent login attempts, the counter is incremented exactly once per request at the database level. The lockout threshold cannot be bypassed.

### JWT Token Lifetime

Access tokens expire in **15 minutes** (configurable via `projectConfig.auth.jwt.expiryDefault`). The 30-day refresh token silently rotates and re-issues access tokens, so users never notice the short expiry under normal usage.

If you suspend a user account, the maximum window for that user to still make authenticated API calls is **15 minutes** at most.

### Bulk CSV Import

The dry-run endpoint streams the uploaded CSV via `Web ReadableStream` — no full file is held in memory. The commit endpoint parallelises bcrypt hashing via `Promise.all`. At cost-12 and 500 rows, expect ~60–90 seconds for a full batch import on commodity hardware.

| Batch Size | Approx. Time (cost 12) |
|---|---|
| 50 rows | ~6–9 s |
| 200 rows | ~24–36 s |
| 500 rows (max) | ~60–90 s |

---

## Troubleshooting & Known Issues

### 1. `ERESOLVE` Peer Dependency Error on Install
If you encounter this error when running `npm install`:
`npm ERR! ERESOLVE could not resolve... Conflicting peer dependency: react@19`
**Fix:** Because this boilerplate is securely configured for Next.js 14, it requires React 18.2.0. To bypass version strictness from other packages, use:
```bash
npm install --legacy-peer-deps
```

### 2. Mongoose Connection Timeout (`buffering timed out`)
This occurs if the MongoDB engine cannot reach the external database within 10 seconds.
**Fix:** 
- Verify your `.env.local` definitely contains the correct `MONGODB_URI` connection string.
- If using MongoDB Atlas, ensure your current IP address is temporarily whitelisted in the Network Access dashboard.

### 3. Missing `project.config.ts` Crash
The Next.js Next dev environment will crash if it starts before you configure the application.
**Fix:** For the very first launch on a new clone, **you must use `node start.js`**. Running `npm run dev` manually will bypass the port 3001 Setup Wizard, meaning the required AST config files won't be generated!

---

## Security Checklist (Production)

- [ ] RS256 key pair rotated from defaults
- [ ] `AES_ENCRYPTION_KEY` is unique per deployment
- [ ] `projectConfig.security.antiDebug = true`
- [ ] `NODE_ENV=production` set in deployment environment
- [ ] HTTPS enforced (HSTS header is already set)
- [ ] MongoDB user has least-privilege access

---

## Security Hardening Changelog

All hardening changes applied against the production audit. Each entry maps to a specific code location.

| # | Severity | Issue | Resolution |
|---|---|---|---|
| 1 | 🔴 Critical | Account enumeration via login timing | Dummy bcrypt compare on user-not-found path (`providers/email.ts`) |
| 2 | 🔴 Critical | Lockout bypass race condition | Replaced `user.save()` with atomic `$inc` / `updateOne` (`providers/email.ts`) |
| 3 | 🔴 Critical | Admin panel DOM XSS | Added `esc()` HTML-escape utility; all DB values wrapped before `innerHTML` injection (`admin-app/ui/index.html`) |
| 4 | 🟠 High | Password mutilation by HTML stripper | Password fields excluded from `/<[^>]*>/g` strip pass (`sanitise.ts`) |
| 5 | 🟠 High | Rate limiter IP spoofing bypass | Right-to-left `x-forwarded-for` resolver with private-range detection (`rateLimit.ts`) |
| 6 | 🟡 Medium | Bulk import uses weaker bcrypt rounds (10 vs 12) | `BCRYPT_ROUNDS` exported from `password.ts` and imported in `import/commit/route.ts` |
| 7 | 🟡 Medium | Seed documents accumulated duplicate `created_at` / `createdAt` | Removed manual timestamp fields from all `initialise.js` seeds; Mongoose auto-manages them |
| 8 | 🔵 Low | 1-hour JWT access token revocation window | Token lifetime reduced to **15m**; fallback default updated in `jwt.ts` and setup wizard template |
| 9 | 🔵 Low | Deprecated `res.flushHeaders()` in SSE setup | Replaced with `res.writeHead(200, { ... })` in `initialise.js` |

---

## License

ISC
