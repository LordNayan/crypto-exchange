import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('balances')
@Index(['userId', 'currency'], { unique: true })
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.balances)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  currency: string;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
