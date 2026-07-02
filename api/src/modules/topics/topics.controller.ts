import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
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
