import { Injectable } from '@nestjs/common';

export interface QuizEvent {
  roomId: string;
  quizId: string;
  quizName: string;
  quizCount: number;
  isSubmit: boolean;
  userId: string;
  timestamp: Date;
}

@Injectable()
export class QuizService {
  private events: QuizEvent[] = [];

  createEvent(data: Omit<QuizEvent, 'timestamp'>): QuizEvent {
    const event: QuizEvent = { ...data, timestamp: new Date() };
    this.events.push(event);
    return event;
  }

  getEvents(roomId: string): QuizEvent[] {
    return this.events.filter((e) => e.roomId === roomId);
  }

  /**
   * Publish a new quiz event
   * @param roomId - the room identifier
   * @param quizId - the unique id of the quiz
   * @param quizName - the name or label of the quiz
   * @param quizCount - the number of players or attempts
   * @param isSubmit - whether this event is a submission
   * @param userId - the id of the user triggering the event
   */
  publishQuiz(
    roomId: string,
    quizId: string,
    quizName: string,
    quizCount: number,
    isSubmit: boolean,
    userId: string,
  ): QuizEvent {
    return this.createEvent({ roomId, quizId, quizName, quizCount, isSubmit, userId });
  }

  /**
   * Get all quiz events for a given room
   * @param roomId - the room identifier
   */
  getQuizEvents(roomId: string): QuizEvent[] {
    return this.getEvents(roomId);
  }
} 