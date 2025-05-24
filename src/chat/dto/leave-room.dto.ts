import { IsString } from 'class-validator';

export class LeaveRoomDto {
  @IsString()
  roomCode: string;
}
