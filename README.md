# StreamBox

A video discovery app built with Next.js 14, TypeScript, Tailwind CSS,
shadcn/ui conventions, TanStack Query, PostgreSQL, Prisma, and NextAuth.

## Phase 1 — Foundation and UI shell

The responsive video feed contains 30 sample videos, category and text
filtering, responsive navigation, dark/light mode, and loading skeletons.

## Phase 2 — Auth and database

The project now includes the PostgreSQL Prisma schema, initial migration,
Prisma seed data, email/password registration and login, optional Google OAuth,
automatic channel creation, account pages, and middleware-protected routes.

## Phase 3 — Social and viewing features

- Likes, dislikes, subscriptions, comments with replies, comment likes, and a
  creator heart; comments sort by top or newest.
- Channel pages, Creator Studio (edit or delete videos, channel stats) and
  channel customization (name, handle, description, avatar, banner) at
  `/studio/channel`.
- Watch history with "resume where you left off" and progress bars on
  thumbnails, Liked videos, playlists, and a built-in Watch later list.
- Autoplay of the next video (toggle under "Up next"), and playing through a
  playlist with `/watch?v=<id>&list=<playlistId>`.
- Search results at `/results` with upload-date, duration, and sort filters,
  plus suggestions and voice search (in browsers that support it) in the
  search box.
- Shorts: vertical videos up to 3 minutes are detected during processing and
  play in a swipeable feed at `/shorts`.
- Notifications for new uploads from subscriptions, comments, replies, and
  new subscribers.

- Timestamps (`2:15`), `#hashtags`, and links in descriptions and comments
  are clickable; a description with `0:00 …` lines gets chapters.
- Pinned, editable, and reportable comments; replying to replies.
- Recommendations from your history, likes, and subscriptions; infinite
  scroll on the home feed; a mini-player that keeps playing while you browse.
- Channel analytics at `/studio/analytics`.

## Phase 4 — Safety and accounts

- Password reset at `/forgot-password`. Set `RESEND_API_KEY` and `EMAIL_FROM`
  to send real email; without them the reset link is printed in the dev
  server's console.
- Rate limits on sign-in, sign-up, password reset, comments, likes,
  subscriptions, playlists, uploads, and reports (in memory, per server; use a
  shared store such as Redis when running several servers).
- Reporting videos and comments, reviewed at `/admin/reports` by the accounts
  listed in `ADMIN_EMAILS`.

Sample videos are short generated clips in `public/samples`, so the seed data
works offline.

### Requirements

- Node.js 18.17 or newer
- npm
- PostgreSQL 14 or newer

### Configure and run

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to a PostgreSQL database you can create tables in.
3. Generate a secret, for example with `openssl rand -base64 32`, and set
   `NEXTAUTH_SECRET`. Keep this secret private.
4. For Google sign-in, create OAuth credentials and set `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. Set the authorized redirect URI to
   `http://localhost:3000/api/auth/callback/google`.
5. Install dependencies, apply the schema, and load sample content:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Email/password
registration and login are available without Google credentials. Google
sign-in appears when both Google environment variables are configured.

### Seed accounts

The seed creates one login for each sample creator, alongside 30 public video
records. The seeded accounts share this local-development password:

```text
StreamBoxDemo2026!
```

Example login: `theomakes@streambox.demo`. Do not reuse the sample password outside
local development.

### Database commands

```bash
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Create/apply a development migration
npm run db:deploy    # Apply migrations in a deployed environment
npm run db:seed      # Load or refresh sample users, channels, and videos
npm run db:studio    # Open Prisma Studio
```

`npm run db:push` is also available for disposable local databases where
migrations are not needed.

### Quality checks

```bash
npm run lint
npm run format:check
npm run build
```

## Project structure

```text
prisma/
  migrations/          Initial PostgreSQL migration
  schema.prisma        Application and NextAuth data models
  seed.ts              Sample user, channel, and video data
src/
  app/                 App Router pages and API routes
  components/          Site shell, auth forms, cards, and reusable UI
  data/                Local sample video content
  lib/                 Auth, Prisma client, and shared helpers
  types/               NextAuth session type augmentation
src/middleware.ts       Protected route gate
```

## License

Private project. Sample imagery is served from Unsplash URLs.
