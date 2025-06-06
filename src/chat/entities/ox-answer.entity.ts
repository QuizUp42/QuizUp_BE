import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OxQuiz } from './ox-quiz.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('ox_answers')
export class OxAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  quizId: number;
  @ManyToOne(() => OxQuiz, (quiz) => quiz.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: OxQuiz;

  @Column()
  @Index()
  userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ['O', 'X'], nullable: true })
  answer: 'O' | 'X' | null;

  @CreateDateColumn()
  timestamp: Date;
}
