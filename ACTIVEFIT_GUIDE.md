# ActiveFit — Workflow, Test Guide & Client Demo Script

## 1. Overview & Architecture

ActiveFit is a multi-tenant gym management SaaS. A single platform hosts many gyms ("tenants"); each gym has its own admin, staff, trainers, and members, isolated by `gymId`. On top of that sits a Super Admin layer that oversees all gyms platform-wide.

**Stack:**

```
Browser
  │
  ▼
Next.js 16 frontend (Vercel)         https://active-fit-ui.vercel.app
  │  /api/v1/*  rewritten by next.config.js
  ▼
NestJS backend (Render)              https://activefit-api.onrender.com
  │
  ▼
PostgreSQL (Neon, via Prisma)
```

**Why the proxy exists:** the frontend (Vercel) and backend (Render) live on different domains. The httpOnly auth cookie (`ab_token`) can only be scoped to one origin. `frontend/next.config.js` rewrites `/api/v1/*` requests through Vercel's own domain to Render, so the browser only ever talks to its own origin and the cookie works correctly. `frontend/src/middleware.ts` enforces the auth/role gate on page routes but explicitly excludes `api/` so proxied API calls aren't caught by the same redirect logic.

One consequence: Socket.io (live chat) **cannot** be proxied this way — Vercel rewrites can't hold a WebSocket connection open — so the browser connects directly cross-domain to Render for chat. Since the cookie doesn't reach that connection, the frontend fetches a short-lived token over the (cookie-authenticated) REST proxy via `GET /auth/socket-token` and passes it explicitly in the socket handshake.

**Deploy note (important):** Render's `activefit-api` service pulls from a **separate** mirror repo (`Riva0904/ActiveFitService`), not this monorepo. A normal `git push` to this repo's `main` does **not** reach production for the backend. Any backend change needs an extra step:

