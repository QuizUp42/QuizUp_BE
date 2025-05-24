import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { ProfessorProfile } from './professor-profile.entity';
import { Message } from '../../chat/entities/message.entity';

export type UserRole = 'student' | 'professor';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => StudentProfile, (profile: StudentProfile) => profile.user)
  studentProfile: StudentProfile;

  @OneToOne(() => ProfessorProfile, (profile: ProfessorProfile) => profile.user)
  professorProfile: ProfessorProfile;

  @OneToMany(() => Message, message => message.author)
  messages: Message[];
} 