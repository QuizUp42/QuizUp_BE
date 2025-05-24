import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { StudentProfile } from '../../auth/entities/student-profile.entity';
import { ProfessorProfile } from '../../auth/entities/professor-profile.entity';
import { Message } from '../../chat/entities/message.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  qrCodeUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => StudentProfile, profile => profile.rooms)
  students: StudentProfile[];

  @ManyToMany(() => ProfessorProfile, profile => profile.rooms)
  professors: ProfessorProfile[];

  @OneToMany(() => Message, message => message.room)
  messages: Message[];
}
