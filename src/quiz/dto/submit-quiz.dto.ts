import { IsString } from 'class-validator';

export class SubmitQuizDto {
  @IsString()
  answer: string;
}
