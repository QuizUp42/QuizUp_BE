import { IsString, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  qrCodeUrl?: string;

  @IsString()
  @IsOptional()
  imageKey?: string;
}
