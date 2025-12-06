import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  currency: string;

  @Column()
  type: string; // 'deposit' | 'withdrawal'

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column()
  address: string;

  @Column()
  @Index()
  txHash: string;

  @Column({ default: 0 })
  confirmations: number;

  @Column()
  status: string; // 'pending' | 'confirmed' | 'failed'

  @Column({ nullable: true })
  blockNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;
}
