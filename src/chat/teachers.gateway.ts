import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { FeatureService } from './feature.service';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { QuizService } from './quiz.service';
import { QuizDto } from './dto/quiz.dto';
import { RoomsService } from '../rooms/rooms.service';
import { EVENTS } from './events';
import { WsException } from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatSendDto } from './dto/chat-send.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@Injectable()
@WebSocketGateway({
  namespace: '/teachers',
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class TeachersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly featureService: FeatureService,
    private readonly quizService: QuizService,
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
    // Role check: 교수만 연결 허용
    if (user.role !== 'professor') {
      console.log(`Unauthorized: role not professor`);
      client.disconnect(true);
      return;
    }
    client.data.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    // 연결 완료 로그만 출력
    console.log(`Connected: ${client.id} (user: ${user.username})`);
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    console.log(`Disconnected: ${client.id} (user: ${user?.username})`);
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        // 유저 퇴장 알림 이벤트
        this.server.to(room).emit(EVENTS.USER_LEFT, {
          userId: user.id,
          username: user.username,
          role: user.role,
        });
      }
    });
  }

  @SubscribeMessage(EVENTS.ROOM_JOIN)
  // 클라이언트 → 서버: { room } 형태로 방 참가 요청을 받음
  @UsePipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: () =>
        new WsException('Invalid payload: room is required'),
    }),
  )
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomDto,
  ) {
    const user = client.data.user;
    console.log(
      `[${EVENTS.ROOM_JOIN}] user=${user.username}, room=${payload.room}`,
    );
    // 방 코드 유효성 검사
    let roomEntity;
    try {
      // 코드 기반 방 조회 우선
      roomEntity = await this.roomsService.findByCode(payload.room);
    } catch {
      // 코드 조회 실패 시, 숫자 문자열이면 ID로 폴백
      if (/^[0-9]+$/.test(payload.room)) {
        roomEntity = await this.roomsService.findOne(
          parseInt(payload.room, 10),
        );
      } else {
        throw new WsException(`Room ${payload.room} not found`);
      }
    }
    client.join(payload.room);

    // 브로드캐스트: 룸에 참가 알림(EVENTS.ROOM_JOINED) 전송
    this.server.to(payload.room).emit(EVENTS.ROOM_JOINED, {
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    // 응답: 클라이언트에게 참가 성공 알림(EVENTS.ROOM_JOINED) 전송
    client.emit(EVENTS.ROOM_JOINED, payload.room);

    // 응답: 클라이언트에게 채팅 이력(EVENTS.MESSAGES) 전송
    const history = await this.chatService.getChatHistory(roomEntity.id);
    client.emit(EVENTS.MESSAGES, history);
  }

  @SubscribeMessage(EVENTS.CHAT_SEND)
  // 클라이언트 → 서버: { room, text } 형태로 채팅 메시지 전송 요청을 받음
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatSendDto,
  ) {
    const user = client.data.user;
    let roomEntity;
    try {
      roomEntity = await this.roomsService.findByCode(payload.room);
    } catch {
      if (/^[0-9]+$/.test(payload.room)) {
        roomEntity = await this.roomsService.findOne(
          parseInt(payload.room, 10),
        );
      } else {
        throw new WsException(`Room ${payload.room} not found`);
      }
    }
    console.log(
      `[${EVENTS.CHAT_SEND}] from ${user.username} in roomCode=${roomEntity.code} (roomId=${roomEntity.id}): ${payload.text}`,
    );
    const msg = await this.chatService.createMessage({
      roomId: roomEntity.id,
      authorId: user.id,
      message: payload.text,
    });

    // 브로드캐스트: 룸에 채팅 메시지(EVENTS.CHAT_MESSAGE) 전송 (교사 네임스페이스)
    this.server.in(payload.room).emit(EVENTS.CHAT_MESSAGE, msg);
    // 브로드캐스트: 룸에 채팅 메시지(EVENTS.CHAT_MESSAGE) 전송 (학생 네임스페이스)
    (this.server as any).server
      .of('/students')
      .to(payload.room)
      .emit(EVENTS.CHAT_MESSAGE, msg);
  }

  @SubscribeMessage(EVENTS.FEATURE_UPDATE)
  // 클라이언트 → 서버: 기능 업데이트 요청(payload: UpdateFeatureDto)을 받음
  handleFeature(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateFeatureDto,
  ) {
    // 브로드캐스트: 룸에 기능 업데이트 알림(EVENTS.FEATURE_UPDATED) 전송
    const user = client.data.user;
    const event = this.featureService.createEvent({
      roomId: payload.room,
      featureId: payload.featureId,
      type: payload.type,
      newState: payload.newState,
      userId: user.id,
    });
    this.server.to(payload.room).emit(EVENTS.FEATURE_UPDATED, event);
    return event;
  }

  @SubscribeMessage(EVENTS.QUIZ_CREATE)
  // 클라이언트 → 서버: 퀴즈 생성 요청(payload: QuizDto { room, quizId })
  handleQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: QuizDto,
  ) {
    // 생성 이벤트(isSubmit=false)
    const user = client.data.user;
    const event = this.quizService.publishQuiz(
      payload.quizId.toString(),
      false,
      user.id.toString(),
    );
    // 교사 네임스페이스 브로드캐스트
    this.server.to(payload.room).emit(EVENTS.QUIZ_CREATED, event);
    // 학생 네임스페이스 브로드캐스트
    (this.server as any).server
      .of('/students')
      .to(payload.room)
      .emit(EVENTS.QUIZ_CREATED, event);
    return event;
  }

  @SubscribeMessage(EVENTS.OXQUIZ_CREATE)
  // 클라이언트 → 서버: OX 퀴즈 생성 요청(payload: {room})을 받음
  async handleOxQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string },
  ) {
    try {
      const user = client.data.user;
      console.log(
        `[${EVENTS.OXQUIZ_CREATE}] user=${user.username}, room=${payload.room}`,
      );
      console.log(`[${EVENTS.OXQUIZ_CREATE}] calling ChatService.createOxQuiz`);
      let roomEntity;
      try {
        roomEntity = await this.roomsService.findByCode(payload.room);
      } catch {
        if (/^[0-9]+$/.test(payload.room)) {
          roomEntity = await this.roomsService.findOne(
            parseInt(payload.room, 10),
          );
        } else {
          throw new WsException(`Room ${payload.room} not found`);
        }
      }
      const ox = await this.chatService.createOxQuiz(roomEntity.id, user.id);
      console.log(`[${EVENTS.OXQUIZ_CREATE}] createOxQuiz result:`, ox);
      // O/X 응답 개수 집계
      const oCount = ox.answers.filter((a) => a.answer === 'O').length;
      const xCount = ox.answers.filter((a) => a.answer === 'X').length;
      console.log(
        `[${EVENTS.OXQUIZ_CREATED}] oCount=${oCount}, xCount=${xCount}`,
      );
      const created = {
        id: ox.id,
        roomId: ox.roomId,
        professorId: ox.userId,
        oCount,
        xCount,
      };
      console.log(`[${EVENTS.OXQUIZ_CREATED}] broadcasting:`, created);
      this.server.to(payload.room).emit(EVENTS.OXQUIZ_CREATED, created);
      (this.server as any).server
        .of('/students')
        .to(payload.room)
        .emit(EVENTS.OXQUIZ_CREATED, created);
      return ox;
    } catch (err) {
      console.error(`[${EVENTS.OXQUIZ_CREATE}] error:`, err);
      throw new WsException(err.message || 'OxQuiz error');
    }
  }

  @SubscribeMessage(EVENTS.CHECK_CREATE)
  // 클라이언트 → 서버: 체크 생성 요청(payload: {room})을 받음
  async handleCreateCheck(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string },
  ) {
    // 브로드캐스트: 룸에 체크 생성 결과(EVENTS.CHECK_CREATED) 전송 (교사/학생 네임스페이스)
    console.log(`[${EVENTS.CHECK_CREATE}] payload.room=${payload.room}`);
    console.log('[handleCreateCheck] client.rooms=', Array.from(client.rooms));
    const user = client.data.user;
    let roomEntity;
    try {
      roomEntity = await this.roomsService.findByCode(payload.room);
    } catch {
      if (/^[0-9]+$/.test(payload.room)) {
        roomEntity = await this.roomsService.findOne(
          parseInt(payload.room, 10),
        );
      } else {
        throw new WsException(`Room ${payload.room} not found`);
      }
    }
    const chk = await this.chatService.createCheck(roomEntity.id, user.id);
    console.log(`[${EVENTS.CHECK_CREATE}] created check=`, chk);
    console.log(
      `[${EVENTS.CHECK_CREATE}] broadcasting to teachers.room ${payload.room}`,
    );
    this.server.to(payload.room).emit(EVENTS.CHECK_CREATED, chk);
    (this.server as any).server
      .of('/students')
      .to(payload.room)
      .emit(EVENTS.CHECK_CREATED, chk);
    return chk;
  }
}
