import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { RoomsService } from '../rooms/rooms.service';

@Controller('me')
export class MeController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  getMyRooms(@Req() req: Request) {
    const user = req.user! as any;
    return this.roomsService.getUserRooms(user.userId, user.role);
  }
}
