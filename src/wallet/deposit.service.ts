import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { WalletService } from './wallet.service';
import { Transaction } from './entities/transaction.entity';
import { Balance } from './entities/balance.entity';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {
    const redisHost = this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
    });
  }

  async handleDeposit(
    currency: string,
    txHash: string,
    amount: number,
    address: string,
    confirmations: number,
  ) {
    const upperCurrency = currency.toUpperCase();
    const lockKey = `deposit:lock:${upperCurrency}:${txHash}`;
    const processedKey = `deposit:processed:${upperCurrency}:${txHash}`;

    // 1. Idempotency Check (Redis)
    const isProcessed = await this.redis.get(processedKey);
    if (isProcessed) {
      this.logger.debug(`Deposit ${txHash} already processed`);
      return;
    }

    // Acquire lock
    const acquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (!acquired) return;

    try {
      // Double check processed state
      if (await this.redis.get(processedKey)) return;

      // 2. Find User
      const userId = await this.walletService.getUserIdByAddress(upperCurrency, address);
      if (!userId) {
        this.logger.warn(`Deposit received for unknown address: ${address}`);
        return;
      }

      const minConfirmations = upperCurrency === 'BTC' ? 6 : 12;
      const isConfirmed = confirmations >= minConfirmations;
      const status = isConfirmed ? 'confirmed' : 'pending';

      // Start DB Transaction
      await this.dataSource.transaction(async (manager) => {
        // 3. Create/Update Transaction Record
        let transaction = await manager.findOne(Transaction, {
            where: { txHash, currency: upperCurrency }
        });

        if (transaction && transaction.status === 'confirmed') {
            return; // Already confirmed in DB
        }

        if (!transaction) {
            transaction = manager.create(Transaction, {
                userId,
                currency: upperCurrency,
                type: 'deposit',
                amount,
                address,
                txHash,
                confirmations,
                status,
                confirmedAt: isConfirmed ? new Date() : null,
            });
            await manager.save(transaction);
            this.logger.log(`Created pending deposit ${txHash} for user ${userId} (conf: ${confirmations})`);
        } else {
            // Update existing pending transaction
            transaction.confirmations = confirmations;
            if (isConfirmed && transaction.status !== 'confirmed') {
                transaction.status = 'confirmed';
                transaction.confirmedAt = new Date();
            }
            await manager.save(transaction);
        }

        // 4. Update Balance (Only if confirmed)
        if (isConfirmed) {
            let balance = await manager.findOne(Balance, {
                where: { userId, currency: upperCurrency }
            });

            if (!balance) {
                balance = manager.create(Balance, {
                    userId,
                    currency: upperCurrency,
                    amount: 0,
                });
            }

            balance.amount = Number(balance.amount) + amount;
            await manager.save(balance);

            this.logger.log(`Updated balance for user ${userId}: +${amount} ${upperCurrency}. New Balance: ${balance.amount}`);
            
            // Mark as processed in Redis only when confirmed
            await this.redis.set(processedKey, '1', 'EX', 60 * 60 * 24 * 30);
            
            // Emit confirmed event
            this.eventsGateway.emitToUser(userId, 'deposit_confirmed', {
                txHash,
                currency: upperCurrency,
                amount,
                newBalance: balance.amount,
            });
        } else {
            // Emit pending event
            this.eventsGateway.emitToUser(userId, 'deposit_pending', {
                txHash,
                currency: upperCurrency,
                amount,
                confirmations,
                required: minConfirmations,
            });
        }
      });

    } catch (error) {
      this.logger.error(`Failed to process deposit ${txHash}`, error);
      throw error;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async getTransactionHistory(userId: string, currency?: string): Promise<Transaction[]> {
    const where: any = { userId };
    if (currency) {
      where.currency = currency.toUpperCase();
    }
    return this.transactionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionByHash(txHash: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({ where: { txHash } });
  }
}
