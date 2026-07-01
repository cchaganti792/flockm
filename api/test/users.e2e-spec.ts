import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
