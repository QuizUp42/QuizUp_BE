import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ChatService } from '../chat/chat.service';
import { User } from '../auth/entities/user.entity';
import { ProfessorProfile } from '../auth/entities/professor-profile.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    private readonly chatService: ChatService,
    @InjectRepository(ProfessorProfile)
    private readonly professorProfileRepository: Repository<ProfessorProfile>,
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

  /**
   * 통합 채팅 히스토리 조회: 메시지, OX퀴즈, 체크 이벤트
   */
  async getRoomMessages(
    roomParam: string | number,
  ): Promise<Array<{ type: 'chat' | 'oxquiz' | 'check'; timestamp: Date; payload: any }>> {
    let id: number;
    if (typeof roomParam === 'number') {
      id = roomParam;
      await this.findOne(id);
    } else if (typeof roomParam === 'string' && /^[0-9]+$/.test(roomParam)) {
      id = parseInt(roomParam, 10);
      await this.findOne(id);
    } else {
      const room = await this.findByCode(roomParam.toString());
      id = room.id;
    }
    return this.chatService.getChatHistory(id);
  }

  /**
   * 유저가 참여한 방(학생) 또는 생성한 방(교수)의 요약 정보를 반환합니다.
   */
  async getUserRooms(
    userId: number,
    role: 'student' | 'professor',
  ): Promise<{ id: number; code: string; name: string; participantCount: number; professorName: string | null; }[]> {
    // 방 조회 시 학생/교수 관계와 user loading
    const qb = this.roomsRepository.createQueryBuilder('room')
      .leftJoinAndSelect('room.students', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('room.professors', 'professor')
      .leftJoinAndSelect('professor.user', 'professorUser');
    if (role === 'student') {
      qb.innerJoin('room.students', 'studentFilter')
        .innerJoin('studentFilter.user', 'stuUser', 'stuUser.id = :userId', { userId });
    } else {
      qb.innerJoin('room.professors', 'profFilter')
        .innerJoin('profFilter.user', 'profUser', 'profUser.id = :userId', { userId });
    }
    const rooms = await qb.getMany();
    // summary DTO 생성
    return rooms.map(room => {
      const profName = room.professors[0]?.user.username || null;
      const count = room.students.length + room.professors.length;
      return {
        id: room.id,
        code: room.code,
        name: room.name,
        participantCount: count,
        professorName: profName,
      };
    });
  }

  private generateUniqueCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  // 방 생성 후 교수 프로필에 방 추가
  async addProfessorToRoom(userId: number, roomId: number): Promise<void> {
    const profProfile = await this.professorProfileRepository.findOne({ where: { user: { id: userId } } });
    if (!profProfile) {
      throw new Error('Professor profile not found');
    }
    await this.roomsRepository.createQueryBuilder()
      .relation(Room, 'professors')
      .of(roomId)
      .add(profProfile.id);
  }

  /**
   * 방에 참여 및 생성한 모든 사용자 목록을 반환합니다.
   */
  async getRoomParticipants(roomParam: string | number): Promise<{ userId: number; username: string; role: 'student' | 'professor'; }[]> {
    let id: number;
    if (typeof roomParam === 'number') {
      id = roomParam;
      await this.findOne(id);
    } else if (typeof roomParam === 'string' && /^[0-9]+$/.test(roomParam)) {
      id = parseInt(roomParam, 10);
      await this.findOne(id);
    } else {
      const room = await this.findByCode(roomParam.toString());
      id = room.id;
    }
    // 학생 및 교수 프로필 로드
    const roomWithRelations = await this.roomsRepository.findOne({
      where: { id },
      relations: ['students', 'students.user', 'professors', 'professors.user'],
    });
    if (!roomWithRelations) {
      throw new NotFoundException(`Room with id ${id} not found`);
    }
    const participants: { userId: number; username: string; role: 'student' | 'professor'; }[] = [];
    roomWithRelations.students.forEach(sp => {
      if (sp.user) {
        participants.push({ userId: sp.user.id, username: sp.user.username, role: 'student' });
      }
    });
    roomWithRelations.professors.forEach(pp => {
      if (pp.user) {
        participants.push({ userId: pp.user.id, username: pp.user.username, role: 'professor' });
      }
    });
    return participants;
  }
}
