import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToMany, JoinTable, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  studentNo: string;

  @OneToOne(() => User, user => user.studentProfile)
  @JoinColumn()
  user: User;

  @ManyToMany(() => Room, room => room.students)
  @JoinTable({ name: 'student_rooms' })
  rooms: Room[];
} 