import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../auth/entities/user.entity';
import { OxAnswer } from './ox-answer.entity';

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

  @OneToMany(() => OxAnswer, (answer) => answer.quiz)
  answers: OxAnswer[];

  @CreateDateColumn()
  timestamp: Date;
}