```bash
git subtree split --prefix=backend -b backend-split
git push <ActiveFitService-remote> backend-split:main --force
```
then trigger a Render deploy (dashboard "Manual Deploy" or the Render API). The frontend has no such issue — Vercel deploys from this repo directly (though in practice during this session the Vercel git auto-deploy webhook didn't fire reliably either; `vercel --prod` from `frontend/` is the reliable fallback).

---

## 1a. Screenshots (live production)

Captured directly from `https://active-fit-ui.vercel.app` against seeded accounts.

| | |
|---|---|
| **Login** ![login](screenshots/00_login.png) | **Gym Admin — Dashboard** ![admin dashboard](screenshots/01_admin_dashboard.png) |
| **Gym Admin — Members** ![admin members](screenshots/02_admin_members.png) | **Gym Admin — Payments** ![admin payments](screenshots/03_admin_payments.png) |
| **Gym Admin — Attendance** ![admin attendance](screenshots/04_admin_attendance.png) | **Gym Admin — Chat** ![admin chat](screenshots/06_admin_chat.png) |
| **Member — Dashboard** ![member dashboard](screenshots/07_member_dashboard.png) | **Member — Workouts (AI generate)** ![member workouts](screenshots/08_member_workouts.png) |
| **Member — Supplement Store** ![member supplements](screenshots/09_member_supplements.png) | **Super Admin — Platform Dashboard** ![superadmin dashboard](screenshots/10_superadmin_dashboard.png) |
| **Super Admin — Gym Network** ![superadmin gyms](screenshots/11_superadmin_gyms.png) | |

---

## 2. Roles & Workflow

### Super Admin (platform owner)
1. Login → platform dashboard: total gyms, members, trainers, subscription-plan distribution, growth trend
2. **Gyms** — view/approve/suspend any registered gym, see per-gym stats
3. **Subscriptions** — manage the 3 SaaS tiers (Starter / Professional / Enterprise) and their limits (max members/trainers/staff/branches)
4. **Admins** — manage gym-admin accounts, reassign gyms
5. **Analytics** — platform-wide retention/revenue
6. **Chat** — message any gym admin

### Gym Admin (tenant owner)
1. **Register** a new gym (self-service signup) → verify email via OTP → land on admin dashboard
2. **Staffing** — create trainer/staff/member accounts (`POST /users`); each role gets the right sub-profile created automatically (Member gets a `memberCode` + QR token, Trainer gets a trainer profile, Staff gets a staff profile)
3. **Memberships** — create plans (`POST /memberships/plans`: name, duration, price), subscribe members to a plan (`POST /memberships`)
4. **Daily ops** — attendance dashboard, manual check-in for walk-ins, payments (cash/UPI/Razorpay), expenses, leave approvals, supplement catalog & stock, promo codes, enquiries/leads
5. **Engagement** — push notifications, at-risk member detection (14+ days inactive) with win-back messaging, chat with anyone in the gym
6. **Reporting** — revenue stats, audit logs, analytics dashboards

### Member
1. Gets created by the admin (or self-registers, depending on flow) → verifies email
2. Subscribes to / gets subscribed to a membership plan — **required before check-in works**
3. **Self check-in** at the gym (`POST /attendance/self-check-in`) — blocked with a clean 400 if no active membership
4. **Workouts/Diet** — AI-generates a personalized plan free, or buys a premium trainer-made package
5. **Supplements** — browses catalog, orders (stock auto-decrements)
6. **Payments** — pays membership renewal, views transaction history
7. **My Trainer** — views assigned trainer, books PT sessions
8. **Progress** — logs body measurements, sees transformation trend
9. **Chat** — messages the gym admin directly

### Trainer
1. Login → dashboard with performance ring (sessions, revenue, attendance rate, retention) and AI insights
2. Views members assigned to them (`POST /trainers/:id/assign` done by admin)
3. Manages PT session calendar — schedule, complete, mark no-show
4. Applies for leave (`POST /leave-requests`) — admin approves/rejects
5. Chats with admin/members

### Staff
1. Login → today's attendance stats
2. Manual check-in/out for members at the front desk
3. Applies for leave
4. Chats with admin

---

## 3. Test Case Matrix

All rows below were either directly executed against production (`https://active-fit-ui.vercel.app`) this session, or are recommended additions following the same pattern. ✅ = verified passing live. 🆕 = recommended, not yet run.

### Auth

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Register gym, missing address fields | `POST /auth/register-gym` without `gymAddress/gymCity/gymState/gymPincode` | `400` listing each missing field | ✅ |
| Register gym, valid | Full payload | `201`, gym + admin user created, OTP "sent" | ✅ |
| Verify email, correct OTP | `POST /auth/verify-email` with OTP pulled from `otp_codes` table | `200`, user object **without** password/refreshToken hash | ✅ (fixed — previously leaked password hash) |
| Login, correct password | `POST /auth/login` | `200`, cookies set, user object **without** refreshToken hash | ✅ (fixed — previously leaked refresh hash) |
| Login, wrong password | wrong password | `401 Invalid email or password` | ✅ |
| Login, unverified email | login before OTP verify | `401`, `code: EMAIL_NOT_VERIFIED`, new OTP auto-sent | 🆕 |
| Refresh token | `POST /auth/refresh` with valid `ab_refresh` cookie | `200 Token refreshed` | ✅ (fixed — was always `401`, every session force-logged-out after 15 min) |
| Refresh token, reused/invalid | refresh twice with same old token | `401 Refresh token reuse detected` | 🆕 |
| Socket handshake token | `GET /auth/socket-token` (authed) | `200 { token }`, 60s expiry | ✅ |

### Memberships

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Create plan, missing `durationMonths` | `POST /memberships/plans` without it | `400` clean validation error | ✅ (fixed — previously `500`, NaN silently passed business-logic check then crashed Prisma) |
| Create plan, valid | full payload | `201` | ✅ |
| Subscribe member to plan | `POST /memberships` | `201`, status `ACTIVE`, `endDate` = start + plan duration | ✅ |
| List expiring memberships | `GET /memberships/expiring?days=7` | members expiring within window | 🆕 |

### Attendance

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Self check-in, no active membership | `POST /attendance/self-check-in` | `400 No active membership` | ✅ |
| Self check-in, active membership | same, after subscribing | `201`, action `CHECKIN` | ✅ |
| Today's stats reflect check-in | `GET /attendance/stats/today` | `totalToday`/`currentlyIn` increment | ✅ |
| Staff manual check-in for a member | `POST /attendance/check-in` as STAFF | `201` | 🆕 |
| Member hits staff-only check-in route | `POST /attendance/check-in` as MEMBER | `403 Forbidden resource` | ✅ |

### Payments

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Cash payment, missing `type` | `POST /payments/cash` without `type` | `400` listing valid enum values | ✅ (fixed — previously `500`) |
| Cash payment, valid | full payload (`memberId`, `type`, `amount`) | `201`, `status COMPLETED` | ✅ |
| Revenue stats reflect payment | `GET /payments/stats` | `monthlyRevenue`/`yearlyRevenue` updated | ✅ |
| Razorpay order create + verify | `POST /payments/create-order` → `POST /payments/verify` | order created, signature verified | 🆕 (needs live Razorpay test keys) |

### Leave

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Apply leave, missing `leaveType` | `POST /leave-requests` without it | `400` listing valid enum values | ✅ (fixed — previously `500`, unguarded `body.leaveType.toLowerCase()` crash) |
| Apply leave, valid | full payload | `201`, status `PENDING`, admins notified | ✅ |
| Approve leave | `PATCH /leave-requests/:id/approve` | `200`, status `APPROVED` | ✅ |
| Non-staff/trainer applies leave | as MEMBER or GYM_ADMIN | `403 Forbidden resource` | ✅ |

### Supplements

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Add supplement (admin) | `POST /supplements` | `201` | ✅ |
| Order supplement (member) | `POST /supplements/order` | `201`, order total computed | ✅ |
| Stock decrements after order | `GET /supplements/:id` after order | stock reduced by ordered quantity | ✅ |

### Trainer Assignment

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Assign member to trainer | `POST /trainers/:trainerId/assign` (admin) | `201` | ✅ |
| Trainer views assigned members | `GET /trainers/my-dashboard` | includes assignment count | 🆕 |

### Workouts / Diet

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| AI-generate workout plan | `POST /workout-plans/ai-generate` (member) | `201`, plan + exercises returned, auto-assigned to caller | ✅ |
| View "my plans" | `GET /workout-plans/my` | includes the generated plan | ✅ |
| Buy premium package | `POST /workout-plans/packages/:id/buy` (member) | `201`, purchase recorded | 🆕 |

### Chat

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Get/create own conversation (REST) | `GET /chat/my-conversation` | `200`, conversation object | ✅ |
| Admin views all gym conversations | `GET /chat/conversations` | `200`, list including the member's | ✅ |
| Live socket connect, cross-domain | connect to `wss://activefit-api.onrender.com` with `auth.token` from `/auth/socket-token` | connects successfully | ✅ (fixed — previously never connected; cookie never reached Render's socket origin) |
| Send message via socket | `chat:send` event after connect | message delivered, conversation `lastMessage` updated | 🆕 |

### Role-Permission Boundaries (cross-cutting)

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Member calls admin-only endpoint | e.g. `POST /supplements` as MEMBER | `403 Forbidden resource` | 🆕 (pattern confirmed via attendance/leave tests above) |
| Unauthenticated request to protected endpoint | no cookie | `401 Unauthorized` | 🆕 |
| Cross-gym data isolation | Gym A admin queries Gym B's data by ID | `404` or `403` (gym-scoped query) | 🆕 — worth a dedicated pass since `gymId` scoping is manual per-query, not row-level-security |

---

## 4. Client Demo Script

### Prerequisites
- Open **https://active-fit-ui.vercel.app/login** in a clean browser tab
- Seeded super-admin login: `superadmin@activeboost.com` / `Password@123`
- **Known limitation to pre-empt:** the email provider (Resend) is in test mode and can only deliver to its own verified address. If you register a fresh gym live, the OTP email **will not arrive** in the client's inbox. Either:
  (a) pre-register a demo gym beforehand and skip the live-registration step, or
  (b) be ready to say "in production this OTP lands in your inbox — for this demo I'll pull it from the database" and show the OTP another way.
- Chat: the first message after the browser tab has been idle for a while may take a couple seconds to reconnect the socket — don't be alarmed by a short delay on the very first send.

### Suggested Narrative (≈15–20 min)

1. **Registration** (skip live OTP per above, or pre-stage it) — show the gym signup form, emphasize self-service onboarding, no manual setup needed from your side.
2. **Admin dashboard tour** — live metrics: members, attendance, revenue, at-risk members. This is the first thing a gym owner sees every morning.
3. **Add a trainer, staff, and member live** — show how fast staffing setup is (`Members/Staffs/Trainers` pages, one form each). Point out the auto-generated member QR code/member code.
4. **Create a membership plan + subscribe the member** — show pricing flexibility (any duration, any price, discounts).
5. **Check the member in** — either via the member's own QR-based self-check-in, or the front-desk manual check-in flow staff would use. Show the dashboard counter update live.
6. **Record a payment** — cash or UPI, watch the revenue stat update immediately. This is the "no more spreadsheets" moment.
7. **AI-generate a workout plan** as the member — strong visual, fast, free differentiation vs. competitors who require a trainer to manually build every plan.
8. **Trainer leave request → admin approval** — shows staff-management isn't just members, it's full HR-lite for the gym's own team.
9. **Chat** — send a live message member→admin, show it land in real time. Humanizes the platform — it's not just a dashboard, it's how the gym actually talks to its members.
10. **Super-admin view** (if the client runs/plans to run multiple locations or franchise) — show the platform-level oversight: every gym, every subscription tier, aggregate analytics. This is the pitch for scaling beyond one location.

**Closing point:** everything shown is live on the actual production deployment, not a mockup — what they're seeing is what they'd actually get.

---

## 5. Known Issues / Roadmap

**Fixed this session (verified live in production):**
- Password and refresh-token bcrypt hashes were being returned in API responses (`verify-email`, `login`, `deactivate`/`activate`) — now stripped
- `memberships/plans`, `payments/cash`, `leave-requests` accepted unvalidated bodies and crashed with raw `500`s on malformed input — now return clean `400`s via DTOs
- Refresh-token flow was completely broken (every user force-logged-out 15 minutes after login) — refresh token is now a proper signed JWT
- Live chat never worked across the Vercel/Render domain split (cookie couldn't reach the socket origin) — now uses an explicit short-lived handshake token
- `NEXT_PUBLIC_API_URL` was never set in Vercel — every browser session's API calls fell back to `http://localhost:3001/api/v1` and failed outright (`ERR_CONNECTION_REFUSED`) for any real visitor. Curl-based tests earlier missed this because they hit the proxy path directly, bypassing the actual frontend bundle. Set to `/api/v1` and redeployed.
- `formatDate`/`formatDateTime` crashed the whole page (error boundary) whenever `user.timezone` was `null` — true for almost every account, since nothing sets it at registration. Caught live via screenshot on the admin Members page. Fixed by coalescing inside the function instead of relying on a default parameter (which only covers `undefined`, not an explicit `null`).

**Still open:**
- Member dashboard shows a brief "Forbidden resource" toast on load (one API call 403s for the MEMBER role) — cosmetic, didn't block any tested functionality, not yet root-caused.
- `(dashboard)/layout.tsx` reads auth state from Zustand's `localStorage`-persisted store, which hydrates asynchronously. A user hard-refreshing or opening a bookmarked deep link (e.g. `/admin/members`) can hit a race where the layout's `useEffect` sees `user: null` before hydration finishes, redirects to `/login`, and middleware (seeing the still-valid cookie) bounces them back to the role's dashboard root — losing the deep link. Intermittent, not yet fixed.
- **Resend email domain unverified** — real signup/OTP/password-reset emails will not deliver to any address except the account owner's. Needs a verified sending domain at resend.com/domains before any real (non-test) user can complete email-based flows.
- **Backend deploy pipeline is fragile** — Render pulls from a separate, manually-synced mirror repo (`ActiveFitService`), not this monorepo. Every backend change needs the extra `git subtree split` + force-push step documented in §1, or Render's Git source should be repointed at this repo directly with `rootDir: backend`.
- Super-admin "gym growth" chart currently uses a randomized trend rather than real historical data.
- No automated test suite was run as part of this guide — all "✅" rows above were verified by direct API calls against production, not by a CI test suite.

