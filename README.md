# Kayani Men's Social

A private wellness companion for men, built as a web app (PWA) that works on phones and computers.
Tanzania first, in English and Kiswahili. Run by Kayani Herbs.

## What's inside

| Part | Where | What it does |
|---|---|---|
| **Social** (Discover + Community) | `src/app/(app)/social`, `src/components/social` | Guides, videos, Q&A, personalised picks; anonymous community questions with moderation |
| **Man** | `src/components/tabs/ManTab.tsx`, `src/lib/feed`, `src/lib/progress` | Daily activities, check-ins, sleep, water, points, streaks, trends |
| **Course** (top of Man) | `src/components/course`, `src/lib/course`, Studio → Courses | Audio course: lessons open in order after 70% is heard, resumes on any phone |
| **Me** | `src/components/tabs/MeTab.tsx`, `src/lib/me` | Profile, badges, goals, settings, privacy (download / delete data) |
| **Sign-in** | `src/app/(auth)/account` | Email (Google and phone optional), password checks, slow-down after wrong tries |
| **Admin Control Center** | `/studio` (`src/app/studio`) | Content, homepage, users, community moderation, notifications, AI drafts, analytics, settings. Staff only, password + authenticator code |
| **AI** | `src/app/api/ai/route.ts`, `src/lib/ai` | Server-side Claude API for staff drafts. Drafts only: health content can't be published until reviewed |

Data lives on the phone for guests and syncs to Supabase when he has an account (`src/lib/account`).

## Stack
- Next.js (App Router, TypeScript) + Tailwind CSS
- Supabase: database, sign-in, storage. Every table has row-level security; admin powers are checked by the database and require two-step sign-in
- Hosted on Netlify. Claude API (Anthropic) for staff AI tools

## Run it on your computer
```bash
npm install
npm run dev
```
Open http://localhost:3000. Without a `.env.local` the app runs in demo mode (everything saved in the browser).

### `.env.local` (never commit it; it's in `.gitignore`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...          # public "anon" key: safe in the browser
NEXT_PUBLIC_AUTH_GOOGLE=on                 # optional: show "Continue with Google"
NEXT_PUBLIC_AUTH_PHONE=on                  # optional: SMS codes (needs an SMS provider in Supabase)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...         # optional: Cloudflare "are you a person?" check
ANTHROPIC_API_KEY=...                      # secret: server only, never NEXT_PUBLIC_
ANTHROPIC_WORKSPACE_ID=wrkspc_...          # needed for keys made in the new Claude Console
AI_MODEL=claude-sonnet-5-5                 # optional (this is the default)
```
Put the same values in **Netlify → Site configuration → Environment variables** (mark the Anthropic key as secret), then redeploy.

## Database (Supabase)
Run the files in `supabase/migrations` **once each, in number order**, in Supabase → SQL Editor:

| File | Adds |
|---|---|
| 0001 | Content Studio: content items, admins, audit |
| 0002 | Men's accounts: private synced data, delete my account |
| 0003 | Fertility topic |
| 0004 | Studio places, account-deletion fix, video bucket |
| 0005 | Makes `TheAdmin` the owner |
| 0006 | Admin Control Center: roles, community, moderation, notifications, analytics, AI settings |
| 0007 | Two-step sign-in for admins (set up the authenticator app in `/studio` **before** running it) |
| 0008 | Safety fixes: upload limits, locked-down functions |
| 0009 | Courses: drafts, publishing and history for the audio course on the Man tab |

Old files can be re-run safely; they won't switch off two-step sign-in. Don't edit an old migration to change the live database: add a new numbered file.

## Checks
```bash
npm run lint
npm test        # includes database security tests on a real Postgres (PGlite) with every migration
npm run build
```
GitHub runs the same three on every push (see the **Actions** tab). A red ✗ means something broke.

## Rules this project keeps
- Health content is education, not diagnosis. No cure claims; AI writes drafts only; a qualified reviewer checks before publishing.
- Men's private check-ins and notes are never shown to staff or used for ads.
- Secrets stay in `.env.local` and Netlify, never in the code or chat.
