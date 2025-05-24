import { Controller, Post, Body, Res, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ) {
    // loginDto.studentNo을 사용하여 인증
    const { accessToken, refreshToken } = await this.authService.login(loginDto);
    // HttpOnly 쿠키로 refreshToken 저장
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken };
  }

  @Post('register')
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() registerDto: RegisterDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(registerDto);
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken };
  }

  /**
   * 로그아웃: 쿠키 삭제 및 블랙리스트 처리
   */
  @Post('logout')
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      this.authService.logout(refreshToken);
    }
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  /**
   * 토큰 리프레시: 새로운 accessToken과 refreshToken 발급
   */
  @Post('refresh')
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(refreshToken);
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken };
  }
}
