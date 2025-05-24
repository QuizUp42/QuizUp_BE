import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    // 이미 인증된 소켓이면 토큰 재검증 없이 허용
    if (client.data.user) {
      return true;
    }
    // Socket.IO auth 토큰 지원 (handshake.auth.token) 및 HTTP 헤더 모두 처리
    const authHeader = (client.handshake.headers.authorization as string) || '';
    const authToken = client.handshake.auth?.token;
    // 우선 handshake.auth.token 사용, 없으면 Authorization 헤더 사용
    let token = authToken as string | undefined;
    if (!token && authHeader) {
      const parts = authHeader.split(' ');
      token = parts.length > 1 ? parts[1] : parts[0];
    }
    if (!token) throw new UnauthorizedException('Token missing');
    const secret = this.configService.get<string>('JWT_SECRET') || 'default_jwt_secret';
    console.log('[WsJwtAuthGuard] handshake.auth:', client.handshake.auth);
    console.log('[WsJwtAuthGuard] authHeader:', client.handshake.headers.authorization);
    console.log('[WsJwtAuthGuard] Using secret (length):', secret.length);
    console.log('[WsJwtAuthGuard] Verifying token:', token);
    try {
      const decoded = verify(token, secret) as any;
      // JWT payload의 sub를 id로 매핑
      client.data.user = {
        id: decoded.sub,
        username: decoded.username,
        role: decoded.role,
      };
      return true;
    } catch (err) {
      console.error('[WsJwtAuthGuard] JWT verify error:', err);
      throw new UnauthorizedException('Invalid token');
    }
  }
} 