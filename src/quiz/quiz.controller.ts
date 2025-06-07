import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.quizService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quizService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professor')
  @Post()
  create(
    @Req() req: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createQuizDto: CreateQuizDto,
  ) {
    const creatorId = (req.user as any).userId;
    return this.quizService.create(createQuizDto, creatorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student')
  @Post(':id/submit')
  submit(
    @Req() req: any,
    @Param('id') id: string,
    @Body() submitQuizDto: SubmitQuizDto,
  ) {
    const userId = (req.user as any).userId;
    return this.quizService.submitAnswer(+id, userId, submitQuizDto.answer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professor')
  @Get('room/:roomId')
  findByRoom(@Param('roomId') roomId: string) {
    return this.quizService.findByRoom(+roomId);
  }
}
