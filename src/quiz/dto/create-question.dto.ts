import { IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  question: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  choices: string[];

  @IsString()
  correctAnswer: string;
}
