# NestJS Backend Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete NestJS REST API for flockm MVP v1 — auth, users, topics, and media modules with all v1 endpoints.

**Architecture:** Modular monolith — each domain (auth, users, topics, media) is a NestJS module with its own controller (HTTP layer), service (business logic), and DTOs (request validation). Shared JWT infrastructure lives in `shared/auth/` and is reused across all protected modules. E2E tests hit the real local Supabase DB — no mocks.

**Tech Stack:** NestJS 10+, Prisma 7, @nestjs/jwt, @nestjs/passport, passport-jwt, bcrypt, class-validator, class-transformer, Jest + Supertest (e2e)

## Global Constraints

- All modules live under `api/src/modules/`
- Shared auth infrastructure lives under `api/src/shared/auth/`
- PrismaService is globally available via DatabaseModule — never import DatabaseModule again in feature modules
- All protected routes use `JwtAuthGuard` from `api/src/shared/auth/jwt.guard.ts`
- All request bodies validated with `class-validator` DTOs — `ValidationPipe` is global
- JWT payload shape: `{ sub: string, username: string }` — `sub` is the account UUID
- Passwords hashed with `bcrypt`, salt rounds = 10
- JWT expiry: 7 days
- HTTP status codes: 201 for create, 200 for get/update, 204 for delete, 409 for conflict, 404 for not found, 401 for unauthorized
- Test emails must use `@flockm-test.com` domain so cleanup queries are safe
- Never return `passwordHash` from any endpoint
- TypeScript strict mode — no `any` types

---

## File Map

```
api/src/
  main.ts                                   MODIFY — add global ValidationPipe
  app.module.ts                             MODIFY — register all feature modules
  app.controller.ts                         DELETE — scaffold leftover
  app.controller.spec.ts                    DELETE — scaffold leftover
  app.service.ts                            DELETE — scaffold leftover

  shared/
    database/
      database.module.ts                    EXISTS (untouched)
      prisma.service.ts                     EXISTS (untouched)
    auth/
      jwt.strategy.ts                       CREATE — validates JWT, loads user from DB
      jwt.guard.ts                          CREATE — NestJS guard wrapping passport-jwt
      current-user.decorator.ts             CREATE — @CurrentUser() param decorator

  modules/
    auth/
      auth.module.ts                        CREATE
      auth.controller.ts                    CREATE — POST /auth/register, POST /auth/login
      auth.service.ts                       CREATE — register(), login()
      dto/
        register.dto.ts                     CREATE
        login.dto.ts                        CREATE

    users/
      users.module.ts                       CREATE
      users.controller.ts                   CREATE — GET /users/me
      users.service.ts                      CREATE — findMe()

    topics/
      topics.module.ts                      CREATE
      topics.controller.ts                  CREATE — GET /topics, GET /topics/:slug, POST/DELETE /topics/:slug/follow
      topics.service.ts                     CREATE — findAll(), findBySlug(), follow(), unfollow()

    media/
      media.module.ts                       CREATE
      media.controller.ts                   CREATE — GET /topics/:slug/photos, GET /photos/:id, POST/DELETE /photos/:id/like
      media.service.ts                      CREATE — findPhotosByTopic(), findPhoto(), likePhoto(), unlikePhoto()

api/test/
  auth.e2e-spec.ts                          CREATE
  users.e2e-spec.ts                         CREATE
  topics.e2e-spec.ts                        CREATE
  media.e2e-spec.ts                         CREATE
  helpers/
    app.helper.ts                           CREATE — shared test app setup + teardown
```

---

### Task 1: Cleanup, dependencies, and global setup

**Why:** Remove scaffold leftovers that add noise, install auth/validation packages, and enable global request validation so every endpoint validates its input automatically.

**Files:**
- Delete: `api/src/app.controller.ts`
- Delete: `api/src/app.controller.spec.ts`
- Delete: `api/src/app.service.ts`
- Modify: `api/src/main.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Produces: Global `ValidationPipe` active on all routes. `AppModule` no longer imports scaffold controllers/services. Packages available for all subsequent tasks.

- [ ] **Step 1: Delete scaffold files**

```bash
cd /path/to/flockm/api
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
```

Expected: packages added to `package.json` dependencies.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D @types/passport-jwt @types/bcrypt
```

