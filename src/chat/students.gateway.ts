import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { JoinRoomDto } from './dto/join-room.dto';
import { AnswerOxQuizDto } from './dto/answer-ox-quiz.dto';
import { EVENTS } from './events';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatSendDto } from './dto/chat-send.dto';

@Injectable()
@WebSocketGateway({
  namespace: '/students',
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class StudentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
  ) {}

  async handleConnection(client: Socket) {
    // Extract token from auth, query, header or cookie
    let token = client.handshake.auth?.token as string;
    if (!token && client.handshake.query?.auth) {
      try {
        token = JSON.parse(client.handshake.query.auth as string).token;
      } catch {}
    }
    if (!token && client.handshake.headers.authorization) {
      const parts = client.handshake.headers.authorization.split(' ');
      token = parts.length > 1 ? parts[1] : parts[0];
    }
    if (!token) {
      console.log(`Unauthorized: no token`);
      client.disconnect(true);
      return;
    }

    // Verify JWT
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      console.log(`Unauthorized: invalid token`);
      client.disconnect(true);
      return;
    }

    // Check blacklist and user existence
    if (await this.authService.isBlacklisted(token)) {
      console.log(`Unauthorized: token blacklisted`);
      client.disconnect(true);
      return;
    }
    let user;
    try {
      user = await this.authService.findUserById(payload.sub);
    } catch {
      console.log(`Unauthorized: user lookup failed`);
      client.disconnect(true);
      return;
    }
    if (!user) {
      console.log(`Unauthorized: user not found`);
      client.disconnect(true);
      return;
    }

    // Role check: 학생만 연결 허용
    if (user.role !== 'student') {
      console.log(`Unauthorized: role not student`);
      client.disconnect(true);
      return;
    }

    client.data.user = {
      id: user.id,
      role: user.role,
    };
    // 연결 완료: 인증된 학생 클라이언트
    console.log(`Connected: ${client.id} (user: ${user.username})`);
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    console.log(`학생 연결 해제: ${client.id} (user: ${user?.username})`);
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        this.server.to(room).emit('userLeft', {
          userId: user.id,
          username: user.username,
          role: user.role,
        });
      }
    });
  }

  @SubscribeMessage(EVENTS.ROOM_JOIN)
  // 클라이언트 → 서버: 방 참가 요청 (payload: JoinRoomDto { room })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: () =>
        new WsException('Invalid payload: room is required'),
    }),
  )
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    try {
      const rawUser = client.data.user;
      const user = rawUser ?? { id: null, username: '', role: '' };
      const room = dto.room;
      console.log(`[${EVENTS.ROOM_JOIN}] user=${user.username}, room=${room}`);
      // 방 코드 유효성 검사
      let roomEntity;
      try {
        roomEntity = await this.roomsService.findByCode(room);
      } catch {
        throw new WsException(`Room ${room} not found`);
      }
      // DB에 학생 프로필 방 참여 정보 저장
      if (rawUser && rawUser.role === 'student') {
        await this.roomsService.addStudentToRoom(rawUser.id, roomEntity.id);
      }
      // 소켓을 해당 방(room)으로 join
      client.join(room);
      // 브로드캐스트: 학생 네임스페이스에 참가 알림
      this.server.to(room).emit(EVENTS.ROOM_JOINED, {
        userId: user.id,
        username: user.username,
        role: user.role,
      });
      // 브로드캐스트: 교사 네임스페이스에 참가 알림
      const rootServer = (this.server as any).server as Server;
      rootServer.of('/teachers').to(room).emit(EVENTS.ROOM_JOINED, {
        userId: user.id,
        username: user.username,
        role: user.role,
      });
      // 응답: 본인에게 참가 성공 알림
      client.emit(EVENTS.ROOM_JOINED, room);
      // 응답: 채팅 이력 전송
      const history = await this.chatService.getChatHistory(roomEntity.id);
      // myAnswer 포함하여 이벤트 재구성
      const enriched = history.map((evt: any) => {
        // OX퀴즈: 나의 선택 표시
        if (evt.type === 'oxquiz') {
          const answers = evt.answers as {
            userId: number;
            answer: 'O' | 'X';
          }[];
          const me = answers.find((a) => a.userId === client.data.user.id);
          const myAnswer = me ? me.answer : null;
          return { ...evt, myAnswer };
        }
        // 체크: 나의 토글 상태 표시
        if (evt.type === 'check') {
          const users = evt.users as {
            userId: number;
            username: string;
            role: string;
          }[];
          const myChecked = users.some((u) => u.userId === client.data.user.id);
          return { ...evt, myChecked };
        }
        return evt;
      });
      // Unified 모든 이벤트 전송: chat, oxquiz, check, draw, quiz, image 등 모두 포함
      client.emit(EVENTS.MESSAGES, enriched);
    } catch (err) {
      console.error('[ROOM_JOIN] 처리 중 에러:', err);
      throw err instanceof WsException
        ? err
        : new WsException(err.message || '방 참가 중 내부 에러');
    }
  }

  @SubscribeMessage(EVENTS.CHAT_SEND)
  // 클라이언트 → 서버: 채팅 메시지 전송 요청 (payload: {room, text})
  @UsePipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: () =>
        new WsException('Invalid payload: room and text are required'),
    }),
  )
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatSendDto,
  ) {
    const user = client.data.user;
    const roomEntity = await this.roomsService.findByCode(payload.room);
    console.log(
      `[${EVENTS.CHAT_SEND}] from ${user.username} in roomCode=${roomEntity.code} (roomId=${roomEntity.id}): ${payload.text}`,
    );
    const msg = await this.chatService.createMessage({
      roomId: roomEntity.id,
      authorId: user.id,
      message: payload.text,
    });

    // 브로드캐스트: 학생 네임스페이스에 채팅 메시지(EVENTS.CHAT_MESSAGE) 전송
    this.server.to(payload.room).emit(EVENTS.CHAT_MESSAGE, msg);
    // 브로드캐스트: 교사 네임스페이스에 채팅 메시지(EVENTS.CHAT_MESSAGE) 전송
    const rootServer = (this.server as any).server as Server;
    rootServer.of('/teachers').to(payload.room).emit(EVENTS.CHAT_MESSAGE, msg);
  }

  @SubscribeMessage(EVENTS.CHECK_TOGGLE)
  // 클라이언트 → 서버: 체크 토글 요청 (payload: {room, checkId, isChecked})
  async handleToggleCheck(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { room: string; checkId: number; isChecked: boolean },
  ) {
    // 체크 토글 요청 로그
    console.log(
      `[${EVENTS.CHECK_TOGGLE}] room=${payload.room}, checkId=${payload.checkId}, isChecked=${payload.isChecked}`,
    );
    const roomEntity = await this.roomsService.findByCode(payload.room);
    const user = client.data.user;
    const updated = await this.chatService.toggleCheck(
      payload.checkId,
      user.id,
      payload.isChecked,
    );
    // 체크 토글 결과 로그
    console.log(`[${EVENTS.CHECK_TOGGLED}] updated check=`, updated);
    // 브로드캐스트: 학생 네임스페이스에 체크 토글 결과(EVENTS.CHECK_TOGGLED) 전송
    this.server.to(payload.room).emit(EVENTS.CHECK_TOGGLED, updated);
    // 브로드캐스트: 교사 네임스페이스에 체크 토글 결과(EVENTS.CHECK_TOGGLED) 전송
    const rootServer = (this.server as any).server as Server;
    rootServer
      .of('/teachers')
      .to(payload.room)
      .emit(EVENTS.CHECK_TOGGLED, updated);
    return updated;
  }

  @SubscribeMessage(EVENTS.OXQUIZ_ANSWER)
  // 클라이언트 → 서버: OX퀴즈 응답 제출 요청 (payload: AnswerOxQuizDto)
  async handleOxQuizAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnswerOxQuizDto,
  ) {
    const user = client.data.user;
    // OX 퀴즈 응답 저장
    const answerValue = payload.answer ?? null;
    const answered = await this.chatService.submitOxAnswer(
      payload.quizId,
      user.id,
      answerValue,
    );
    // O/X 응답 개수 집계 및 응답 데이터 생성
    const oCount = answered.answers.filter((a) => a.answer === 'O').length;
    const xCount = answered.answers.filter((a) => a.answer === 'X').length;
    const payloadToSend = {
      id: answered.id,
      roomId: answered.roomId,
      userId: answered.userId,
      answers: answered.answers.map((a) => ({
        userId: a.userId,
        answer: a.answer,
      })),
      oCount,
      xCount,
      timestamp: answered.timestamp,
    };
    this.server.to(payload.room).emit(EVENTS.OXQUIZ_ANSWERED, payloadToSend);
    const rootServer = (this.server as any).server as Server;
    rootServer
      .of('/teachers')
      .to(payload.room)
      .emit(EVENTS.OXQUIZ_ANSWERED, payloadToSend);
    return answered;
  }
}
