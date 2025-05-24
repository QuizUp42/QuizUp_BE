import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async createMessage(data: {
    roomId: number;
    authorId: number;
    message: string;
  }): Promise<Message> {
    const saved = await this.messageRepository.save({
      roomId: data.roomId,
      authorId: data.authorId,
      message: data.message,
    });
    return saved;
  }

  async getMessages(roomId: string | number): Promise<Message[]> {
    const rid = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
    return this.messageRepository.find({
      where: { roomId: rid },
      order: { timestamp: 'ASC' },
    });
  }
}
