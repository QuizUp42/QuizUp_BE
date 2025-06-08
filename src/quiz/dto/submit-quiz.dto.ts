import { IsArray, IsString } from 'class-validator';

export class SubmitQuizDto {
  @IsArray()
  @IsString({ each: true })
  answers: string[];
}
