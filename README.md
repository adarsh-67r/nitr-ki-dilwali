# NITR ki Dilwali

A Diwali cracker ordering site for NIT Rourkela hostels. Students pick crackers from a price list, place the order, and confirm it on WhatsApp. Pickup is at Jagda gate.

## Features

**Shop**
- Price list with categories, search, a category filter and price sort
- MRP shown struck out next to the selling price
- Coupon codes, plus automatic offers once the cart reaches a minimum amount
- UPI only: 50% advance to confirm the order, the rest at pickup
- Order opens a pre-filled WhatsApp chat (WhatsApp Web on PC, the app on phones)

**Admin (`/admin`)**
- Add, edit and delete crackers, with an image upload for each one
- Bulk import from Excel (`public/crackers-template.xlsx`)
- Manage stock, coupons and automatic offers
- View and search orders, with advance and pickup amounts
- One superadmin who adds admins and sets their passwords

**Security**
- Prices are always taken from the database, never from the browser
- Row-level security on every table; only admins can change data or read orders
- Rate limits on orders, both per phone number and for the whole shop
- Security headers (CSP, no framing)

## Tech stack

Next.js 16 (App Router), Supabase (Postgres, Auth, Storage), Tailwind CSS, deployed on Vercel.

## Setup

1. **Install**
   ```bash
   pnpm install
   ```

2. **Database.** Create a Supabase project. Open `supabase/schema.sql` and change `you@example.com` to the superadmin's email, then run the whole file once in the Supabase SQL editor.

3. **Environment.** Create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_WHATSAPP_NUMBER=91XXXXXXXXXX   # shop's WhatsApp number, with country code
   SUPABASE_SECRET_KEY=sb_secret_...          # server only, used by /api/admins
   ```
   Never commit `.env.local`, and never give the secret key a `NEXT_PUBLIC_` prefix.

4. **Superadmin login.** In Supabase, go to Authentication → Users → Add user, and create a user with the superadmin's email (tick "Auto confirm"). After that, add other admins from the Admins tab in `/admin`.

5. **Run**
   ```bash
   pnpm dev
   ```
   Shop at http://localhost:3000, admin at http://localhost:3000/admin.

## Tests

```bash
node --test lib/*.test.ts
```

## Deploy

The Vercel project is connected to this repo. A push to `main` deploys to production, and other branches get preview links. Set the same four environment variables in Vercel.
