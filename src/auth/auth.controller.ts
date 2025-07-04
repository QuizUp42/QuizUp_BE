import {
  Controller,
  Post,
  Put,
  Body,
  Res,
  Req,
  UnauthorizedException,
  Delete,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CookieOptions } from 'express';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { RandomNicknameDto } from './dto/random-nickname.dto';

// 쿠키 옵션 동적 생성 함수
const isProd = process.env.NODE_ENV === 'production';
function getCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ) {
    const { accessToken, refreshToken, role } =
      await this.authService.login(loginDto);
    // Refresh Token을 HTTP-only 쿠키에 저장
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    // 클라이언트에는 Access Token과 role을 반환
    return { accessToken, role };
  }

  @Post('register')
  async register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() registerDto: RegisterDto,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.register(registerDto);
    // Refresh Token을 HTTP-only 쿠키에 저장
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    // 클라이언트에는 Access Token만 반환
    return { accessToken };
  }

  /**
   * 로그아웃: 쿠키에서 Refresh Token 삭제 및 블랙리스트 처리
   */
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies['refreshToken'];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    await this.authService.logout(token);
    // 쿠키 삭제
    res.clearCookie('refreshToken', getCookieOptions());

    return { message: 'Logged out successfully' };
  }

  /**
   * 토큰 리프레시: 쿠키에서 Refresh Token 추출 후 재발급
   */
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refreshToken'];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(token);

    // 새로운 Refresh Token으로 쿠키 갱신
    res.cookie('refreshToken', newRefreshToken, getCookieOptions());

    return { accessToken };
  }

  /**
   * 유저 계정 삭제: 인증된 Access Token으로 보호, 쿠키에서 Refresh Token 처리
   */
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = (req.user as any).userId;
    const token = req.cookies['refreshToken'];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    await this.authService.logout(token);
    await this.authService.deleteUser(userId);
    // 쿠키 삭제
    res.clearCookie('refreshToken', getCookieOptions());

    return { message: 'User deleted successfully' };
  }

  /**
   * 유저네임 업데이트: 인증된 Access Token으로 보호
   */
  @UseGuards(JwtAuthGuard)
  @Put('username')
  async updateUsername(
    @Req() req: Request,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ) {
    const userId = (req.user as any).userId;
    await this.authService.updateUsername(userId, updateUsernameDto.username);
    return { message: 'Username updated successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('random-nickname')
  async assignRandomNickname(): Promise<RandomNicknameDto> {
    const nickname = await this.authService.generateRandomNickname();
    return { nickname };
  }

  @UseGuards(JwtAuthGuard)
  @Get('random-nickname')
  async getRandomNickname(@Req() req: Request): Promise<RandomNicknameDto> {
    const userId = (req.user as any).userId;
    const user = await this.authService.findUserById(userId);
    return { nickname: user.username };
  }
}
