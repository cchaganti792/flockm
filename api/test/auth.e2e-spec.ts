import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
