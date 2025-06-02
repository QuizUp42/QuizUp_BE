import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StudentsGateway } from './students.gateway';
import { TeachersGateway } from './teachers.gateway';
import { ChatService } from './chat.service';
import { FeatureService } from './feature.service';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt.guard';
import { WsRolesGuard } from '../auth/guards/ws-roles.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatController } from './chat.controller';
import { QuizService } from './quiz.service';
import { Message } from './entities/message.entity';
import { Draw } from './entities/draw.entity';
import { OxQuiz } from './entities/ox-quiz.entity';
import { Check } from './entities/check.entity';

@Module({
  imports: [
    forwardRef(() => RoomsModule),
    TypeOrmModule.forFeature([Message, Draw, OxQuiz, Check]),
    AuthModule,
  ],
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