- [ ] **Step 4: Add global ValidationPipe to `main.ts`**

Replace the contents of `api/src/main.ts`:
```typescript
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,      // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true,      // auto-transform types (string→number etc)
    }),
  );
  await app.listen(3000);
}
bootstrap();
```

- [ ] **Step 5: Clean up `app.module.ts`**

Replace contents of `api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
```

(Feature modules will be added in later tasks.)

- [ ] **Step 6: Verify build still passes**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove scaffold, install auth packages, add global ValidationPipe"
```

---

### Task 2: Shared JWT auth infrastructure

**Why:** `JwtStrategy`, `JwtAuthGuard`, and `@CurrentUser()` are used by every protected module. Building them once in `shared/auth/` means no duplication. The strategy validates the token and loads the minimal user shape needed by controllers.

**Files:**
- Create: `api/src/shared/auth/jwt.strategy.ts`
- Create: `api/src/shared/auth/jwt.guard.ts`
- Create: `api/src/shared/auth/current-user.decorator.ts`

**Interfaces:**
- Produces:
  - `JwtAuthGuard` — apply with `@UseGuards(JwtAuthGuard)` on any controller/route
  - `@CurrentUser()` — param decorator returning `{ id: string, username: string }` (the JWT payload)
  - `AuthenticatedUser` type — `{ id: string; username: string }`

- [ ] **Step 1: Write failing test for JWT guard**

Create `api/test/helpers/app.helper.ts`:
```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/database/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function cleanTestAccounts(prisma: PrismaService): Promise<void> {
  await prisma.photoLike.deleteMany({ where: { user: { email: { endsWith: '@flockm-test.com' } } } });
  await prisma.topicFollow.deleteMany({ where: { user: { email: { endsWith: '@flockm-test.com' } } } });
  await prisma.photo.deleteMany({ where: { uploader: { email: { endsWith: '@flockm-test.com' } } } });
  await prisma.account.deleteMany({ where: { email: { endsWith: '@flockm-test.com' } } });
}
```

- [ ] **Step 2: Create `AuthenticatedUser` type and `JwtStrategy`**

Create `api/src/shared/auth/jwt.strategy.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AuthenticatedUser {
  id: string;
  username: string;
}

interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is not set'); })(),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.username) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, username: payload.username };
  }
}
```

- [ ] **Step 3: Create `JwtAuthGuard`**

Create `api/src/shared/auth/jwt.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4: Create `@CurrentUser()` decorator**

Create `api/src/shared/auth/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared JWT strategy, guard, and CurrentUser decorator"
```

---

### Task 3: Auth module — register and login

**Why:** Auth is the foundation — every other module depends on being able to create and authenticate a user. Register hashes the password and returns a JWT. Login verifies credentials and returns a JWT. Both endpoints are public (no guard).

**Files:**
- Create: `api/src/modules/auth/dto/register.dto.ts`
- Create: `api/src/modules/auth/dto/login.dto.ts`
- Create: `api/src/modules/auth/auth.service.ts`
- Create: `api/src/modules/auth/auth.controller.ts`
- Create: `api/src/modules/auth/auth.module.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (global), `JwtStrategy` (from Task 2)
- Produces:
  - `POST /auth/register` → `{ access_token: string }`
  - `POST /auth/login` → `{ access_token: string }`
  - `AuthService.generateToken(account: { id: string; username: string }): string` — used by AuthService internally

- [ ] **Step 1: Write failing e2e tests**

Create `api/test/auth.e2e-spec.ts`:
```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestApp, cleanTestAccounts } from './helpers/app.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await cleanTestAccounts(prisma);
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates account and returns access_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'register@flockm-test.com', username: 'testregister', password: 'password123' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(typeof res.body.access_token).toBe('string');
    });

    it('returns 409 when email already taken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'duplicate@flockm-test.com', username: 'user1dup', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'duplicate@flockm-test.com', username: 'user2dup', password: 'password123' })
        .expect(409);
    });

    it('returns 409 when username already taken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user1@flockm-test.com', username: 'sameusername', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user2@flockm-test.com', username: 'sameusername', password: 'password123' })
        .expect(409);
    });

    it('returns 400 when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', username: 'user', password: 'password123' })
        .expect(400);
    });

    it('returns 400 when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@flockm-test.com', username: 'shortpw', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login@flockm-test.com', username: 'loginuser', password: 'password123' });
    });

    it('returns access_token with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@flockm-test.com', password: 'password123' })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
    });

    it('returns 401 with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@flockm-test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@flockm-test.com', password: 'password123' })
        .expect(401);
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd api
npx jest test/auth.e2e-spec.ts --config jest-e2e.json
```
Expected: FAIL — `Cannot GET /auth/register`

- [ ] **Step 3: Create DTOs**

Create `api/src/modules/auth/dto/register.dto.ts`:
```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username can only contain letters, numbers and underscores' })
  username: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Create `api/src/modules/auth/dto/login.dto.ts`:
