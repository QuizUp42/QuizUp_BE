import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuizService } from './quiz.service';
import { QuizService as ChatQuizService } from '../chat/quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizResponseInterceptor } from './interceptors/quiz-response.interceptor';

@UseInterceptors(QuizResponseInterceptor)
@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly chatQuizService: ChatQuizService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.quizService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quizService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professor')
  @Post()
  create(
    @Req() req: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createQuizDto: CreateQuizDto,
  ) {
    const creatorId = req.user.userId;
    return this.quizService.create(createQuizDto, creatorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student')
  @Post(':id/submit')
  async submit(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() submitQuizDto: SubmitQuizDto,
  ) {
    const userId = req.user.userId;
    const result = await this.quizService.submitAnswer(
      id,
      userId,
      submitQuizDto.answers,
    );
    // Publish quiz submission event for chat
    this.chatQuizService.publishQuiz(id.toString(), true, userId.toString());
    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professor')
  @Get('room/:roomId')
  findByRoom(@Param('roomId') roomId: string) {
    return this.quizService.findByRoom(+roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/score')
  async getScore(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user.userId;
    const quiz = await this.quizService.findOne(id);
    const stats = await this.quizService.getScore(id, userId);
    const detailedQuestions = quiz.questions.map((q) => {
      const statEntry = stats.questions.find((s) => s.questionId === q.id);
      const choiceList =
        statEntry?.choices?.map((c) => ({
          choice: c.choice,
          count: c.count,
        })) ?? [];
      return {
        id: q.id,
        quizId: q.quizId,
        question: q.question,
        correctAnswer: q.correctAnswer,
        myAnswer: statEntry?.myAnswer ?? null,
        totalResponses: stats.totalResponses,
        choices: choiceList,
      };
    });
    const totalScore =
      detailedQuestions.filter((q) => q.myAnswer === q.correctAnswer).length *
      10;
    return {
      id: quiz.id,
      roomId: quiz.roomId,
      userId: quiz.userId,
      title: quiz.title,
      createdAt: quiz.createdAt,
      totalScore,
      questions: detailedQuestions,
    };
  }
}
