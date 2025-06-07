import {
  Injectable,
  NotFoundException,
  NotImplementedException,
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

  // Submission logic to be implemented per question
  submitAnswer(
    _quizId: number,
    _userId: number,
    _answer: string,
  ): Promise<{ isCorrect: boolean; correctAnswer: string }> {
    // consume parameters to avoid unused variable errors
    void _quizId;
    void _userId;
    void _answer;
    throw new NotImplementedException(
      'Submit answer per question is not implemented yet',
    );
  }
}
