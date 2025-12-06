import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Balance } from '../../wallet/entities/balance.entity';
import { DepositAddress } from '../../wallet/entities/deposit-address.entity';
import { Transaction } from '../../wallet/entities/transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  username: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Balance, (balance) => balance.user)
  balances: Balance[];

  @OneToMany(() => DepositAddress, (address) => address.user)
  depositAddresses: DepositAddress[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];
}
