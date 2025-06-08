import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { Question } from './entities/question.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  /** Create a new quiz with multiple questions */
  async create(createQuizDto: CreateQuizDto, creatorId: number): Promise<Quiz> {
    // Create quiz metadata
    const quiz = this.quizRepository.create({
      roomId: createQuizDto.roomId,
      userId: creatorId,
      title: createQuizDto.title,
    });
    await this.quizRepository.save(quiz);
    // Create questions
    const questions = createQuizDto.questions.map((q) =>
      this.questionRepository.create({
        quizId: quiz.id,
        question: q.question,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
      }),
    );
    await this.questionRepository.save(questions);
    quiz.questions = questions;
    return quiz;
  }

  /** Get all quizzes with their questions */
  findAll(): Promise<Quiz[]> {
    return this.quizRepository.find({ relations: ['questions'] });
  }

  async findOne(id: number): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quiz with id ${id} not found`);
    }
    return quiz;
  }

  /** Fetch all quizzes belonging to a specific room */
  findByRoom(roomId: number): Promise<Quiz[]> {
    return this.quizRepository.find({
      where: { roomId },
      relations: ['questions'],
    });
  }

  // Grade submitted quiz answers for a user
  async submitAnswer(
    quizId: number,
    userId: number,
    answers: string[],
  ): Promise<{
    quizId: number;
    userId: number;
    totalQuestions: number;
    correctCount: number;
    results: { isCorrect: boolean; correctAnswer: string }[];
  }> {
    // Fetch quiz with its questions
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quiz with id ${quizId} not found`);
    }
    // Ensure answer count matches question count
    const questions = quiz.questions.sort((a, b) => a.id - b.id);
    if (answers.length !== questions.length) {
      throw new BadRequestException(
        `${questions.length}개의 답변이 필요하지만 ${answers.length}개를 받았습니다`,
      );
    }
    // Grade each answer
    const results = questions.map((q, idx) => ({
      isCorrect: q.correctAnswer === answers[idx],
      correctAnswer: q.correctAnswer,
    }));
    const correctCount = results.filter((r) => r.isCorrect).length;
    // Return detailed grading summary
    return {
      quizId,
      userId,
      totalQuestions: questions.length,
      correctCount,
      results,
    };
  }
}
