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