```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

- [ ] **Step 4: Create `AuthService`**

Create `api/src/modules/auth/auth.service.ts`:
```typescript
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ access_token: string }> {
    const existing = await this.prisma.account.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      if (existing.email === dto.email) throw new ConflictException('Email already in use');
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const account = await this.prisma.account.create({
      data: { email: dto.email, username: dto.username, passwordHash },
    });

    return { access_token: this.generateToken(account) };
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });

    if (!account) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, account.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { access_token: this.generateToken(account) };
  }

  private generateToken(account: { id: string; username: string }): string {
    return this.jwt.sign({ sub: account.id, username: account.username });
  }
}
```

- [ ] **Step 5: Create `AuthController`**

Create `api/src/modules/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ access_token: string }> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ access_token: string }> {
    return this.authService.login(dto);
  }
}
```

- [ ] **Step 6: Create `AuthModule`**

Create `api/src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../../shared/auth/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is not set'); })(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
```

- [ ] **Step 7: Register `AuthModule` in `AppModule`**

Update `api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
})
export class AppModule {}
```

- [ ] **Step 8: Run tests — confirm they pass**

```bash
npx jest test/auth.e2e-spec.ts --config jest-e2e.json
```
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add auth module with register and login endpoints"
```

---

### Task 4: Users module — GET /users/me

**Why:** The simplest protected endpoint — confirms the JWT guard works end-to-end and gives the client a way to load the logged-in user's profile.

**Files:**
- Create: `api/src/modules/users/users.service.ts`
- Create: `api/src/modules/users/users.controller.ts`
- Create: `api/src/modules/users/users.module.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/users.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `@CurrentUser()`, `PrismaService`
- Produces:
  - `GET /users/me` → `{ id, email, username, avatarUrl, tier, createdAt }`

- [ ] **Step 1: Write failing e2e tests**

Create `api/test/users.e2e-spec.ts`:
```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestApp, cleanTestAccounts } from './helpers/app.helper';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'me@flockm-test.com', username: 'meuser', password: 'password123' });
    token = res.body.access_token as string;
  });

  afterAll(async () => {
    await cleanTestAccounts(prisma);
    await app.close();
  });

  it('GET /users/me returns profile for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.email).toBe('me@flockm-test.com');
    expect(res.body.username).toBe('meuser');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('GET /users/me returns 401 without token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx jest test/users.e2e-spec.ts --config jest-e2e.json
```
Expected: FAIL — `Cannot GET /users/me`

- [ ] **Step 3: Create `UsersService`**

Create `api/src/modules/users/users.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        tier: true,
        createdAt: true,
      },
    });

    if (!account) throw new NotFoundException('User not found');
    return account;
  }
}
```

- [ ] **Step 4: Create `UsersController`**

Create `api/src/modules/users/users.controller.ts`:
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.id);
  }
}
```

- [ ] **Step 5: Create `UsersModule`**

Create `api/src/modules/users/users.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6: Register in `AppModule`**

Update `api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule],
})
export class AppModule {}
```

- [ ] **Step 7: Run tests — confirm they pass**

```bash
npx jest test/users.e2e-spec.ts --config jest-e2e.json
```
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add users module with GET /users/me endpoint"
```

