import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Preflight 요청(OPTIONS)은 인증 건너뛰기
    if (request.method === 'OPTIONS') {
      return true;
    }

    // HTTP 요청에서 토큰 추출
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 없습니다');
    }

    const token = authHeader.substring(7);

    if (this.authService.isBlacklisted(token)) {
      throw new UnauthorizedException('로그아웃된 토큰입니다');
    }

    try {
      const payload = this.jwtService.verify(token);
      // DB에서 유저 존재 여부 및 정보 조회
      const user = await this.authService.findUserById(payload.sub);
      // 요청 객체에 사용자 정보 저장 (username은 DB 값 사용)
      request.user = {
        userId: user.id,
        role: payload.role,
      };
      return true;
    } catch (e) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }
  }
}
