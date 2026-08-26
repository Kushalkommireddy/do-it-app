# Do it! — deployment guide

This turns the demo into a real multi-user app: Next.js frontend, Supabase
for accounts + real email codes + database. It now includes **two workspaces**
after login — **Do it!** (tasks) and **Expense Tracker** (spending with a
pie chart) — chosen from a picker screen. Follow these steps in order.

## 1. Create your Supabase project (free tier is fine)

1. Go to https://supabase.com → sign up → **New project**.
2. Pick a name, a database password (save it somewhere), and a region close to your users.
3. Wait ~2 minutes for it to spin up.
4. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key — you'll need both shortly.

## 2. Create the database tables

1. In Supabase, open **SQL Editor → New query**.
2. Paste the contents of `supabase/schema.sql` (included in this project) and click **Run**.
3. This creates the `tasks` table **and** the `expenses` table, both with
   **Row Level Security** turned on — so each signed-in user can only ever
   see or change their own rows in either table, enforced by the database
   itself, not just the app.

## 3. Turn on real email sending

1. Go to **Authentication → Providers → Email** and make sure **Confirm email**
   is turned on (this is what sends the "confirm your account" email on signup).
2. Go to **Authentication → Email Templates → Magic Link**. This template is
   reused for the password-reset code. By default it only shows a clickable
   link — edit the HTML so it also displays `{{ .Token }}`, which is the
   6-digit code. For example, add this line near the top of the template:
   ```html
   <h2>{{ .Token }}</h2>
   <p>Enter this code in the app to continue.</p>
   ```
   Save the template.
3. **Important for real daily use:** Supabase's built-in email sender is
   rate-limited (a handful of emails per hour) — fine for testing, not for
   several people signing up the same day. Go to **Project Settings →
   Auth → SMTP Settings** and connect a real provider instead — free tiers
   that work well: **Resend** (resend.com), **Postmark**, or **SendGrid**.
   You'll enter their SMTP host/port/username/password there. This is a
   five-minute setup on their side and removes the rate limit.

## 4. Run it locally first (optional but recommended)

You'll need [Node.js](https://nodejs.org) installed (v18+).

```bash
cd do-it-app
npm install
cp .env.local.example .env.local
```

Open `.env.local` and paste in your Supabase URL and anon key from step 1.

```bash
npm run dev
```

Visit http://localhost:3000 — sign up with a real email you can check, confirm
it, sign in, and try adding a task to make sure everything's wired up.

## 5. Push it to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repository at https://github.com/new (don't add a README
there — you already have one), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## 6. Deploy — Vercel (recommended, made by the Next.js team)

1. Go to https://vercel.com → sign in with GitHub → **Add New… → Project**.
2. Import your repository. Vercel auto-detects Next.js — no config needed.
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
4. Click **Deploy**. You'll get a live URL like `do-it-yourname.vercel.app`.

### Or — Netlify

1. Go to https://netlify.com → **Add new site → Import an existing project**.
2. Connect GitHub, pick your repo. Netlify detects Next.js automatically
   (it installs the Next.js runtime plugin for you).
3. Under **Site settings → Environment variables**, add the same two
   `NEXT_PUBLIC_SUPABASE_*` variables as above.
4. Deploy.

## 7. One last Supabase setting

Back in Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your live URL (e.g. `https://do-it-yourname.vercel.app`).
- Add the same URL under **Redirect URLs**.

This makes sure confirmation and recovery emails point people back to your
live site instead of `localhost`.

## You're done

Anyone can now go to your live URL from a phone, tablet, or laptop, create
their own account, verify it by email, and their tasks are stored privately
under their account — synced automatically wherever they log in.

## Updating the site later

Any time you want to change something, edit the code and:
```bash
git add .
git commit -m "describe the change"
git push
```
Vercel/Netlify will automatically rebuild and redeploy within about a minute.
