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
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request } from 'express';

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
  constructor(private readonly roomsService: RoomsService) {}

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
}
