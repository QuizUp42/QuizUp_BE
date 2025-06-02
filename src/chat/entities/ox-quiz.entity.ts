import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('ox_quizzes')
export class OxQuiz {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  roomId: number;
  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  userId: number;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text')
  question: string;

  @Column('simple-json', { nullable: true })
  answers?: { userId: number; answer: 'O' | 'X' }[];

  @CreateDateColumn()
  timestamp: Date;
} 