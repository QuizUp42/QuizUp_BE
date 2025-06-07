import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Draw } from './entities/draw.entity';
import { OxQuiz } from './entities/ox-quiz.entity';
import { OxAnswer } from './entities/ox-answer.entity';
import { Check } from './entities/check.entity';
import { DeepPartial, In } from 'typeorm';
import { QuizService } from './quiz.service';
import { Quiz as HttpQuiz } from '../quiz/entities/quiz.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Draw)
    private readonly drawRepository: Repository<Draw>,
    @InjectRepository(OxQuiz)
    private readonly oxQuizRepository: Repository<OxQuiz>,
    @InjectRepository(OxAnswer)
    private readonly oxAnswerRepository: Repository<OxAnswer>,
    @InjectRepository(Check)
    private readonly checkRepository: Repository<Check>,
    @InjectRepository(HttpQuiz)
    private readonly httpQuizRepository: Repository<HttpQuiz>,
    private readonly quizService: QuizService,
  ) {}

  /** 단일 메시지 생성 후 id, 메시지, 작성자 정보(username, role)만 반환 */
  async createMessage(data: {
    roomId: number;
    authorId: number;
    message: string;
  }): Promise<{
    id: number;
    message: string;
    username: string;
    role: string;
    timestamp: Date;
  }> {
    // 메시지 저장
    const saved = await this.messageRepository.save({
      roomId: data.roomId,
      authorId: data.authorId,
      message: data.message,
    });
    // 작성자 정보 로드 (없으면 예외)
    const msgWithAuthor = await this.messageRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
    return {
      id: msgWithAuthor.id,
      message: msgWithAuthor.message,
      username: msgWithAuthor.author.username,
      role: msgWithAuthor.author.role,
      timestamp: msgWithAuthor.timestamp,
    };
  }

  /** 제비뽑기 생성 (교수 제외, 학생만 랜덤 승자 선정) */
  async createDraw(
    roomId: number,
    userId: number,
    participants: { userId: number; username: string; role: string }[],
  ): Promise<Draw> {
    // 교수 제외: 학생만 필터링
    const studentParticipants = participants.filter(
      (p) => p.role === 'student',
    );
    // 랜덤으로 승자 선정 (학생만)
    let winnerId: number | undefined;
    if (studentParticipants.length > 0) {
      const idx = Math.floor(Math.random() * studentParticipants.length);
      winnerId = studentParticipants[idx].userId;
    }
    // DeepPartial로 타입 선언 후 저장 (참가자 목록도 학생만 저장)
    const drawData: DeepPartial<Draw> = {
      roomId,
      userId,
      participants: studentParticipants,
      winnerId,
    };
    const draw = await this.drawRepository.save(drawData);
    return draw;
  }

  /** OX 퀴즈 생성 */
  async createOxQuiz(roomId: number, userId: number): Promise<OxQuiz> {
    const ox = this.oxQuizRepository.create({ roomId, userId });
    await this.oxQuizRepository.save(ox);
    // relation 초기화
    ox.answers = [];
    return ox;
  }

  /** OX 퀴즈 응답 제출 (answer가 null이면 삭제) */
  async submitOxAnswer(
    quizId: number,
    userId: number,
    answer: 'O' | 'X' | null,
  ): Promise<OxQuiz> {
    if (answer === null) {
      // 응답 삭제
      await this.oxAnswerRepository.delete({ quizId, userId });
    } else {
      // 기존 답변 조회
      let oxAnswer = await this.oxAnswerRepository.findOne({
        where: { quizId, userId },
      });
      if (oxAnswer) {
        oxAnswer.answer = answer;
      } else {
        oxAnswer = this.oxAnswerRepository.create({ quizId, userId, answer });
      }
      await this.oxAnswerRepository.save(oxAnswer);
    }
    // OX 퀴즈 및 모든 답변 로드
    return this.oxQuizRepository.findOneOrFail({
      where: { id: quizId },
      relations: ['user', 'answers', 'answers.user'],
    });
  }

  /** 교수 전용: 체크리스트 항목 생성 */
  async createCheck(roomId: number, professorId: number): Promise<Check> {
    return this.checkRepository.save({ roomId, professorId });
  }

  /** 방 내 모든 체크리스트 항목 조회 */
  async getChecks(roomId: string | number): Promise<Check[]> {
    const rid = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
    return this.checkRepository.find({ where: { roomId: rid } });
  }

  /** 학생 전용: 체크 토글 시 개인별 상태 업데이트 및 총합 계산 */
  async toggleCheck(
    checkId: number,
    userId: number,
    isChecked: boolean,
  ): Promise<Check> {
    // 체크 이벤트와 연관된 학생 토글 기록 불러오기
    const chk = await this.checkRepository.findOneOrFail({
      where: { id: checkId },
      relations: ['users'],
    });
    // 학생별 사용자 배열 업데이트
    const existing = chk.users.find((u) => u.id === userId);
    if (isChecked) {
      if (!existing) {
        const user = { id: userId } as any;
        chk.users.push(user);
      }
    } else {
      chk.users = chk.users.filter((u) => u.id !== userId);
    }
    // 현재 사용자의 체크 상태 저장 (isChecked 컬럼 업데이트)
    chk.isChecked = isChecked;
    // 총 체크 수 업데이트
    chk.checkCount = chk.users.length;
    return this.checkRepository.save(chk);
  }

  /** 통합 채팅 히스토리 조회: 메시지, OX퀴즈, 체크 이벤트를 하나의 타임라인으로 반환 */
  async getChatHistory(roomId: string | number): Promise<any[]> {
    const rid = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
    const [msgs, oxes, checks, draws] = await Promise.all([
      this.messageRepository.find({
        where: { roomId: rid },
        relations: ['author'],
        order: { timestamp: 'ASC' },
      }),
      this.oxQuizRepository.find({
        where: { roomId: rid },
        relations: ['user', 'answers', 'answers.user'],
      }),
      this.checkRepository.find({
        where: { roomId: rid },
        relations: ['professor', 'users'],
      }),
      this.drawRepository.find({ where: { roomId: rid } }),
    ]);
    const events: any[] = [];
    // 메시지 이벤트
    events.push(
      ...msgs.map((m) => ({
        type: 'chat' as const,
        timestamp: m.timestamp,
        id: m.id,
        message: m.message,
        username: m.author.username,
        role: m.author.role,
      })),
    );
    // OX퀴즈 이벤트 (role 포함) - payload 제거
    events.push(
      ...oxes.map((o) => {
        const answers = o.answers.map((a) => ({
          userId: a.user.id,
          answer: a.answer,
        }));
        const oCount = answers.filter((a) => a.answer === 'O').length;
        const xCount = answers.filter((a) => a.answer === 'X').length;
        return {
          type: 'oxquiz' as const,
          timestamp: o.timestamp,
          id: o.id,
          answers,
          oCount,
          xCount,
          role: o.user.role,
        };
      }),
    );
    // 체크 이벤트 (role 포함) - payload 제거
    events.push(
      ...checks.map((c) => ({
        type: 'check' as const,
        timestamp: c.createdAt,
        id: c.id,
        isChecked: c.isChecked,
        checkCount: c.checkCount,
        role: c.professor.role,
        users: c.users.map((u) => ({
          userId: u.id,
          username: u.username,
          role: u.role,
        })),
      })),
    );
    // 제비뽑기 이벤트
    events.push(
      ...draws.map((d) => {
        // 우승자 username 조회
        const winner = d.participants.find((p) => p.userId === d.winnerId);
        return {
          type: 'draw' as const,
          timestamp: d.timestamp,
          id: d.id,
          participants: d.participants,
          participantsCount: d.participants.length,
          professorId: d.userId,
          winnerId: d.winnerId,
          winnerUsername: winner ? winner.username : null,
        };
      }),
    );
    // 퀴즈 이벤트
    const quizzes = this.quizService.getEvents();
    // Fetch titles for quizzes
    const quizIds = quizzes.map((q) => parseInt(q.quizId, 10));
    const quizEntities = await this.httpQuizRepository.find({
      where: { id: In(quizIds) },
    });
    const quizMap = new Map<number, HttpQuiz>();
    quizEntities.forEach((qe) => quizMap.set(qe.id, qe));
    events.push(
      ...quizzes.map((q) => ({
        type: 'quiz' as const,
        timestamp: q.timestamp,
        quizId: q.quizId,
        isSubmit: q.isSubmit,
        title: quizMap.get(parseInt(q.quizId, 10))?.title || null,
      })),
    );
    // 타임스탬프 기준 정렬
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return events;
  }
}
