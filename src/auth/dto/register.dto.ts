import { IsString, IsIn } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsIn(['student', 'professor'])
  role: 'student' | 'professor';

  @IsString()
  studentNo: string;

  @IsString()
  password: string;
}
