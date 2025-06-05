import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RoomsService } from '../rooms/rooms.service';

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
  ): Promise<any[]> {
    const room = await this.roomsService.findByCode(roomCode);
    let events = await this.chatService.getChatHistory(room.id);
    if (limit) {
      const num = parseInt(limit, 10);
      events = events.slice(-num);
    }
    return events;
  }
}
