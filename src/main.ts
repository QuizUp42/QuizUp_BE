import { webcrypto } from 'crypto';
// Polyfill globalThis.crypto only if not already defined (Node v23+ provides Web Crypto API)
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// 프로세스 예외 처리
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Socket.IO 어댑터 등록 (socket.io 서버 사용)
  app.useWebSocketAdapter(new IoAdapter(app));
  // HTTP 쿠키 파싱 (refresh token 쿠키 활용)
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // CORS 설정: 요청 출처를 동적으로 허용하고 쿠키를 포함한 인증 정보를 전달
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
