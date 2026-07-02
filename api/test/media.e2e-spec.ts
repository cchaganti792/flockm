import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
