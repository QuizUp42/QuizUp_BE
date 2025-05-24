import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StudentsGateway } from './students.gateway';
import { TeachersGateway } from './teachers.gateway';
import { ChatService } from './chat.service';
import { FeatureService } from './feature.service';
import { WsJwtAuthGuard } from '../auth/ws-jwt.guard';
import { WsRolesGuard } from '../auth/ws-roles.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatController } from './chat.controller';
import { QuizService } from './quiz.service';
import { Message } from './entities/message.entity';

@Module({
  imports: [RoomsModule, TypeOrmModule.forFeature([Message])],
  controllers: [ChatController],
  providers: [
    StudentsGateway,
    TeachersGateway,
    ChatService,
    FeatureService,
    WsJwtAuthGuard,
    WsRolesGuard,
    QuizService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
