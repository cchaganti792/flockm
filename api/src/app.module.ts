import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TopicsModule } from './modules/topics/topics.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, TopicsModule],
})
export class AppModule {}
