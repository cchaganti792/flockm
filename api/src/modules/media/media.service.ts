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

type PhotoRaw = {
  id: string;
  topicId: string;
  uploadedBy: string;
  imageUrl: string;
  caption: string | null;
  createdAt: Date;
  _count: { likes: number };
};

function formatPhoto(photo: PhotoRaw) {
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
