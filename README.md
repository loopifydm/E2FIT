# E2FIT Website

Premium responsive website and delivery dashboard for E2FIT Healthy Fruit Salad, Coimbatore.

## Live features

- Four E2FIT plans with daily/monthly pricing.
- Customer order form for name, WhatsApp number, delivery address and breakfast/lunch.
- Orders are stored in Supabase.
- Monthly plans are treated as 26 non-Sunday delivery days.
- Admin dashboard uses Supabase Auth and the existing admin role.
- Today's deliveries are generated from active monthly subscriptions when an admin opens the dashboard.
- Delivery workflow: Pending → Preparing → Out for Delivery → Delivered.
- Customer and active subscription snapshot.
- GitHub Pages deployment workflow.

## Supabase

Project URL and publishable browser key are stored in supabase-config.js. Only the publishable key is used in the browser; no secret/service-role key is committed.

Database tables:
- e2fit_customers
- e2fit_subscriptions
- e2fit_deliveries

The database uses Row Level Security. Anonymous visitors can create orders, while only authenticated users whose profiles.role is admin can read/update E2FIT records.

## Admin

Open /admin.html from the deployed GitHub Pages site and sign in with an existing Supabase Auth account that has the admin role in public.profiles.

## Important launch settings

- Replace placeholder WhatsApp links with the official E2FIT WhatsApp number.
- Add the final E2FIT logo and product photographs.
- Confirm the Supabase admin account before sharing the admin URL.

## E2FIT Admin PWA

The admin panel at `admin.html` has an installable PWA manifest and a service worker for caching the admin app shell.

Files added:
- `admin.webmanifest` — install name, standalone display, theme and launch URL.
- `admin-service-worker.js` — caches the admin shell and its local assets, with an offline navigation fallback.
- `assets/e2fit-pwa-icon.svg` — icon used by the installed admin app.

### Install on Android

1. Publish the repository through GitHub Pages under **Settings → Pages** (main branch, root folder).
2. Open the HTTPS URL ending in `/admin.html` in Chrome on Android.
3. Load it once while online; then use Chrome's menu and choose **Install app** or **Add to Home screen**.

### Offline limitations

The service worker can cache the admin page and local files, but admin sign-in, orders, subscriptions, invoices and other Supabase data require internet access. The Supabase and jsPDF scripts are loaded from a CDN and are not bundled for offline use. This PWA does not make the admin database available offline or synchronize local offline edits.
