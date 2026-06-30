# flockm — Project Roadmap

---

## Plan 1 — Environment + DB Schema ✅

- ✅ Install prerequisites (Docker, Supabase CLI, Node.js, NestJS CLI)
- ✅ Initialize Supabase local environment
- ✅ Scaffold NestJS API (`api/`)
- ✅ Install and configure Prisma with multiSchema
- ✅ Write Prisma schema (user, topic, media, chat schemas — 5 tables)
- ✅ Run migrations and verify tables
- ✅ Seed curated topics (Nature, Architecture, Travel, Food, Street Photography)
- ✅ `./dev.sh` startup script
- ✅ `docs/SETUP.md` onboarding guide

---

## Plan 2 — NestJS Backend ⬜

Build modules in this order — each depends on the previous:

- ⬜ `auth` module — `POST /auth/register`, `POST /auth/login`, JWT
- ⬜ `users` module — `GET /users/me` (protected route)
- ⬜ `topics` module — `GET /topics`, `GET /topics/:slug`, `POST /topics/:slug/follow`, `DELETE /topics/:slug/follow`
- ⬜ `media` module — `GET /topics/:slug/photos`, `GET /photos/:id`, `POST /photos/:id/like`, `DELETE /photos/:id/like`

---

## Plan 3 — React Native App (Expo) ⬜

- ⬜ Project scaffold (Expo + TypeScript)
- ⬜ Login screen
- ⬜ Signup screen
- ⬜ Home feed (photos from followed topics)
- ⬜ Topic page (photo grid)
- ⬜ Photo detail + like
- ⬜ Profile screen

---

## Plan 4 — Deploy Backend ⬜

- ⬜ Set up Supabase cloud project (PostgreSQL + Storage)
- ⬜ Run migrations against cloud DB
- ⬜ Dockerize NestJS API
- ⬜ Deploy to DigitalOcean (or similar VPS)
- ⬜ Configure Nginx + HTTPS/SSL
- ⬜ Set production environment variables

---

## Plan 5 — Internal Testing ⬜

- ⬜ Distribute via TestFlight (iOS)
- ⬜ Distribute via Android internal track
- ⬜ Test with 5–20 users
- ⬜ Fix login, upload, feed, and crash issues

---

## Plan 6 — App Store Submission ⬜

- ⬜ Submit to Apple App Store
- ⬜ Submit to Google Play Store

---

## Plan 7 — Post-Launch Improvements ⬜

- ⬜ Comments / discussions under photos
- ⬜ Video support
- ⬜ Push notifications
- ⬜ Search
- ⬜ Reporting / blocking
- ⬜ Analytics
- ⬜ Background workers (image processing, thumbnails)
- ⬜ Redis (if performance requires it)
- ⬜ User-created topics
