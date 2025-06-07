import { IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QuizDto {
  @IsString()
  room: string;

  @Type(() => Number)
  @IsNumber()
  quizId: number;
}
