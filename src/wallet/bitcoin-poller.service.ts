import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import Redis from 'ioredis';

@Injectable()
export class BitcoinPollerService implements OnModuleInit {
  private readonly logger = new Logger(BitcoinPollerService.name);
  private redis: Redis;
  private isPolling = false;
  private lastBlockHeight = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly bitcoinService: BitcoinService,
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
  ) {
    const redisHost = this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
    });
  }

  async onModuleInit() {
    // Initialize last block height from Redis or get current height
    const stored = await this.redis.get('btc:last_block_height');
    if (stored) {
      this.lastBlockHeight = parseInt(stored, 10);
    }
    this.logger.log('BitcoinPollerService initialized');
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollBitcoinDeposits() {
    if (this.isPolling) {
      this.logger.debug('Already polling, skipping');
      return;
    }

    this.isPolling = true;
    try {
      // Get current block height
      const currentHeight = await this.bitcoinService.getBlockCount();
      
      if (this.lastBlockHeight === 0) {
        // First run, set initial height
        this.lastBlockHeight = currentHeight;
        await this.redis.set('btc:last_block_height', currentHeight.toString());
        this.logger.log(`Initial BTC block height: ${currentHeight}`);
        return;
      }

      // Check for new blocks
      if (currentHeight <= this.lastBlockHeight) {
        this.logger.debug(`No new BTC blocks: ${currentHeight}`);
        return;
      }

      // Handle reorgs: if the chain reorganizes, we need to re-scan
      const reorgDetected = await this.detectReorg(this.lastBlockHeight);
      if (reorgDetected) {
        this.logger.warn(`Bitcoin reorg detected at height ${this.lastBlockHeight}`);
        // Re-scan the last few blocks
        this.lastBlockHeight = Math.max(0, this.lastBlockHeight - 12);
      }

      // Process new blocks
      for (let height = this.lastBlockHeight + 1; height <= currentHeight; height++) {
        await this.processBlock(height);
      }

      // Update last processed height
      this.lastBlockHeight = currentHeight;
      await this.redis.set('btc:last_block_height', currentHeight.toString());

    } catch (error) {
      this.logger.error('Error polling Bitcoin deposits', error);
    } finally {
      this.isPolling = false;
    }
  }

  private async detectReorg(expectedHeight: number): Promise<boolean> {
    try {
      const storedHash = await this.redis.get(`btc:block_hash:${expectedHeight}`);
      if (!storedHash) return false;

      const currentHash = await this.bitcoinService.getBlockHash(expectedHeight);
      return storedHash !== currentHash;
    } catch (error) {
      this.logger.error(`Error detecting reorg at height ${expectedHeight}`, error);
      return false;
    }
  }

  private async processBlock(height: number) {
    try {
      const blockHash = await this.bitcoinService.getBlockHash(height);
      
      // Store block hash for reorg detection
      await this.redis.set(`btc:block_hash:${height}`, blockHash, 'EX', 60 * 60 * 24 * 7);

      const block = await this.bitcoinService.getBlock(blockHash);
      
      this.logger.debug(`Processing BTC block ${height} with ${block.tx.length} transactions`);

      // Get all deposit addresses we're monitoring
      const addresses = await this.getAllMonitoredBtcAddresses();
      const addressSet = new Set(addresses);

      // Check each transaction in the block
      for (const tx of block.tx) {
        const txid = tx.txid;
        
        // Check transaction outputs for our addresses
        for (const vout of tx.vout) {
          if (vout.scriptPubKey && vout.scriptPubKey.address) {
            const address = vout.scriptPubKey.address;
            
            if (addressSet.has(address)) {
              // All transactions in this block have the same confirmations as the block
              const confirmations = block.confirmations;
              
              this.logger.log(
                `BTC deposit detected: ${vout.value} BTC to ${address} (tx: ${txid}, confirmations: ${confirmations})`,
              );

              await this.depositService.handleDeposit(
                'BTC',
                txid,
                vout.value,
                address,
                confirmations,
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing BTC block ${height}`, error);
    }
  }

  private async getAllMonitoredBtcAddresses(): Promise<string[]> {
    return this.walletService.getAddressesByCurrency('BTC');
  }
}
