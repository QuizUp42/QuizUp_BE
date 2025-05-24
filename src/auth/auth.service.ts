import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { StudentProfile } from './entities/student-profile.entity';
import { ProfessorProfile } from './entities/professor-profile.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(StudentProfile) private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(ProfessorProfile) private readonly professorProfileRepository: Repository<ProfessorProfile>,
  ) {}

  async login(loginDto: LoginDto) {
    const { role, studentNo, username, password } = loginDto;
    // 프로필 조회
    let profile: StudentProfile | ProfessorProfile | null;
    if (role === 'student') {
      profile = await this.studentProfileRepository.findOne({
        where: { studentNo },
        relations: ['user'],
      });
    } else {
      profile = await this.professorProfileRepository.findOne({
        where: { professorNo: studentNo },
        relations: ['user'],
      });
    }
    if (!profile) throw new UnauthorizedException('Invalid credentials');
    const user = profile.user;
    // 사용자명 및 비밀번호 검증
    if (user.username !== username || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // JWT 페이로드
    const payload = { sub: user.id, username: user.username, role: user.role };
    // 액세스 토큰(1시간) 및 리프레시 토큰(7일)
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  async register(registerDto: import('./dto/register.dto').RegisterDto) {
    const { name, role, studentNo, username, password } = registerDto;
    // 기존 사용자명 중복 체크
    if (await this.userRepository.findOne({ where: { username } })) {
      throw new (require('@nestjs/common').BadRequestException)('Username already exists');
    }
    // 비밀번호 해싱
    const hashed = await bcrypt.hash(password, 10);
    // 유저 생성
    const user = this.userRepository.create({ name, username, password: hashed, role });
    const savedUser = await this.userRepository.save(user);
    // 프로필 생성
    if (role === 'student') {
      const profile = this.studentProfileRepository.create({ studentNo, user: savedUser });
      await this.studentProfileRepository.save(profile);
    } else {
      const profile = this.professorProfileRepository.create({ professorNo: studentNo, user: savedUser });
      await this.professorProfileRepository.save(profile);
    }
    // 자동 로그인 토큰
    const payload = { sub: savedUser.id, username: savedUser.username, role: savedUser.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  // 토큰 블랙리스트(로그아웃) 관리
  private blacklistedTokens = new Set<string>();
  private blacklistedRefreshTokens = new Set<string>();

  /**
   * 로그아웃 시 토큰을 블랙리스트에 추가합니다.
   */
  logout(token: string): void {
    this.blacklistedTokens.add(token);
    this.blacklistedRefreshTokens.add(token);
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인합니다.
   */
  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  isRefreshBlacklisted(token: string): boolean {
    return this.blacklistedRefreshTokens.has(token);
  }

  /**
   * 리프레시 토큰으로 새로운 토큰을 발급합니다.
   */
  async refresh(refreshToken: string) {
    if (this.isRefreshBlacklisted(refreshToken)) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const decoded = this.jwtService.verify(refreshToken) as any;
    const payload = { sub: decoded.sub, username: decoded.username, role: decoded.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken: newRefreshToken };
  }
}
