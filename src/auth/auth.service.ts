import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { StudentProfile } from './entities/student-profile.entity';
import { ProfessorProfile } from './entities/professor-profile.entity';
import { Message } from '../chat/entities/message.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(ProfessorProfile)
    private readonly professorProfileRepository: Repository<ProfessorProfile>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async login(loginDto: LoginDto) {
    const { studentNo, password } = loginDto;

    // 프로필 조회: 학생 먼저, 없으면 교수
    let profile: StudentProfile | ProfessorProfile | null;
    let userRole: 'student' | 'professor';
    profile = await this.studentProfileRepository.findOne({
      where: { studentNo },
      relations: ['user'],
    });
    if (profile) {
      userRole = 'student';
    } else {
      profile = await this.professorProfileRepository.findOne({
        where: { professorNo: studentNo },
        relations: ['user'],
      });
      userRole = 'professor';
    }
    if (!profile) throw new UnauthorizedException('Invalid credentials');
    const user = profile.user;

    // 사용자명 및 비밀번호 검증
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // JWT 페이로드
    const payload = { sub: user.id, role: userRole };
    // 액세스 토큰(1시간) 및 리프레시 토큰(7일)
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken, role: userRole };
  }

  async register(registerDto: import('./dto/register.dto').RegisterDto) {
    const { name, role, studentNo, password } = registerDto;
    // 비밀번호 해싱
    const hashed = await bcrypt.hash(password, 10);
    // 유저 생성
    const user = this.userRepository.create({ name, password: hashed, role });
    const savedUser = await this.userRepository.save(user);
    // 프로필 생성
    try {
      if (role === 'student') {
        const profile = this.studentProfileRepository.create({
          studentNo,
          user: savedUser,
        });
        await this.studentProfileRepository.save(profile);
      } else {
        const profile = this.professorProfileRepository.create({
          professorNo: studentNo,
          user: savedUser,
        });
        await this.professorProfileRepository.save(profile);
      }
    } catch (error) {
      // Handle unique constraint violation for studentNo or professorNo
      if (
        error instanceof QueryFailedError &&
        (error.driverError?.code === '23505' || (error as any).code === '23505')
      ) {
        const message =
          role === 'student'
            ? 'Student number already exists'
            : 'Professor number already exists';
        throw new BadRequestException(message);
      }
      throw error;
    }
    // 자동 로그인 토큰
    const payload = { sub: savedUser.id, role: savedUser.role };
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
    const decoded = this.jwtService.verify(refreshToken);
    // DB에서 유저 존재 여부 검사
    const user = await this.userRepository.findOneBy({ id: decoded.sub });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const payload = { sub: decoded.sub, role: decoded.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken: newRefreshToken };
  }

  // DB에 유저 존재 여부를 확인하는 헬퍼 메서드
  async findUserById(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  // 유저 계정 삭제: 역할에 따라 메시지 및 프로필/사용자 레코드를 제거합니다.
  async deleteUser(userId: number): Promise<void> {
    // 사용자 정보 조회
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) return;

    if (user.role === 'professor') {
      // 교수님이 소속된 모든 방의 메시지를 삭제
      const profProfile = await this.professorProfileRepository.findOne({
        where: { user: { id: userId } },
        relations: ['rooms'],
      });
      const roomIds = profProfile?.rooms.map((r) => r.id) || [];
      if (roomIds.length > 0) {
        await this.messageRepository
          .createQueryBuilder()
          .delete()
          .from(Message)
          .where('roomId IN (:...roomIds)', { roomIds })
          .execute();
      }
    } else {
      // 학생이 작성한 메시지만 삭제
      await this.messageRepository.delete({ authorId: userId });
    }

    // 학생 프로필 삭제
    const studentProfile = await this.studentProfileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (studentProfile) {
      await this.studentProfileRepository.remove(studentProfile);
    }
    // 교수 프로필 삭제
    const professorProfile = await this.professorProfileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (professorProfile) {
      await this.professorProfileRepository.remove(professorProfile);
    }
    // 유저 삭제
    await this.userRepository.delete(userId);
  }

  // 유저네임 업데이트 메서드
  async updateUsername(userId: number, username: string): Promise<void> {
    // 중복 확인
    if (await this.userRepository.findOne({ where: { username } })) {
      throw new BadRequestException('Username already exists');
    }
    await this.userRepository.update(userId, { username });
  }

  async generateRandomNickname(): Promise<string> {
    const adjectives = [
      '용감한',
      '빠른',
      '영리한',
      '강력한',
      '상냥한',
      '빛나는',
      '행복한',
      '자유로운',
      '화려한',
      '강인한',
      '씩씩한',
      '부드러운',
      '차분한',
      '환한',
      '고요한',
      '용맹한',
      '기민한',
      '온화한',
      '우아한',
      '민첩한',
    ];
    const animals = [
      '사자',
      '호랑이',
      '독수리',
      '상어',
      '늑대',
      '돌고래',
      '코끼리',
      '펭귄',
      '여우',
      '곰',
      '부엉이',
      '원숭이',
      '사슴',
      '악어',
      '고래',
      '수달',
      '까치',
      '공작새',
      '닭',
      '오리',
    ];
    let nickname: string;
    do {
      const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];
      const animal = animals[Math.floor(Math.random() * animals.length)];
      // Increased numeric range to reduce collisions
      const number = Math.floor(Math.random() * 100000);
      nickname = `${adjective}${animal}${number}`;
    } while (
      await this.userRepository.findOne({ where: { username: nickname } })
    );
    return nickname;
  }
}
