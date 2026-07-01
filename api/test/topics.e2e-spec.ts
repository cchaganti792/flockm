import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
