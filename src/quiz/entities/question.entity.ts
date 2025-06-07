import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  quizId: number;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @Column()
  question: string;

  @Column('text', { array: true })
  choices: string[];

  @Column()
  correctAnswer: string;
}
