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
} 