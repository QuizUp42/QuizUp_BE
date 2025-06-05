import { Module, forwardRef } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { ProfessorProfile } from '../auth/entities/professor-profile.entity';
import { StudentProfile } from '../auth/entities/student-profile.entity';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, ProfessorProfile, StudentProfile]),
    forwardRef(() => ChatModule),
    AuthModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
