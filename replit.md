# Minions Market

## Overview

Gaming marketplace (like playerok.com) where users buy/sell game accounts, items, currency, and services. Built as a pnpm monorepo with a React frontend and Express API backend. Supports Telegram Mini App integration, multiple payment gateways, and full admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + TailwindCSS v4 + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (bcrypt + jsonwebtoken)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API), Vite (frontend)
- **Payment gateways**: Rukassa, NOWPayments, CrystalPay (env-var gated)
- **Telegram**: Bot API for auth codes & admin notifications

## Architecture

### Artifacts
- `artifacts/minions-market` — React frontend (dark gaming theme, RU/EN i18n)
- `artifacts/api-server` — Express API backend with all routes

### Libraries
- `lib/db` — Drizzle ORM schema and database connection
- `lib/api-spec` — OpenAPI 3.1 specification
- `lib/api-client-react` — Generated React Query hooks (Orval)
- `lib/api-zod` — Generated Zod schemas

### Database Schema (lib/db/src/schema/)
- `users` — User accounts with balance, ratings, seller levels
- `categories` — Product categories (game-accounts, items, currency, boosting, services, other)
- `products` — Marketplace listings with images, tags, delivery types
- `favorites` — User favorited products
- `deals` — Secure escrow deals (buyer↔seller with commission)
- `transactions` — Wallet deposits, withdrawals, sale revenue, refunds
- `messages` — Direct messages between users
- `reviews` — Deal reviews (1-5 stars)
- `auth-codes` — Telegram bot authentication codes

### API Routes (artifacts/api-server/src/routes/)
- `/auth` — Register (with Telegram code), login, Telegram Mini App auth, /me
- `/users` — User profiles, user products, user reviews
- `/categories` — List categories with product counts
- `/products` — CRUD products, search/filter, featured, stats, favorites toggle
- `/deals` — Create deals (escrow), deliver, confirm, dispute, review
- `/wallet` — Balance, deposit (payment gateways), withdraw, transactions, webhooks
- `/messages` — Chat list, message threads, send messages
- `/admin` — Stats, user management (ban/verify), product moderation, deal resolution, withdrawal processing, category management
- `/favorites` — User's favorite products list
- `/profile` — Update profile

### Frontend Pages (artifacts/minions-market/src/pages/)
- Home — Hero gradient, stats, categories grid, featured/recent products
- Auth — Login/Register with Telegram bot code flow
- Catalog — Search, category filters, sort options, pagination
- Product — Full detail with seller info, buy button, favorite toggle
- Profile — User stats, products tab, reviews tab, quick links
- Sell — Create product form
- Deals/Deal-detail — Deal list, escrow flow (deliver→confirm/dispute→review)
- Wallet — Balance card, deposit/withdraw dialogs, transaction history
- Messages — Chat list + real-time messaging
- Settings — Edit profile, language switch, logout
- Favorites — Saved products grid
- Admin — Stats, users, products, deals, withdrawals, categories management

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables

Required for production (set in Railway):
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` / `JWT_SECRET` — JWT signing key
- `TELEGRAM_BOT_TOKEN` — Telegram bot for auth codes
- `TELEGRAM_BOT_USERNAME` — Bot username for UI
- `ADMIN_TELEGRAM_CHAT_ID` — Admin notifications chat

Optional payment gateways:
- `RUKASSA_API_KEY`, `RUKASSA_SHOP_ID`
- `NOWPAYMENTS_API_KEY`
- `CRYSTALPAY_API_KEY`, `CRYSTALPAY_SHOP_NAME`

## Default Admin Account
- Username: `admin`
- Password: `admin123`
- Created on first seed (auto-runs on server start)
