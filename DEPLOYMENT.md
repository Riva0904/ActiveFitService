# ActiveFit — Deployment Guide

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your secrets

# 2. Start all services
docker-compose up -d

# 3. Run database migrations
docker-compose exec backend npx prisma migrate deploy

# 4. Seed demo data
docker-compose exec backend npm run prisma:seed

# 5. Access the app
# Frontend: http://localhost:3000
# API:      http://localhost:3001/api/v1
# Swagger:  http://localhost:3001/api/docs
```

---

## Manual Setup (Development)

### 1. Backend

```bash
cd backend

# Install
npm install

# Configure
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, SMTP credentials, Razorpay keys

# Database setup
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed

# Start
npm run start:dev      # Development
npm run start:prod     # Production (after npm run build)
```

### 2. Frontend

```bash
cd frontend

# Install
npm install

# Configure
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Start
npm run dev    # Development
npm run build && npm start  # Production
```

---

## Running Tests

### Unit Tests

```bash
cd backend
npm run test           # Run all unit tests
npm run test:cov       # With coverage report
npm run test:watch     # Watch mode
```

Expected output:
```
Test Suites: 7 passed, 7 total
Tests:       65+ passed
Coverage:    75%+ (lines)
```

### E2E Tests

```bash
cd backend

# Requires running PostgreSQL
DATABASE_URL="postgresql://..." npm run test:e2e
```

---

## Email Configuration (Riva Gmail)

The platform is configured to use **rivainvitation@gmail.com** with app password `kjfshqiddkhtjgqe`.

In `.env`:
```
SMTP_USER=rivainvitation@gmail.com
SMTP_PASS=kjfshqiddkhtjgqe
```

OTP emails sent for:
- **Email Verification** — on registration
- **Password Reset** — on forgot password
- **Login 2FA** — on suspicious login (future)

---

## Auth Flow

```
Register ──► OTP sent to email ──► Verify OTP ──► JWT issued
                                       │
                                  (wrong OTP)
                                       │
                                  Max 5 attempts ──► OTP locked
                                       │
                                  Resend (60s cooldown)

Forgot Password ──► OTP sent ──► Verify OTP + new password ──► Success
```

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/auth/register` | POST | ❌ | Register + send OTP |
| `/api/v1/auth/verify-email` | POST | ❌ | Verify OTP → JWT |
| `/api/v1/auth/login` | POST | ❌ | Login (requires verified email) |
| `/api/v1/auth/resend-otp` | POST | ❌ | Resend OTP (rate limited) |
| `/api/v1/auth/forgot-password` | POST | ❌ | Send reset OTP |
| `/api/v1/auth/reset-password` | POST | ❌ | Reset with OTP |
| `/api/v1/auth/profile` | GET | ✅ | Get own profile |
| `/api/v1/auth/change-password` | PATCH | ✅ | Change password |
| `/api/v1/health` | GET | ❌ | System health check |
| `/api/v1/health/ping` | GET | ❌ | Ping |

---

## Production Checklist

- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Set up SSL certificate (Nginx config included)
- [ ] Configure Razorpay live keys
- [ ] Set up Cloudinary account
- [ ] Run `prisma migrate deploy` (not `dev`) in production
- [ ] Set up PM2 (`pm2 start ecosystem.config.js --env production`)
- [ ] Configure log rotation
- [ ] Set up DB backups

---

## PM2 Production

```bash
# Install PM2 globally
npm install -g pm2

# Build both apps first
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Monitor
pm2 status
pm2 logs activefit-api
pm2 monit
```
