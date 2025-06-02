import { IsString, IsInt, IsIn } from 'class-validator';

export class AnswerOxQuizDto {
  @IsString()
  room: string;

  @IsInt()
  quizId: number;

  @IsIn(['O', 'X'])
  answer: 'O' | 'X';
} 