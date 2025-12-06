import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('deposit_addresses')
export class DepositAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.depositAddresses)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  currency: string;

  @Column()
  @Index({ unique: true })
  address: string;

  @Column({ nullable: true })
  derivationPath: string;

  @CreateDateColumn()
  createdAt: Date;
}
