import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ChatService } from '../chat/chat.service';
import { User } from '../auth/entities/user.entity';
import { ProfessorProfile } from '../auth/entities/professor-profile.entity';
import { StudentProfile } from '../auth/entities/student-profile.entity';
import { RoomImage } from './entities/room-image.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    private readonly chatService: ChatService,
    @InjectRepository(ProfessorProfile)
    private readonly professorProfileRepository: Repository<ProfessorProfile>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(RoomImage)
    private readonly roomImageRepository: Repository<RoomImage>,
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
  ): Promise<
    Array<{ type: 'chat' | 'oxquiz' | 'check'; timestamp: Date; payload: any }>
  > {
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
  ): Promise<
    {
      id: number;
      code: string;
      name: string;
      participantCount: number;
      professorName: string | null;
    }[]
  > {
    // 방 조회 시 학생/교수 관계와 user loading
    const qb = this.roomsRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.students', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('room.professors', 'professor')
      .leftJoinAndSelect('professor.user', 'professorUser');
    if (role === 'student') {
      qb.innerJoin('room.students', 'studentFilter').innerJoin(
        'studentFilter.user',
        'stuUser',
        'stuUser.id = :userId',
        { userId },
      );
    } else {
      qb.innerJoin('room.professors', 'profFilter').innerJoin(
        'profFilter.user',
        'profUser',
        'profUser.id = :userId',
        { userId },
      );
    }
    const rooms = await qb.getMany();
    // summary DTO 생성
    return rooms.map((room) => {
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
    const profProfile = await this.professorProfileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profProfile) {
      throw new Error('Professor profile not found');
    }
    await this.roomsRepository
      .createQueryBuilder()
      .relation(Room, 'professors')
      .of(roomId)
      .add(profProfile.id);
  }

  /**
   * 방에 참여 및 생성한 모든 사용자 목록을 반환합니다.
   */
  async getRoomParticipants(
    roomParam: string | number,
  ): Promise<
    { userId: number; username: string; role: 'student' | 'professor' }[]
  > {
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
    const participants: {
      userId: number;
      username: string;
      role: 'student' | 'professor';
    }[] = [];
    roomWithRelations.students.forEach((sp) => {
      if (sp.user) {
        participants.push({
          userId: sp.user.id,
          username: sp.user.username,
          role: 'student',
        });
      }
    });
    roomWithRelations.professors.forEach((pp) => {
      if (pp.user) {
        participants.push({
          userId: pp.user.id,
          username: pp.user.username,
          role: 'professor',
        });
      }
    });
    return participants;
  }

  /** 학생 프로필을 방에 추가합니다. */
  async addStudentToRoom(userId: number, roomId: number): Promise<void> {
    // 학생 프로필 조회
    const studentProfile = await this.studentProfileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!studentProfile) {
      throw new Error('Student profile not found');
    }
    // 이미 방에 속해 있는지 확인
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['students'],
    });
    if (!room) {
      throw new NotFoundException(`Room with id ${roomId} not found`);
    }
    const exists = room.students.some((sp) => sp.id === studentProfile.id);
    if (!exists) {
      await this.roomsRepository
        .createQueryBuilder()
        .relation(Room, 'students')
        .of(roomId)
        .add(studentProfile.id);
    }
  }

  /**
   * 방에 새로운 이미지를 추가합니다.
   */
  async addRoomImage(roomId: number, key: string): Promise<RoomImage> {
    // 방 존재 확인
    await this.findOne(roomId);
    const image = this.roomImageRepository.create({ roomId, key });
    return this.roomImageRepository.save(image);
  }

  /**
   * 방에 업로드된 모든 이미지 조회
   */
  async getRoomImages(roomId: number): Promise<RoomImage[]> {
    // 방 존재 확인
    await this.findOne(roomId);
    return this.roomImageRepository.find({
      where: { roomId },
      order: { createdAt: 'ASC' },
    });
  }
}
