import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
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
