import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { S3Service } from '../aws/s3.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request } from 'express';
import { StudentsGateway } from '../chat/students.gateway';
import { TeachersGateway } from '../chat/teachers.gateway';
import { EVENTS } from '../chat/events';

interface AuthUser {
  userId: number;
  role: 'student' | 'professor';
  username?: string;
}

// Express Request 타입에 user 프로퍼티 추가
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly s3Service: S3Service,
    private readonly studentsGateway: StudentsGateway,
    private readonly teachersGateway: TeachersGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('user/rooms')
  getUserRooms(@Req() req: Request) {
    const user = req.user!;
    return this.roomsService.getUserRooms(user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professor')
  @Post()
  async create(@Req() req: Request, @Body() createRoomDto: CreateRoomDto) {
    const room = await this.roomsService.create(createRoomDto);
    const user = req.user!;
    await this.roomsService.addProfessorToRoom(user.userId, room.id);
    return room;
  }

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(+id);
  }

  /** Get room id by its code */
  @Get('code/:code')
  async getIdByCode(@Param('code') code: string) {
    const room = await this.roomsService.findByCode(code);
    return { id: room.id };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomsService.update(+id, updateRoomDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(+id);
  }

  @Get(':id/messages')
  getRoomMessages(@Param('id') id: string) {
    return this.roomsService.getRoomMessages(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/participants')
  getRoomParticipants(@Param('id') id: string) {
    return this.roomsService.getRoomParticipants(id);
  }

  /**
   * S3 업로드용 presigned URL 발급 (메인 이미지)
   * 1) 방 존재 검증
   * 2) imageKey 컬럼에 키 저장
   * 3) presigned URL 반환
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/upload-image-url')
  async getUploadImageUrl(
    @Param('id') id: string,
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: string,
  ) {
    // Ensure room exists
    await this.roomsService.findOne(+id);
    const key = `rooms/${id}/${Date.now()}-${fileName}`;
    // Save the image key in the room record
    await this.roomsService.update(+id, { imageKey: key });
    const uploadUrl = await this.s3Service.getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  /**
   * S3 다운로드용 presigned URL 발급 (메인 이미지)
   * 1) 방 조회
   * 2) imageKey 유무 확인
   * 3) presigned URL 반환
   */
  @Get(':id/download-image-url')
  async getDownloadImageUrl(@Param('id') id: string) {
    const room = await this.roomsService.findOne(+id);
    if (!room.imageKey) {
      throw new NotFoundException('Image not found');
    }
    const downloadUrl = await this.s3Service.getDownloadUrl(room.imageKey);
    return { downloadUrl };
  }

  /**
   * 갤러리 이미지 업로드 presigned URL 발급 및 브로드캐스트
   * 1) DB에 image 레코드 저장
   * 2) presigned URL 생성
   * 3) 방 코드 조회
   * 4) 학생/교수 네임스페이스에 IMAGE_UPLOADED 이벤트 브로드캐스트
   * 5) uploadUrl/key 반환
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/images/upload-url')
  async getRoomImagesUploadUrl(
    @Param('id') id: string,
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: string,
  ) {
    const roomId = +id;
    const key = `rooms/${roomId}/${Date.now()}-${fileName}`;
    // DB에 이미지 레코드 저장
    const image = await this.roomsService.addRoomImage(roomId, key);
    // presigned URL 생성
    const uploadUrl = await this.s3Service.getUploadUrl(key, contentType);
    // 방 코드 조회 (브로드캐스트에 사용)
    const room = await this.roomsService.findOne(roomId);
    const roomCode = room.code;
    // 브로드캐스트: 학생 네임스페이스에 이미지 업로드 이벤트 전송
    this.studentsGateway.server.to(roomCode).emit(EVENTS.IMAGE_UPLOADED, {
      id: image.id,
      key: image.key,
      url: await this.s3Service.getDownloadUrl(key),
      createdAt: image.createdAt,
    });
    // 브로드캐스트: 교사 네임스페이스에 이미지 업로드 이벤트 전송
    this.teachersGateway.server.to(roomCode).emit(EVENTS.IMAGE_UPLOADED, {
      id: image.id,
      key: image.key,
      url: await this.s3Service.getDownloadUrl(key),
      createdAt: image.createdAt,
    });
    return { uploadUrl, key };
  }

  /**
   * 방 갤러리 이미지 목록 조회
   * 1) DB에서 image 레코드 불러오기
   * 2) presigned download URL 생성
   * 3) 결과 반환
   */
  @Get(':id/images')
  async listRoomImages(@Param('id') id: string) {
    const roomId = +id;
    const images = await this.roomsService.getRoomImages(roomId);
    const result = await Promise.all(
      images.map(async (img) => ({
        id: img.id,
        key: img.key,
        url: await this.s3Service.getDownloadUrl(img.key),
        createdAt: img.createdAt,
      })),
    );
    return result;
  }
}
