# LiveEarth

> 此刻，地球最好一幕。
>
> The best view on Earth, right now.

LiveEarth is an AI-directed global live channel. It accepts explicitly licensed camera feeds, checks their health, analyses current frames, and publishes a stable five-minute ranking across Earth, Storm, Ocean, and Night.

## What is implemented

- Cinematic bilingual broadcast experience with a 45-second auto tour, Top 10 programme rail, keyboard controls, original-audio consent, and honest empty states.
- Three.js globe that is loaded only when opened and flies to ranked locations, with reduced-motion handling.
- Channel editions, scene dossiers, 24-hour score history, local favorites/history, optional Supabase magic-link/Google sign-in with server-side session refresh, and complete account deletion.
- Protected operations UI and validated feed-rights contract.
- Feed registration creates the private source and its unpublished scene together; the scene only becomes public after a healthy probe and fresh AI analysis.
- Versioned ranking, scene, globe, favorites, history, admin, and health APIs.
- Supabase schema with row-level security, confidential feed URLs, immutable ranking snapshots, and account data ownership.
- Container worker contracts for FFprobe health checks, FFmpeg contact sheets, Open-Meteo evidence, OpenAI structured vision analysis, Cloudflare Stream inputs, and BullMQ scheduling.

Development fixtures are presentation-only still images. They are enabled by default under `next dev` and are hard-disabled whenever `NODE_ENV=production`; production never substitutes fixtures for unavailable live footage.

## Repository

```text
apps/web       Next.js product and API
apps/worker    Feed health, analysis and ranking worker
packages/domain Shared contracts, schemas and ranking rules
supabase       Database migration and RLS policies
```

## Local development

Requirements: Node 22+, Corepack, and optional Docker for Redis.

```bash
cp apps/web/.env.local.example apps/web/.env.local
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000/en` or `/zh`. To exercise the queue locally, start Redis and then the worker with fully configured service credentials:

```bash
docker compose up -d redis
cp apps/worker/.env.example apps/worker/.env
corepack pnpm dev:worker
```

Fill the worker file before starting it. The root `.env.example` is the combined deployment reference; each local process reads the environment file beside its app.

## Verification

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:run
corepack pnpm build
```

## Production prerequisites

1. Apply `supabase/migrations/001_liveearth.sql`, add the first operator to `admin_users`, and configure Supabase email/OAuth redirects.
2. Configure the environment values in `.env.example` in Vercel and the worker runtime; never expose service-role, ingest, Redis, OpenAI, weather, or Cloudflare credentials to the browser.
3. Register at least 12 feeds with written rights to display, transcode, analyse frames, publish derived metadata, and retain technical frames for the declared period. Each registration needs a private ingest URL, public HTTPS HLS playback manifest, and verified HTTPS poster frame.
4. Connect operators to the Cloudflare SRT/RTMPS input or run an authorised FFmpeg relay for pull-based RTSP/HLS sources. Queue concurrency is globally pinned to one edition/probe job so scene health and analysis writes stay ordered across worker replicas.
5. Complete the seven-day source stability gate before public launch. An empty real channel is expected and preferable to archive footage presented as live.

The worker requires `ffmpeg` and `ffprobe`; the provided Dockerfile installs both. Cloud services are not provisioned automatically by this repository.
