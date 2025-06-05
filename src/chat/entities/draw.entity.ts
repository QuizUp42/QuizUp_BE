import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('draws')
export class Draw {
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

  @Column('simple-json')
  participants: { userId: number; username: string; role: string }[];

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  winnerId?: number;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winnerId' })
  winner: User;

  @Column({ default: false })
  isRelease: boolean
} 