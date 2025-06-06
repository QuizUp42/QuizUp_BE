import { IsString } from 'class-validator';

export class ChatSendDto {
  @IsString()
  room: string;

  @IsString()
  text: string;
}
