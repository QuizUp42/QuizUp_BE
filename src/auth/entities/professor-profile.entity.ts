import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('professor_profiles')
export class ProfessorProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  professorNo: string;

  @OneToOne(() => User, (user) => user.professorProfile)
  @JoinColumn()
  user: User;

  @ManyToMany(() => Room, (room) => room.professors)
  @JoinTable({ name: 'professor_rooms' })
  rooms: Room[];
}
