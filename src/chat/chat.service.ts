import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Draw } from './entities/draw.entity';
import { OxQuiz } from './entities/ox-quiz.entity';
import { Check } from './entities/check.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Draw)
    private readonly drawRepository: Repository<Draw>,
    @InjectRepository(OxQuiz)
    private readonly oxQuizRepository: Repository<OxQuiz>,
    @InjectRepository(Check)
    private readonly checkRepository: Repository<Check>,
  ) {}

  /** 단일 메시지 생성 후 id, 메시지, 작성자 정보(username, role)만 반환 */
  async createMessage(data: {
    roomId: number;
    authorId: number;
    message: string;
  }): Promise<{ id: number; message: string; username: string; role: string; timestamp: Date }> {
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

  /** 제비뽑기 생성 */
  async createDraw(roomId: number, userId: number, participants: { userId: number; username: string; role: string }[]): Promise<Draw> {
    const draw = this.drawRepository.create({ roomId, userId, participants });
    return this.drawRepository.save(draw);
  }

  /** OX 퀴즈 생성 */
  async createOxQuiz(roomId: number, userId: number, question: string): Promise<OxQuiz> {
    const ox = this.oxQuizRepository.create({ roomId, userId, question, answers: [] });
    return this.oxQuizRepository.save(ox);
  }

  /** OX 퀴즈 응답 제출 */
  async submitOxAnswer(
    quizId: number,
    userId: number,
    answer: 'O' | 'X',
  ): Promise<OxQuiz> {
    const ox = await this.oxQuizRepository.findOneOrFail({ where: { id: quizId } });
    const answers = ox.answers || [];
    // 기존 응답 제거
    const filtered = answers.filter(a => a.userId !== userId);
    filtered.push({ userId, answer });
    ox.answers = filtered;
    return this.oxQuizRepository.save(ox);
  }

  /** 교수 전용: 체크리스트 항목 생성 */
  async createCheck(
    roomId: number,
    professorId: number,
  ): Promise<Check> {
    return this.checkRepository.save({ roomId, professorId });
  }

  /** 방 내 모든 체크리스트 항목 조회 */
  async getChecks(roomId: string | number): Promise<Check[]> {
    const rid = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
    return this.checkRepository.find({ where: { roomId: rid } });
  }

  /** 학생 전용: 체크 토글 시 checkCount 및 상태 업데이트 */
  async toggleCheck(
    checkId: number,
    isChecked: boolean,
  ): Promise<Check> {
    const chk = await this.checkRepository.findOneByOrFail({ id: checkId });
    chk.checkCount = isChecked ? chk.checkCount + 1 : Math.max(0, chk.checkCount - 1);
    chk.isChecked = isChecked;
    return this.checkRepository.save(chk);
  }

  /** 통합 채팅 히스토리 조회: 메시지, OX퀴즈, 체크 이벤트를 하나의 타임라인으로 반환 */
  async getChatHistory(
    roomId: string | number,
  ): Promise<
    Array<{
      type: 'chat' | 'oxquiz' | 'check';
      timestamp: Date;
      payload: any;
    }>
  > {
    const rid = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
    const [msgs, oxes, checks] = await Promise.all([
      this.messageRepository.find({ where: { roomId: rid }, relations: ['author'], order: { timestamp: 'ASC' } }),
      this.oxQuizRepository.find({ where: { roomId: rid }, relations: ['user'] }),
      this.checkRepository.find({ where: { roomId: rid }, relations: ['professor'] }),
    ]);
    const events: Array<{ type: 'chat' | 'oxquiz' | 'check'; timestamp: Date; payload: any }> = [];
    // 메시지 이벤트
    events.push(
      ...msgs.map((m) => ({
        type: 'chat' as const,
        timestamp: m.timestamp,
        payload: { id: m.id, message: m.message, username: m.author.username, role: m.author.role },
      })),
    );
    // OX퀴즈 이벤트 (role 포함)
    events.push(
      ...oxes.map((o) => ({
        type: 'oxquiz' as const,
        timestamp: o.timestamp,
        payload: { id: o.id, question: o.question, answers: o.answers, role: o.user.role },
      })),
    );
    // 체크 이벤트 (role 포함)
    events.push(
      ...checks.map((c) => ({
        type: 'check' as const,
        timestamp: c.createdAt,
        payload: { id: c.id, isChecked: c.isChecked, checkCount: c.checkCount, role: c.professor.role },
      })),
    );
    // 타임스탬프 기준 정렬
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return events;
  }
}
