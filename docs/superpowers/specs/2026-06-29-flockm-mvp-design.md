# flockm MVP v1 — Design Spec

**Date:** 2026-06-29
**Scope:** v1 only — account creation, topic following, photo viewing and liking

---

## 1. Product Concept

flockm is a visual social media app where users follow **topics** instead of people. A topic page works like an Instagram profile — it has tabs for Photos and Videos, users scroll through content, and can like posts. The feed is built from topics the user follows.

- **Not Reddit** — minimal text, visual-first
- **Not Instagram** — no person-to-person following
- **Core loop:** Follow topics → see photos → like them

---

## 2. MVP v1 Feature Scope

**In scope:**
- User account creation and login
- User profile (basic)
- Browse curated topics
- Follow / unfollow topics
- Photo feed from followed topics
- View photos under a topic (grid layout)
- Like / unlike a photo

**Explicitly out of scope for v1:**
- Videos
- Comments / discussions
- Direct messages
- Search
- Notifications
- User-created topics
- Admin dashboard

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo + React Native (TypeScript) |
| Backend | Node.js + NestJS (TypeScript) |
| ORM | Prisma (multiSchema enabled) |
| Database | PostgreSQL via Supabase |
| Realtime | Supabase Realtime (future) |
| Storage | Supabase Storage + CDN |
| Auth | JWT (NestJS + Passport) |

**Deferred (post-MVP):** Redis, FFmpeg, background workers, microservices

---

## 4. Architecture — Modular Monolith

Single Node.js API with internal NestJS modules. No microservices until a specific bottleneck is identified at scale.

```
src/
  modules/
    auth/
    users/
    topics/
    media/
  shared/
    database/      ← PrismaService
    storage/       ← Supabase Storage client
    utils/
```

**Scaling phases:**
- Phase 1 (0–10k users): Single API, single DB
- Phase 2 (10k–100k): Add Redis + background workers
- Phase 3 (100k–1M): Extract bottleneck module only

---

## 5. Database Design

PostgreSQL schemas map 1:1 to NestJS modules. All tables namespaced by schema — never use `public`.

### Schema: `user`
```
user.accounts
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  email         TEXT UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  username      TEXT UNIQUE NOT NULL
  avatar_url    TEXT
  tier          TEXT NOT NULL DEFAULT 'free'   -- 'free' | 'paid'
  created_at    TIMESTAMPTZ DEFAULT now()

user.sessions   (if refresh token tracking needed)
  id            UUID PRIMARY KEY
  user_id       UUID REFERENCES user.accounts(id)
  token_hash    TEXT NOT NULL
  expires_at    TIMESTAMPTZ NOT NULL
  created_at    TIMESTAMPTZ DEFAULT now()
```

### Schema: `topic`
```
topic.topics
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL
  slug            TEXT UNIQUE NOT NULL
  cover_image_url TEXT
  created_at      TIMESTAMPTZ DEFAULT now()

topic.follows
  user_id     UUID REFERENCES user.accounts(id)
  topic_id    UUID REFERENCES topic.topics(id)
  followed_at TIMESTAMPTZ DEFAULT now()
  PRIMARY KEY (user_id, topic_id)
```

### Schema: `media`
```
media.photos
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  topic_id    UUID REFERENCES topic.topics(id)
  uploaded_by UUID REFERENCES user.accounts(id)
  image_url   TEXT NOT NULL
  caption     TEXT
  created_at  TIMESTAMPTZ DEFAULT now()

media.photo_likes
  user_id  UUID REFERENCES user.accounts(id)
  photo_id UUID REFERENCES media.photos(id)
  liked_at TIMESTAMPTZ DEFAULT now()
  PRIMARY KEY (user_id, photo_id)
```

### Schema: `chat` *(empty in v1 — reserved)*

---

## 6. API Endpoints (v1)

```
# Auth
POST   /auth/register          create account
POST   /auth/login             login, return JWT

# Users
GET    /users/me               get own profile

# Topics
GET    /topics                 list all curated topics
GET    /topics/:slug           get topic detail + cover image
POST   /topics/:slug/follow    follow a topic
DELETE /topics/:slug/follow    unfollow a topic

# Photos
GET    /topics/:slug/photos    paginated photo feed for a topic
GET    /photos/:id             single photo detail
POST   /photos/:id/like        like a photo
DELETE /photos/:id/like        unlike a photo
```

---

## 7. Mobile Screens (v1)

1. **Login** — email + password
2. **Signup** — email, username, password
3. **Home Feed** — photos from followed topics, infinite scroll
4. **Topic Page** — cover image, photo grid (like Instagram profile grid)
5. **Photo Detail** — full image, caption, like button
6. **Profile** — avatar, username, followed topics list

---

## 8. Monetization

| Tier | Posting limit |
|------|--------------|
| Free | Limited posts (count TBD) |
| Paid | Unlimited posts |

Tier stored on `user.accounts.tier`. Enforced at the API layer on upload endpoints.

---

## 9. Developer Experience

- Prisma query logging always enabled in development:
  ```typescript
  new PrismaClient({ log: ['query', 'info', 'warn', 'error'] })
  ```
- `DEBUG=prisma:query` in `.env.development`
- Production: log `['warn', 'error']` only

---

## 10. Development Sequence

1. Prisma schema + DB migrations
2. NestJS backend (auth → users → topics → media)
3. React Native app (screens against real API)
4. Deploy backend (Docker + Nginx + DigitalOcean)
5. Internal testing (TestFlight + Android internal track)
6. App Store submission
