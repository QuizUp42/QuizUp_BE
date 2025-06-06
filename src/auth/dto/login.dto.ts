import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  studentNo: string;

  @IsString()
  password: string;
}
