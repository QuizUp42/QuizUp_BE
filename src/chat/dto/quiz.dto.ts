import { IsString, IsInt, IsBoolean } from 'class-validator';

export class QuizDto {
  @IsString()
  room: string;

  @IsString()
  quizId: string;

  @IsString()
  quizName: string;

  @IsInt()
  quizCount: number;

  @IsBoolean()
  isSubmit: boolean;

  @IsString()
  userId: string;
} 