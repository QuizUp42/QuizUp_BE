import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { Message } from './entities/message.entity';

@Controller('rooms')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly roomsService: RoomsService,
  ) {}

  @Get(':room/messages')
  async getMessages(
    @Param('room') roomCode: string,
    @Query('limit') limit?: string,
  ): Promise<Message[]> {
    const room = await this.roomsService.findByCode(roomCode);
    let msgs = await this.chatService.getMessages(room.id);
    if (limit) {
      const num = parseInt(limit, 10);
      msgs = msgs.slice(-num);
    }
    return msgs;
  }
}
