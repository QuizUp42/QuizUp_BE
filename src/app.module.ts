import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { QuizModule } from './quiz/quiz.module';
import { RankingModule } from './ranking/ranking.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [AuthModule, RoomsModule, ChatModule, QuizModule, RankingModule, ConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
