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
    return this.events.filter((e) => e.roomId === roomId);
  }

  /**
   * Toggle a check feature event
   * @param roomId - the room identifier
   * @param featureId - the unique id of the check item
   * @param newState - the new checked state
   * @param userId - the id of the user toggling the checkbox
   */
  toggleCheck(
    roomId: string,
    featureId: string,
    newState: boolean,
    userId: string,
  ): FeatureEvent {
    return this.createEvent({
      roomId,
      featureId,
      type: 'check',
      newState,
      userId,
    });
  }

  /**
   * Get only check feature events for a room
   * @param roomId - the room identifier
   */
  getCheckEvents(roomId: string): FeatureEvent[] {
    return this.getEvents(roomId).filter((e) => e.type === 'check');
  }
}
