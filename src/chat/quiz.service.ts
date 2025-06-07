import { Injectable } from '@nestjs/common';
import { QuizEventDto } from './dto/quiz-event.dto';

@Injectable()
export class QuizService {
  private events: QuizEventDto[] = [];

  createEvent(data: Omit<QuizEventDto, 'timestamp'>): QuizEventDto {
    const event: QuizEventDto = { ...data, timestamp: new Date() };
    this.events.push(event);
    return event;
  }

  getEvents(): QuizEventDto[] {
    return this.events;
  }

  /**
   * Publish a new quiz event (creation or submission)
   * @param quizId - the unique id of the quiz
   * @param isSubmit - whether this event is a submission
   */
  publishQuiz(quizId: string, isSubmit: boolean, userId: string): QuizEventDto {
    return this.createEvent({ quizId, isSubmit, userId });
  }

  /**
   * Get all quiz events for a given room
   */
  getQuizEvents(): QuizEventDto[] {
    return this.getEvents();
  }
}
