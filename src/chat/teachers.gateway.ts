import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { FeatureService } from './feature.service';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { QuizService } from './quiz.service';
import { QuizDto } from './dto/quiz.dto';
import { WsJwtAuthGuard } from '../auth/ws-jwt.guard';
import { WsRolesGuard } from '../auth/ws-roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoomsService } from '../rooms/rooms.service';

@UseGuards(WsJwtAuthGuard, WsRolesGuard)
@WebSocketGateway({
  namespace: '/teachers',
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class TeachersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly featureService: FeatureService,
    private readonly quizService: QuizService,
    private readonly roomsService: RoomsService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`교수 연결: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`교수 연결 해제: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { username: string; room: string },
  ) {
    console.log(`[TeachersGateway] onJoinRoom payload: username=${payload.username}, room=${payload.room}`);
    try {
      client.data.username = payload.username;
      client.join(payload.room);
      client.emit('joinedRoom', payload.room);
      // DB에서 room code로 Room 엔티티 조회
      const roomEntity = await this.roomsService.findByCode(payload.room);
      // 과거 메시지 전송 (roomEntity.id 사용)
      const history = await this.chatService.getMessages(roomEntity.id);
      client.emit('messages', history);
    } catch (err) {
      console.error('[TeachersGateway] joinRoom error:', err);
      throw err;
    }
  }

  @SubscribeMessage('chatMessage')
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string; text: string },
  ) {
    console.log(`[TeachersGateway] Received chatMessage in room ${payload.room} from ${client.data.username}: ${payload.text}`);
    const roomEntity = await this.roomsService.findByCode(payload.room);
    const msg = await this.chatService.createMessage({
      roomId: roomEntity.id,
      authorId: (client.data.user as any).id,
      message: payload.text,
    });
    // 교수 네임스페이스에 브로드캐스트
    this.server.to(payload.room).emit('chatMessage', msg);
    // @ts-ignore
    (client as any).server.of('/students').to(payload.room).emit('chatMessage', msg);
  }

  @Roles('teacher')
  @SubscribeMessage('updateFeature')
  handleFeature(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateFeatureDto,
  ) {
    const event = this.featureService.createEvent({
      roomId: payload.room,
      featureId: payload.featureId,
      type: payload.type,
      newState: payload.newState,
      userId: client.data.user.id || payload.userId,
    });
    this.server.to(payload.room).emit('featureUpdated', event);
    return event;
  }

  @Roles('teacher')
  @SubscribeMessage('createQuiz')
  handleQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: QuizDto,
  ) {
    const event = this.quizService.createEvent({
      roomId: payload.room,
      quizId: payload.quizId,
      quizName: payload.quizName,
      quizCount: payload.quizCount,
      isSubmit: payload.isSubmit,
      userId: client.data.user.id || payload.userId,
    });
    this.server.to(payload.room).emit('quizEvent', event);
    return event;
  }
} 