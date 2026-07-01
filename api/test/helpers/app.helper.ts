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
