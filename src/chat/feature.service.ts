import { Injectable } from '@nestjs/common';

export interface FeatureEvent {
  roomId: string;
  featureId: string;
  type: 'raffle' | 'check' | 'ox';
  newState: string | boolean;
  userId: string;
  timestamp: Date;
}

@Injectable()
export class FeatureService {
  private events: FeatureEvent[] = [];

  createEvent(data: Omit<FeatureEvent, 'timestamp'>): FeatureEvent {
    const event: FeatureEvent = { ...data, timestamp: new Date() };
    this.events.push(event);
    return event;
  }

  getEvents(roomId: string): FeatureEvent[] {
    return this.events.filter(e => e.roomId === roomId);
  }
} 