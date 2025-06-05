import { IsString } from 'class-validator';

export class JoinRoomWithUsernameDto {
  @IsString()
  room: string;
} 