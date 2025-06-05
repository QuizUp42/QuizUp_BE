import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import * as cookie from 'cookie';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();

    // 이미 인증된 소켓이면 검증 생략
    if (client.data.user) {
      return true;
    }

    // 1. handshake.auth.token
    let token = client.handshake.auth?.token as string | undefined;

    // 2. handshake.query.auth (JSON 문자열)
    if (!token && client.handshake.query.auth) {
      try {
        const raw = client.handshake.query.auth;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        token = parsed.token;
      } catch {}
    }

    // 3. Authorization 헤더 (Bearer)
    if (!token && client.handshake.headers.authorization) {
      const parts = (client.handshake.headers.authorization as string).split(' ');
      token = parts.length > 1 ? parts[1] : parts[0];
    }

    // 4. Cookie 헤더
    if (!token && client.handshake.headers.cookie) {
      const cookies = cookie.parse(client.handshake.headers.cookie as string);
      token = cookies['accessToken'] || cookies['refreshToken'] || cookies['token'];
    }

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 없습니다');
    }

    let payload: any;
    try {
      // JwtService.verifyAsync를 사용해 토큰 검증
      payload = await this.jwtService.verifyAsync(token);
    } catch (err) {
      console.error('[WsJwtAuthGuard] JWT 검증 실패:', err);
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다');
    }

    // 토큰 블랙리스트 확인
    if (await this.authService.isBlacklisted(token)) {
      throw new UnauthorizedException('로그아웃된 토큰입니다');
    }

    // DB에서 유저 존재 여부 검증
    const user = await this.authService.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('유저를 찾을 수 없습니다');
    }

    // 클라이언트에 사용자 정보 저장
    client.data.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    return true;
  }
}
