import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the api directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  const topics = [
    { name: 'Nature', slug: 'nature', coverImageUrl: null },
    { name: 'Architecture', slug: 'architecture', coverImageUrl: null },
    { name: 'Travel', slug: 'travel', coverImageUrl: null },
    { name: 'Food', slug: 'food', coverImageUrl: null },
    { name: 'Street Photography', slug: 'street-photography', coverImageUrl: null },
  ];

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {},
      create: topic,
    });
  }

  console.log('Seeded topics:', topics.map((t) => t.slug).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