---

### Task 5: Topics module

**Why:** Topics are the core social entity in flockm. Users browse, view, and follow topics. GET endpoints are public so users can see topics before registering. Follow/unfollow requires auth.

**Files:**
- Create: `api/src/modules/topics/topics.service.ts`
- Create: `api/src/modules/topics/topics.controller.ts`
- Create: `api/src/modules/topics/topics.module.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/topics.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `@CurrentUser()`, `PrismaService`
- Produces:
  - `GET /topics` → `Array<{ id, name, slug, coverImageUrl, createdAt }>`
  - `GET /topics/:slug` → `{ id, name, slug, coverImageUrl, createdAt }`
  - `POST /topics/:slug/follow` → `{ followedAt }`
  - `DELETE /topics/:slug/follow` → 204 No Content

- [ ] **Step 1: Write failing e2e tests**

Create `api/test/topics.e2e-spec.ts`:
```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestApp, cleanTestAccounts } from './helpers/app.helper';

describe('Topics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'topics@flockm-test.com', username: 'topicsuser', password: 'password123' });
    token = res.body.access_token as string;
  });

  afterAll(async () => {
    await cleanTestAccounts(prisma);
    await app.close();
  });

  describe('GET /topics', () => {
    it('returns list of topics without auth', async () => {
      const res = await request(app.getHttpServer()).get('/topics').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('slug');
    });
  });

  describe('GET /topics/:slug', () => {
    it('returns a topic by slug', async () => {
      const res = await request(app.getHttpServer()).get('/topics/nature').expect(200);
      expect(res.body.slug).toBe('nature');
      expect(res.body.name).toBe('Nature');
    });

    it('returns 404 for unknown slug', async () => {
      await request(app.getHttpServer()).get('/topics/does-not-exist').expect(404);
    });
  });

  describe('POST /topics/:slug/follow', () => {
    it('follows a topic', async () => {
      const res = await request(app.getHttpServer())
        .post('/topics/nature/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.followedAt).toBeDefined();
    });

    it('returns 409 when already following', async () => {
      await request(app.getHttpServer())
        .post('/topics/nature/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).post('/topics/nature/follow').expect(401);
    });
  });

  describe('DELETE /topics/:slug/follow', () => {
    it('unfollows a topic', async () => {
      await request(app.getHttpServer())
        .delete('/topics/nature/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when not following', async () => {
      await request(app.getHttpServer())
        .delete('/topics/nature/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx jest test/topics.e2e-spec.ts --config jest-e2e.json
```
Expected: FAIL — `Cannot GET /topics`

- [ ] **Step 3: Create `TopicsService`**

Create `api/src/modules/topics/topics.service.ts`:
```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.topic.findMany({
      select: { id: true, name: true, slug: true, coverImageUrl: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, coverImageUrl: true, createdAt: true },
    });
    if (!topic) throw new NotFoundException(`Topic '${slug}' not found`);
    return topic;
  }

  async follow(slug: string, userId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { slug } });
    if (!topic) throw new NotFoundException(`Topic '${slug}' not found`);

    const existing = await this.prisma.topicFollow.findUnique({
      where: { userId_topicId: { userId, topicId: topic.id } },
    });
    if (existing) throw new ConflictException('Already following this topic');

    return this.prisma.topicFollow.create({
      data: { userId, topicId: topic.id },
      select: { followedAt: true },
    });
  }

  async unfollow(slug: string, userId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { slug } });
    if (!topic) throw new NotFoundException(`Topic '${slug}' not found`);

    const existing = await this.prisma.topicFollow.findUnique({
      where: { userId_topicId: { userId, topicId: topic.id } },
    });
    if (!existing) throw new NotFoundException('Not following this topic');

    await this.prisma.topicFollow.delete({
      where: { userId_topicId: { userId, topicId: topic.id } },
    });
  }
}
```

- [ ] **Step 4: Create `TopicsController`**

Create `api/src/modules/topics/topics.controller.ts`:
```typescript
import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  findAll() {
    return this.topicsService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.topicsService.findBySlug(slug);
  }

  @Post(':slug/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.topicsService.follow(slug, user.id);
  }

  @Delete(':slug/follow')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.topicsService.unfollow(slug, user.id);
  }
}
```

- [ ] **Step 5: Create `TopicsModule`**

Create `api/src/modules/topics/topics.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule {}
```

- [ ] **Step 6: Register in `AppModule`**

Update `api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TopicsModule } from './modules/topics/topics.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, TopicsModule],
})
export class AppModule {}
```

- [ ] **Step 7: Run tests — confirm they pass**

```bash
npx jest test/topics.e2e-spec.ts --config jest-e2e.json
```
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add topics module with list, get, follow, and unfollow endpoints"
```

