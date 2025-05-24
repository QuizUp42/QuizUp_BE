import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { QuizService } from './quiz.service';
import { RoomsService } from '../rooms/rooms.service';
import { WsJwtAuthGuard } from '../auth/ws-jwt.guard';
import { WsRolesGuard } from '../auth/ws-roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(WsJwtAuthGuard, WsRolesGuard)
@WebSocketGateway({
  namespace: '/students',
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class StudentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly quizService: QuizService,
    private readonly roomsService: RoomsService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`학생 연결: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`학생 연결 해제: ${client.id}`);
  }

  @Roles('student')
  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { username: string; room: string },
  ) {
    console.log(`[StudentsGateway] onJoinRoom payload: username=${payload.username}, room=${payload.room}`);
    client.data.username = payload.username;
    client.join(payload.room);
    client.emit('joinedRoom', payload.room);
    // DB에서 room code로 Room 엔티티 조회
    const roomEntity = await this.roomsService.findByCode(payload.room);
    // 과거 메시지 전송 (roomEntity.id 사용)
    const history = await this.chatService.getMessages(roomEntity.id);
    client.emit('messages', history);
    // 과거 퀴즈 이벤트 전송
    const quizHistory = this.quizService.getEvents(payload.room);
    client.emit('quizHistory', quizHistory);
  }

  @Roles('student')
  @SubscribeMessage('chatMessage')
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string; text: string },
  ) {
    console.log(`[StudentsGateway] Received chatMessage in room ${payload.room} from ${client.data.username}: ${payload.text}`);
    const roomEntity = await this.roomsService.findByCode(payload.room);
    const msg = await this.chatService.createMessage({
      roomId: roomEntity.id,
      authorId: (client.data.user as any).id,
      message: payload.text,
    });
    // 학생 네임스페이스에 브로드캐스트
    this.server.to(payload.room).emit('chatMessage', msg);
    // 교수 네임스페이스에도 브로드캐스트
    // @ts-ignore
    (client as any).server.of('/teachers').to(payload.room).emit('chatMessage', msg);
  }
} 