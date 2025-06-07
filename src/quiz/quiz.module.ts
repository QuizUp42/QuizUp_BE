import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { Quiz } from './entities/quiz.entity';
import { Question } from './entities/question.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Quiz, Question])],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