---

### Task 6: Media module — photos and likes

**Why:** Photos are the core content unit. Users browse photos by topic (the main feed) and like individual photos. All media endpoints require auth — we don't want anonymous browsing in v1.

**Files:**
- Create: `api/src/modules/media/media.service.ts`
- Create: `api/src/modules/media/media.controller.ts`
- Create: `api/src/modules/media/media.module.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/media.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `@CurrentUser()`, `PrismaService`
- Produces:
  - `GET /topics/:slug/photos?page=1&limit=20` → `{ data: Array<Photo>, total: number, page: number, limit: number }`
  - `GET /photos/:id` → `{ id, topicId, uploadedBy, imageUrl, caption, createdAt, likesCount }`
  - `POST /photos/:id/like` → `{ likedAt }`
  - `DELETE /photos/:id/like` → 204 No Content
  - Photo shape: `{ id, topicId, uploadedBy, imageUrl, caption, createdAt, likesCount }`

- [ ] **Step 1: Write failing e2e tests**

Create `api/test/media.e2e-spec.ts`:
```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestApp, cleanTestAccounts } from './helpers/app.helper';

describe('Media (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let photoId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'media@flockm-test.com', username: 'mediauser', password: 'password123' });
    token = res.body.access_token as string;

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);
    userId = me.body.id as string;

    const topic = await prisma.topic.findUnique({ where: { slug: 'nature' } });
    const photo = await prisma.photo.create({
      data: {
        topicId: topic!.id,
        uploadedBy: userId,
        imageUrl: 'https://example.com/test-photo.jpg',
        caption: 'Test photo',
      },
    });
    photoId = photo.id;
  });

  afterAll(async () => {
    await prisma.photoLike.deleteMany({ where: { photoId } });
    await prisma.photo.deleteMany({ where: { id: photoId } });
    await cleanTestAccounts(prisma);
    await app.close();
  });

  describe('GET /topics/:slug/photos', () => {
    it('returns paginated photos for a topic', async () => {
      const res = await request(app.getHttpServer())
        .get('/topics/nature/photos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/topics/nature/photos').expect(401);
    });

    it('returns 404 for unknown topic', async () => {
      await request(app.getHttpServer())
        .get('/topics/does-not-exist/photos')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /photos/:id', () => {
    it('returns a photo with likesCount', async () => {
      const res = await request(app.getHttpServer())
        .get(`/photos/${photoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(photoId);
      expect(res.body.likesCount).toBe(0);
      expect(res.body.imageUrl).toBe('https://example.com/test-photo.jpg');
    });

    it('returns 404 for unknown photo', async () => {
      await request(app.getHttpServer())
        .get('/photos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /photos/:id/like', () => {
    it('likes a photo', async () => {
      const res = await request(app.getHttpServer())
        .post(`/photos/${photoId}/like`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.likedAt).toBeDefined();
    });

    it('returns 409 when already liked', async () => {
      await request(app.getHttpServer())
        .post(`/photos/${photoId}/like`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('DELETE /photos/:id/like', () => {
    it('unlikes a photo', async () => {
      await request(app.getHttpServer())
        .delete(`/photos/${photoId}/like`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 404 when not liked', async () => {
      await request(app.getHttpServer())
        .delete(`/photos/${photoId}/like`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx jest test/media.e2e-spec.ts --config jest-e2e.json
```
Expected: FAIL — `Cannot GET /topics/nature/photos`

- [ ] **Step 3: Create `MediaService`**

Create `api/src/modules/media/media.service.ts`:
```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

const photoSelect = {
  id: true,
  topicId: true,
  uploadedBy: true,
  imageUrl: true,
  caption: true,
  createdAt: true,
  _count: { select: { likes: true } },
};

function formatPhoto(photo: { id: string; topicId: string; uploadedBy: string; imageUrl: string; caption: string | null; createdAt: Date; _count: { likes: number } }) {
  const { _count, ...rest } = photo;
  return { ...rest, likesCount: _count.likes };
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findPhotosByTopic(slug: string, page: number, limit: number) {
    const topic = await this.prisma.topic.findUnique({ where: { slug } });
    if (!topic) throw new NotFoundException(`Topic '${slug}' not found`);

    const skip = (page - 1) * limit;
    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where: { topicId: topic.id },
        select: photoSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.photo.count({ where: { topicId: topic.id } }),
    ]);

    return { data: photos.map(formatPhoto), total, page, limit };
  }

  async findPhoto(id: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
      select: photoSelect,
    });
    if (!photo) throw new NotFoundException('Photo not found');
    return formatPhoto(photo);
  }

  async likePhoto(photoId: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');

    const existing = await this.prisma.photoLike.findUnique({
      where: { userId_photoId: { userId, photoId } },
    });
    if (existing) throw new ConflictException('Already liked this photo');

    return this.prisma.photoLike.create({
      data: { userId, photoId },
      select: { likedAt: true },
    });
  }

  async unlikePhoto(photoId: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');

    const existing = await this.prisma.photoLike.findUnique({
      where: { userId_photoId: { userId, photoId } },
    });
    if (!existing) throw new NotFoundException('Photo not liked');

    await this.prisma.photoLike.delete({
      where: { userId_photoId: { userId, photoId } },
    });
  }
}
```

- [ ] **Step 4: Create `MediaController`**

Create `api/src/modules/media/media.controller.ts`:
```typescript
import { Controller, Get, Post, Delete, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { MediaService } from './media.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('topics/:slug/photos')
  findPhotosByTopic(
    @Param('slug') slug: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.mediaService.findPhotosByTopic(slug, Number(page), Number(limit));
  }

  @Get('photos/:id')
  findPhoto(@Param('id') id: string) {
    return this.mediaService.findPhoto(id);
  }

  @Post('photos/:id/like')
  likePhoto(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.likePhoto(id, user.id);
  }

  @Delete('photos/:id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlikePhoto(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.unlikePhoto(id, user.id);
  }
}
```

- [ ] **Step 5: Create `MediaModule`**

Create `api/src/modules/media/media.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
```

- [ ] **Step 6: Register in `AppModule`**

Update `api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TopicsModule } from './modules/topics/topics.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, TopicsModule, MediaModule],
})
export class AppModule {}
```

- [ ] **Step 7: Run all tests**

```bash
npx jest --config jest-e2e.json
```
Expected: All tests across all 4 spec files PASS.

- [ ] **Step 8: Run build to confirm no TS errors**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add media module with photo feed and like endpoints"
```

---

## Self-Review

**Spec coverage:**
- ✅ `POST /auth/register` — Task 3
- ✅ `POST /auth/login` — Task 3
- ✅ `GET /users/me` — Task 4
- ✅ `GET /topics` — Task 5
- ✅ `GET /topics/:slug` — Task 5
- ✅ `POST /topics/:slug/follow` — Task 5
- ✅ `DELETE /topics/:slug/follow` — Task 5
- ✅ `GET /topics/:slug/photos` — Task 6
- ✅ `GET /photos/:id` — Task 6
- ✅ `POST /photos/:id/like` — Task 6
- ✅ `DELETE /photos/:id/like` — Task 6

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:**
- `AuthenticatedUser` defined in Task 2 (`jwt.strategy.ts`), used in Tasks 3–6 ✅
- `photoSelect` and `formatPhoto` defined and used within Task 6 ✅
- `userId_topicId` composite key name matches Prisma schema (`@@id([userId, topicId])`) ✅
- `userId_photoId` composite key name matches Prisma schema (`@@id([userId, photoId])`) ✅
