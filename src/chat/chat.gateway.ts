import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { GetRoomInfoDto } from './dto/get-room-info.dto'

@WebSocketGateway({
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    // DB에서 룸 검증
    const room = await this.roomsService.findByCode(dto.roomCode);
    // 소켓에 유저네임 저장
    client.data.username = dto.username;
    // 룸 입장
    client.join(room.code);
    // 입장 확인 및 메시지 전송
    client.emit('joinedRoom', room);
    client.emit('messages', await this.chatService.getMessages(room.code));
  }

  @SubscribeMessage('leaveRoom')
  onLeaveRoom(client: Socket, dto: LeaveRoomDto) {
    client.leave(dto.roomCode);
    client.emit('leftRoom', dto.roomCode);
  }

  @SubscribeMessage('message')
  async onMessage(client: Socket, dto: ChatMessageDto) {
    // 받은 메시지 로그 출력
    console.log(`[ChatGateway] Received message in room ${dto.roomId} from ${dto.author}: ${dto.message}`);
    // DB에서 room code로 Room 엔티티 조회
    const roomEntity = await this.roomsService.findByCode(dto.roomId);
    // 메시지 저장 (roomId, authorId 사용)
    const msg = await this.chatService.createMessage({
      roomId: roomEntity.id,
      authorId: (client.data.user as any).id,
      message: dto.message,
    });
    this.server.to(dto.roomId).emit('message', msg);
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(@MessageBody() dto: CreateRoomDto) {
    const room = await this.roomsService.create(dto);
    const rooms = await this.roomsService.findAll();
    this.server.emit('roomList', rooms);
    return room;
  }

  @SubscribeMessage('deleteRoom')
  async handleDeleteRoom(@MessageBody() id: number) {
    await this.roomsService.remove(id);
    const rooms = await this.roomsService.findAll();
    this.server.emit('roomList', rooms);
  }

  @SubscribeMessage('getRooms')
  async handleGetRooms() {
    return await this.roomsService.findAll();
  }

  /**
   * 방 코드로 현재 연결된 클라이언트 수와 ID 목록을 반환합니다.
   */
  @SubscribeMessage('getRoomInfo')
  async handleGetRoomInfo(
    @MessageBody() dto: GetRoomInfoDto,
  ): Promise<{ roomCode: string; count: number; clients: string[] }> {
    // DB에서 룸 검증 (존재하지 않으면 예외)
    await this.roomsService.findByCode(dto.roomCode);
    // 해당 룸에 접속한 소켓 배열 조회
    const sockets = await this.server.in(dto.roomCode).fetchSockets();
    // username 목록 추출
    const clients = sockets
      .map(s => s.data.username)
      .filter((u): u is string => typeof u === 'string');
    return {
      roomCode: dto.roomCode,
      count: clients.length,
      clients,
    };
  }
}
