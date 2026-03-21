# Marketwake Deliverables Hub — Setup Guide

## Step 1: Run the Supabase schema

1. Go to your Supabase dashboard → **SQL Editor → New Query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

## Step 2: Add your Supabase keys locally

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the three values from **Supabase → Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Add env vars to Vercel

In Vercel → your project → **Settings → Environment Variables**, add the same three keys.

## Step 4: Push to GitHub

```bash
cd mw-projects
git init
git remote add origin https://github.com/thegreatfloofie/mw-projects.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

Vercel will auto-detect the push and deploy.

## Step 5: Create your first AM account

1. In Supabase → **Authentication → Users → Invite user**
2. Enter your email — you'll get a magic link to set a password
3. Repeat for any other AMs on your team

## Step 6: Test it

- Visit `yourapp.vercel.app` → you'll be redirected to `/login`
- Sign in → you're on the dashboard
- Create a client → open its tracker
- On the dashboard, click ••• on a client card → **Copy client link** → paste in an incognito window — you should see the read-only client view, no login required

## Adding your Marketwake logo

Replace the text in `components/MWLogo.tsx` with:

```tsx
export default function MWLogo() {
  return <img src="/mw-logo.png" alt="Marketwake" style={{ height: 22, filter: 'invert(1)' }} />
}
```

Then add your logo file to the `/public` folder as `mw-logo.png`.

## Local development

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.
