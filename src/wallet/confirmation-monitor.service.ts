import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { EthereumService } from '../ethereum/ethereum.service';
import { DepositService } from './deposit.service';

@Injectable()
export class ConfirmationMonitorService implements OnModuleInit {
  private readonly logger = new Logger(ConfirmationMonitorService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly bitcoinService: BitcoinService,
    private readonly ethereumService: EthereumService,
    private readonly depositService: DepositService,
  ) {}

  onModuleInit() {
    this.logger.log('ConfirmationMonitorService initialized');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkConfirmations() {
    this.logger.debug('Checking pending transaction confirmations...');

    try {
      // Fetch all pending transactions
      const pendingTransactions = await this.transactionRepository.find({
        where: { status: 'pending' },
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      this.logger.debug(`Found ${pendingTransactions.length} pending transactions`);

      for (const tx of pendingTransactions) {
        await this.checkTransaction(tx);
      }
    } catch (error) {
      this.logger.error('Error checking confirmations', error);
    }
  }

  private async checkTransaction(tx: Transaction) {
    try {
      let confirmations = 0;

      if (tx.currency === 'BTC') {
        confirmations = await this.bitcoinService.getConfirmations(tx.txHash);
      } else if (tx.currency === 'ETH') {
        // For ETH, we need to calculate confirmations manually based on block number
        // But EthereumService doesn't expose getTransaction directly in a way that returns confirmations easily
        // We can use the provider
        // Let's assume we can get it via a new method or existing one
        // Actually, EthereumService has a provider, but it's private.
        // We should add a method to EthereumService to get confirmations or transaction receipt
        // For now, let's assume we can get it.
        // Wait, I can't modify EthereumService easily without reading it again.
        // Let's check if I can use what I have.
        // I'll add getConfirmations to EthereumService.
        confirmations = await this.ethereumService.getConfirmations(tx.txHash);
      }

      // Handle dropped transactions (0 confirmations after a long time)
      // If confirmations is 0 and it's been > 24 hours, mark as failed
      if (confirmations === 0) {
        const hoursSinceCreation = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreation > 24) {
          this.logger.warn(`Transaction ${tx.txHash} dropped or invalid. Marking as failed.`);
          tx.status = 'failed';
          await this.transactionRepository.save(tx);
          return;
        }
      }

      // If confirmations changed, update via DepositService
      if (confirmations !== tx.confirmations) {
        this.logger.log(`Updating confirmations for ${tx.txHash}: ${tx.confirmations} -> ${confirmations}`);
        await this.depositService.handleDeposit(
          tx.currency,
          tx.txHash,
          Number(tx.amount),
          tx.address,
          confirmations,
        );
      }

    } catch (error) {
      this.logger.error(`Error checking transaction ${tx.txHash}`, error);
    }
  }
}
