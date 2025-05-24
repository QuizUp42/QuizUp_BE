import { IsString, IsIn } from 'class-validator';

export class UpdateFeatureDto {
  @IsString()
  room: string;

  @IsString()
  featureId: string;

  @IsIn(['raffle', 'check', 'ox'])
  type: 'raffle' | 'check' | 'ox';

  @IsString()
  newState: string | boolean;

  @IsString()
  userId: string;
} 