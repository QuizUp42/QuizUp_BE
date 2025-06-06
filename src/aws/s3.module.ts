import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3Client,
      useFactory: (config: ConfigService) => {
        const region = config.get<string>('AWS_REGION')!;
        const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID')!;
        const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY')!;
        return new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
      },
      inject: [ConfigService],
    },
    S3Service,
  ],
  exports: [S3Service],
})
export class S3Module {}
