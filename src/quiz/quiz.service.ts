import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { Question } from './entities/question.entity';
import { Submission } from './entities/submission.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { In } from 'typeorm';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  /** Create a new quiz with multiple questions */
  async create(createQuizDto: CreateQuizDto, creatorId: number): Promise<Quiz> {
    // Create quiz metadata
    const quiz = this.quizRepository.create({
      roomId: createQuizDto.roomId,
      userId: creatorId,
      title: createQuizDto.title,
    });
    try {
      await this.quizRepository.save(quiz);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23503'
      ) {
        throw new NotFoundException(
          `Room with id ${createQuizDto.roomId} not found`,
        );
      }
      throw error;
    }
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
    // Return detailed grading summary and persist submission
    const result = {
      quizId,
      userId,
      totalQuestions: questions.length,
      correctCount,
      results,
    };
    // Save or update submission record
    let submission = await this.submissionRepository.findOne({
      where: { quizId, userId },
    });
    if (submission) {
      submission.answers = answers;
    } else {
      submission = this.submissionRepository.create({
        quizId,
        userId,
        answers,
      });
    }
    await this.submissionRepository.save(submission);
    return result;
  }

  /** Get per-question choice distribution and user's answers */
  async getScore(
    quizId: number,
    userId: number,
  ): Promise<{
    quizId: number;
    totalResponses: number;
    questions: {
      questionId: number;
      question: string;
      choices: { choice: string; count: number; rate: number }[];
      myAnswer: string | null;
      rate: number;
    }[];
  }> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quiz with id ${quizId} not found`);
    }
    const questions = quiz.questions.sort((a, b) => a.id - b.id);
    const submissions = await this.submissionRepository.find({
      where: { quizId },
    });
    const total = submissions.length;
    const userSubmission = submissions.find((s) => s.userId === userId);
    const stats = questions.map((q, idx) => {
      // Choice distribution
      const choiceCounts = q.choices.map(
        (choice) => submissions.filter((s) => s.answers[idx] === choice).length,
      );
      const choiceStats = q.choices.map((choice, i) => ({
        choice,
        count: choiceCounts[i],
        rate: total > 0 ? choiceCounts[i] / total : 0,
      }));
      // Correct-response ratio per question
      const correctCount = submissions.filter(
        (s) => s.answers[idx] === q.correctAnswer,
      ).length;
      const rate = total > 0 ? correctCount / total : 0;
      return {
        questionId: q.id,
        question: q.question,
        choices: choiceStats,
        myAnswer: userSubmission ? userSubmission.answers[idx] : null,
        rate,
      };
    });
    return { quizId, totalResponses: total, questions: stats };
  }

  /** Get leaderboard for a quiz */
  async getRanking(quizId: number): Promise<
    {
      userId: number;
      username: string;
      correctCount: number;
      totalScore: number;
    }[]
  > {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quiz with id ${quizId} not found`);
    }
    // Sort questions by id
    const questions = quiz.questions.sort((a, b) => a.id - b.id);
    // Load submissions with user relation
    const submissions = await this.submissionRepository.find({
      where: { quizId },
      relations: ['user'],
    });
    // Compute scores
    const leaderboard = submissions.map((s) => {
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (s.answers[idx] === q.correctAnswer) {
          correctCount += 1;
        }
      });
      const totalScore = correctCount * 10;
      return {
        userId: s.userId,
        username: s.user?.username || '',
        correctCount,
        totalScore,
      };
    });
    // Sort by totalScore descending
    return leaderboard.sort((a, b) => b.totalScore - a.totalScore);
  }

  /** Get leaderboard aggregated across all quizzes in a room */
  async getRoomRanking(roomId: number): Promise<
    {
      userId: number;
      username: string;
      correctCount: number;
      totalScore: number;
    }[]
  > {
    // Find all quizzes in the room
    const quizzes = await this.quizRepository.find({
      where: { roomId },
      relations: ['questions'],
    });
    if (quizzes.length === 0) {
      throw new NotFoundException(`No quizzes found for room ${roomId}`);
    }
    // Map quizId to its sorted questions array
    const quizMap = new Map<number, { correctAnswer: string }[]>();
    quizzes.forEach((quiz) => {
      const sorted = quiz.questions.sort((a, b) => a.id - b.id);
      quizMap.set(
        quiz.id,
        sorted.map((q) => ({ correctAnswer: q.correctAnswer })),
      );
    });
    const quizIds = quizzes.map((q) => q.id);
    // Load all submissions for these quizzes
    const submissions = await this.submissionRepository.find({
      where: { quizId: In(quizIds) },
      relations: ['user'],
    });
    // Aggregate per userId
    const scoreMap = new Map<
      number,
      { username: string; correctCount: number }
    >();
    submissions.forEach((s) => {
      const questions = quizMap.get(s.quizId) || [];
      let userCorrect = 0;
      questions.forEach((q, idx) => {
        if (s.answers[idx] === q.correctAnswer) {
          userCorrect += 1;
        }
      });
      const prev = scoreMap.get(s.userId);
      if (prev) {
        prev.correctCount += userCorrect;
      } else {
        scoreMap.set(s.userId, {
          username: s.user?.username || '',
          correctCount: userCorrect,
        });
      }
    });
    // Build leaderboard array
    const leaderboard = Array.from(scoreMap.entries()).map(
      ([userId, data]) => ({
        userId,
        username: data.username,
        correctCount: data.correctCount,
        totalScore: data.correctCount * 10,
      }),
    );
    // Sort descending by totalScore
    return leaderboard.sort((a, b) => b.totalScore - a.totalScore);
  }
}
