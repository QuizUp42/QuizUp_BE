import { webcrypto } from 'crypto';
// Polyfill globalThis.crypto only if not already defined (Node v23+ provides Web Crypto API)
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { MeController } from './me/me.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './aws/s3.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { QuizModule } from './quiz/quiz.module';
import { RankingModule } from './ranking/ranking.module';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        dropSchema: process.env.NODE_ENV !== 'production',
        extra: {
          options: `-c timezone=Asia/Seoul`,
        },
        connectTimeoutMS: 10000,
      }),
    }),
    AuthModule,
    S3Module,
    RoomsModule,
    ChatModule,
    QuizModule,
    RankingModule,
  ],
  controllers: [AppController, MeController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}
  async onModuleInit() {
    await this.dataSource.query(`SET TIME ZONE 'Asia/Seoul';`);
  }
}
