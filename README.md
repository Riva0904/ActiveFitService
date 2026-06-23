# ActiveFit — Gym Management SaaS Platform

A modern, full-stack Gym Management SaaS with 3-tier role-based access.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| UI Components | shadcn/ui + Recharts |
| State Management | Zustand |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + Role-Based Access Control |
| Payments | Razorpay |
| File Storage | Cloudinary |
| Notifications | Email (Nodemailer) + WhatsApp (Twilio) |

## Roles

| Role | Access |
|---|---|
| **Super Admin** | Platform-wide management, all gyms, revenue, subscriptions |
| **Admin** | Single gym management, members, attendance, trainers, finance |
| **User** | Personal dashboard, workouts, diet, QR check-in, supplement shop |

## Project Structure

```
ActiveFit/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/               # JWT auth + strategies
│   │   ├── users/
│   │   ├── gyms/
│   │   ├── memberships/
│   │   ├── attendance/         # QR check-in system
│   │   ├── trainers/
│   │   ├── pt-sessions/
│   │   ├── payments/           # Razorpay integration
│   │   ├── supplements/        # Inventory + shop
│   │   ├── workout-plans/      # AI suggestions
│   │   ├── diet-plans/         # AI nutrition
│   │   ├── notifications/
│   │   ├── invoices/
│   │   └── common/             # Guards, decorators, interceptors
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
│
└── frontend/                   # Next.js App Router
    └── src/
        ├── app/
        │   ├── (auth)/         # Login, Register
        │   └── (dashboard)/
        │       ├── super-admin/
        │       ├── admin/
        │       └── user/
        ├── components/
        │   ├── layout/         # Sidebar, Header
        │   ├── shared/         # StatsCard, etc.
        │   └── ui/             # shadcn components
        ├── store/              # Zustand (authStore)
        └── lib/                # API client, utils
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- pnpm / npm

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Edit .env with your database URL, JWT secret, etc.

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (demo accounts)
npm run prisma:seed

# Start development server
npm run start:dev
```

Backend runs on: `http://localhost:3001`
Swagger docs: `http://localhost:3001/api/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Start development server
npm run dev
```

Frontend runs on: `http://localhost:3000`

## Demo Accounts

After running the seed:

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@activeboost.com | Password@123 |
| Admin | admin@fitnesshub.com | Password@123 |
| User | user@example.com | Password@123 |

## API Endpoints

| Module | Base Route |
|---|---|
| Auth | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` |
| Users | `GET/PATCH /api/v1/users` |
| Gyms | `GET/POST/PATCH/DELETE /api/v1/gyms` |
| Memberships | `GET/POST/PATCH /api/v1/memberships` |
| Attendance | `POST /api/v1/attendance/check-in`, `qr-check-in` |
| Trainers | `GET/POST/PATCH /api/v1/trainers` |
| PT Sessions | `GET/POST/PATCH /api/v1/pt-sessions` |
| Payments | `POST /api/v1/payments/create-order`, `verify` |
| Supplements | `GET/POST /api/v1/supplements`, `/order` |
| Workout Plans | `GET /api/v1/workout-plans/my`, `/ai-generate` |
| Diet Plans | `GET /api/v1/diet-plans/my`, `/ai-generate` |
| Notifications | `GET/PATCH /api/v1/notifications` |
| Invoices | `GET /api/v1/invoices` |

## Key Features

### Admin Dashboard
- Real-time attendance tracking with QR scanner
- Member management with bulk actions
- Revenue analytics with Recharts
- Expiring membership alerts
- Supplement inventory with low-stock alerts
- Trainer performance analytics
- Broadcast notifications to all members

### User Dashboard
- Personal QR code for check-in
- AI-powered workout plan generation
- AI-powered diet plan generation
- Progress tracking with body measurements
- In-app supplement store with cart
- Payment history and invoice download

### Super Admin
- Platform-wide gym management
- Approve/suspend gyms
- Subscription management
- Revenue dashboard across all gyms

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/activefit_db
JWT_SECRET=your-secret-key
PORT=3001
CLOUDINARY_CLOUD_NAME=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASS=...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=...
```

## Production Deployment

- **Backend**: Deploy to Railway, Render, or AWS EC2
- **Frontend**: Deploy to Vercel (recommended)
- **Database**: Neon, Supabase, or Railway PostgreSQL
- **Files**: Cloudinary (already integrated)

---

Built with ❤️ for modern fitness businesses
