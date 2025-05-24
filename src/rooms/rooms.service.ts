import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
  ) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = this.roomsRepository.create({
      ...createRoomDto,
      code: this.generateUniqueCode(),
    });
    return this.roomsRepository.save(room);
  }

  async findAll(): Promise<Room[]> {
    return this.roomsRepository.find();
  }

  async findOne(id: number): Promise<Room> {
    const room = await this.roomsRepository.findOneBy({ id });
    if (!room) throw new NotFoundException(`Room with id ${id} not found`);
    return room;
  }

  async update(id: number, updateRoomDto: UpdateRoomDto): Promise<Room> {
    await this.roomsRepository.update(id, updateRoomDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.roomsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }
  }

  /**
   * code로 방 조회, 없으면 NotFoundException
   */
  async findByCode(code: string): Promise<Room> {
    const room = await this.roomsRepository.findOneBy({ code });
    if (!room) {
      throw new NotFoundException(`Room with code ${code} not found`);
    }
    return room;
  }

  private generateUniqueCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }
}
