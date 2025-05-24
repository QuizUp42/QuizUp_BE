import { webcrypto } from 'crypto';
// Polyfill globalThis.crypto only if not already defined (Node v23+ provides Web Crypto API)
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // HTTP 쿠키 파싱 (refresh token 쿠키 활용)
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
