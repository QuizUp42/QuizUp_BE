import { IsString, IsInt, IsIn, IsOptional } from 'class-validator';

export class AnswerOxQuizDto {
  @IsString()
  room: string;

  @IsInt()
  quizId: number;

  @IsIn(['O', 'X'])
  @IsOptional()
  answer?: 'O' | 'X';
}
