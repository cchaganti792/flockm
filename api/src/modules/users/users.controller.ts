import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.id);
  }
}
