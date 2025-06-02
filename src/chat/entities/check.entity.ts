import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('checks')
export class Check {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  roomId: number;

  @ManyToOne(() => Room, (room) => room.checks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  @Index()
  professorId: number;
  
  @ManyToOne(() => User, (user) => user.checks, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professorId' })
  professor: User;

  @Column({ name: 'status', type: 'boolean', default: false })
  isChecked: boolean;

  @Column({ type: 'int', default: 0 })
  checkCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
